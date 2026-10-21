import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ---------------------------------------------------------------------------
// agentChat: authenticated, streaming chat endpoint with tool use.
//
// AI providers: NVIDIA NIM and OpenRouter, called directly with API keys held
// ONLY as backend secrets (NVIDIA_API_KEY, OPENROUTER_API_KEY). The browser
// never sees a key. An ordered fallback chain retries on 429 / 5xx / timeout /
// empty output so a single flaky provider does not fail a chat turn.
//
// Protocol: newline-delimited JSON events:
//   conversation | message_start | delta | tool_call | tool_result |
//   message_end | error | done
// State is persisted to Base44 entities, so every open tab/device also gets
// updates through entity realtime subscriptions.
// ---------------------------------------------------------------------------

type Provider = 'nvidia' | 'openrouter';
interface ModelDef { id: string; provider: Provider; upstream: string; label: string }

// Only models verified to answer with this key set. Order = fallback order.
// Re-verified 2026-10-21: nemotron-3-super and the OpenRouter nemotron mirrors
// now 404 or stall, so the chain leads with the models that answered reliably.
const MODELS: ModelDef[] = [
  { id: 'gpt-oss-20b', provider: 'nvidia', upstream: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B' },
  { id: 'gemma-4-31b', provider: 'openrouter', upstream: 'google/gemma-4-31b-it:free', label: 'Gemma 4 31B' },
  { id: 'gemma-4-26b', provider: 'openrouter', upstream: 'google/gemma-4-26b-a4b-it:free', label: 'Gemma 4 26B' },
];
const DEFAULT_MODEL = 'gpt-oss-20b';

const ENDPOINTS: Record<Provider, { url: string; key: () => string | undefined }> = {
  nvidia: { url: 'https://integrate.api.nvidia.com/v1/chat/completions', key: () => Deno.env.get('NVIDIA_API_KEY') },
  openrouter: { url: 'https://openrouter.ai/api/v1/chat/completions', key: () => Deno.env.get('OPENROUTER_API_KEY') },
};

const MAX_TOOL_ITERATIONS = 4;
const HISTORY_LIMIT = 30;
const REQUEST_TIMEOUT_MS = 45000;
// Tool decisions are small (1200 tokens); fail over fast instead of hanging 45s.
const TOOL_TIMEOUT_MS = 25000;

const SYSTEM_PROMPT = `You are Agent Mobile, a helpful, precise AI assistant.
- Answer directly and lead with the result. Skip preamble.
- Use GitHub-flavoured Markdown. Put code in fenced blocks with a language tag.
- When a tool gives a better answer, call it instead of guessing. Never invent tool output, URLs or citations.
- If a tool fails, say so plainly and continue with what you know.
- Be concise by default.`;

type Json = Record<string, unknown>;
interface Attachment { id: string; name: string; mime: string; size: number; url?: string; text?: string }
interface ToolOutcome { ok: boolean; data: unknown; error?: string }
interface ChatMsg { role: 'system' | 'user' | 'assistant'; content: string }

const TOOL_SPECS: Record<string, { description: string; args: string }> = {
  web_search: { description: 'Search the web for current information.', args: '{"query": string}' },
  get_weather: { description: 'Current weather for a city.', args: '{"location": string, "units"?: "metric"|"imperial"}' },
  calculator: { description: 'Evaluate an arithmetic expression exactly (+ - * / % ^, parentheses, sqrt, log, min, max, pi, e).', args: '{"expression": string, "precision"?: number}' },
  get_current_time: { description: 'Current date/time in an IANA timezone.', args: '{"timezone"?: string}' },
  read_file: { description: 'Read the text of an attached file.', args: '{"name": string}' },
};

// ===== tools run in the sibling `agentTools` function ========================

async function runTool(base44: any, name: string, args: Json, attachments: Attachment[]): Promise<ToolOutcome> {
  try {
    const res = await base44.functions.invoke('agentTools', { tool: name, args, attachments });
    const out = (res?.data ?? res) as ToolOutcome;
    if (out && typeof out.ok === 'boolean') return out;
    return { ok: false, data: null, error: 'Tool service returned an unexpected response.' };
  } catch (err) {
    return { ok: false, data: null, error: err instanceof Error ? err.message : 'Tool execution failed.' };
  }
}

// ===== LLM provider layer ====================================================
class RetryableError extends Error {}

function fallbackChain(preferred: string): ModelDef[] {
  const first = MODELS.find((m) => m.id === preferred) ?? MODELS.find((m) => m.id === DEFAULT_MODEL)!;
  const rest = MODELS.filter((m) => m.id !== first.id);
  // Only attempt providers whose key is configured.
  return [first, ...rest].filter((m) => !!ENDPOINTS[m.provider].key());
}

async function callOnce(m: ModelDef, messages: ChatMsg[], maxTokens: number, stream: boolean, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
  const key = ENDPOINTS[m.provider].key();
  if (!key) throw new RetryableError(`${m.provider} key not configured`);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(ENDPOINTS[m.provider].url, {
      method: 'POST',
      signal: ctl.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        ...(m.provider === 'openrouter' ? { 'HTTP-Referer': 'https://agent-mobile.app', 'X-Title': 'Agent Mobile' } : {}),
      },
      body: JSON.stringify({ model: m.upstream, messages, max_tokens: maxTokens, temperature: 0.3, stream }),
    });
    if (!res.ok) {
      const body = (await res.text().catch(() => '')).slice(0, 200);
      if (res.status === 429 || res.status >= 500 || res.status === 404 || res.status === 410 || res.status === 408) {
        throw new RetryableError(`${m.label}: HTTP ${res.status}`);
      }
      throw new Error(`${m.label}: HTTP ${res.status} ${body}`);
    }
    return res;
  } catch (e) {
    if (e instanceof RetryableError) throw e;
    if ((e as Error).name === 'AbortError') throw new RetryableError(`${m.label}: timed out`);
    if (e instanceof TypeError) throw new RetryableError(`${m.label}: network error`);
    throw e;
  } finally { clearTimeout(timer); }
}

/** Non-streaming completion with fallback. Returns content only (never reasoning). */
async function complete(preferred: string, messages: ChatMsg[], maxTokens = 2500, timeoutMs = REQUEST_TIMEOUT_MS): Promise<{ text: string; model: ModelDef }> {
  const chain = fallbackChain(preferred);
  if (!chain.length) throw new Error('No AI provider is configured on the server.');
  const errors: string[] = [];
  // Three passes with growing backoff: free-tier 429s and momentary hangs
  // usually clear within seconds.
  for (let pass = 0; pass < 3; pass++) {
  if (pass) await new Promise((r) => setTimeout(r, pass * 3000));
  for (const m of chain) {
    try {
      const res = await callOnce(m, messages, maxTokens, false, timeoutMs);
      const data = await res.json();
      const text = String(data?.choices?.[0]?.message?.content ?? '').trim();
      if (!text) { errors.push(`${m.label}: empty reply`); continue; }
      return { text, model: m };
    } catch (e) {
      if (e instanceof RetryableError) { errors.push(e.message); continue; }
      throw e;
    }
  }
  }
  throw new Error(`All AI providers failed (${errors.join('; ')})`);
}

/** Streaming completion with fallback. Yields content deltas as they arrive. */
async function* streamComplete(preferred: string, messages: ChatMsg[], maxTokens = 3000): AsyncGenerator<{ delta?: string; model?: ModelDef }> {
  const chain = fallbackChain(preferred);
  if (!chain.length) throw new Error('No AI provider is configured on the server.');
  const errors: string[] = [];
  // Three passes; a later pass only happens if nothing was streamed yet,
  // so a retried answer can never duplicate text the user already received.
  for (let pass = 0; pass < 3; pass++) {
  if (pass) await new Promise((r) => setTimeout(r, pass * 3000));
  for (const m of chain) {
    let produced = false;
    try {
      const res = await callOnce(m, messages, maxTokens, true);
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = '';
      yield { model: m };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (payload === '[DONE]') continue;
          try {
            const delta = JSON.parse(payload)?.choices?.[0]?.delta?.content;
            if (typeof delta === 'string' && delta) { produced = true; yield { delta }; }
          } catch { /* ignore keep-alives / partial frames */ }
        }
      }
      if (produced) return;
      errors.push(`${m.label}: empty stream`);
    } catch (e) {
      if (produced) throw e; // cannot restart mid-answer without duplicating text
      if (e instanceof RetryableError) { errors.push(e.message); continue; }
      throw e;
    }
  }
  }
  throw new Error(`All AI providers failed (${errors.join('; ')})`);
}

/** Extract the first balanced JSON object from model text (tolerates fences/prose). */
function parseAction(text: string): { action?: string; tool?: string; args?: Json; text?: string } | null {
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.indexOf('{');
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) { try { return JSON.parse(cleaned.slice(start, i + 1)); } catch { return null; } } }
  }
  return null;
}

const deriveTitle = (text: string) => {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > 48 ? `${t.slice(0, 47)}…` : t || 'New chat';
};

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // --- Authentication -------------------------------------------------------
  const user = await base44.auth.me().catch(() => null);
  if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { return Response.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  const mode: 'send' | 'regenerate' | 'edit' = ['regenerate', 'edit'].includes(body.mode) ? body.mode : 'send';
  let userText = String(body.message ?? '').trim();
  if (mode !== 'regenerate' && !userText) return Response.json({ error: '`message` is required' }, { status: 400 });
  if (userText.length > 20000) return Response.json({ error: 'Message too long' }, { status: 413 });
  if (mode !== 'send' && !body.conversationId) return Response.json({ error: '`conversationId` is required for this mode' }, { status: 400 });
  if (mode === 'edit' && !body.targetMessageId) return Response.json({ error: '`targetMessageId` is required for edit' }, { status: 400 });

  const model = MODELS.some((m) => m.id === body.model) ? String(body.model) : DEFAULT_MODEL;
  let attachments: Attachment[] = Array.isArray(body.attachments) ? body.attachments.slice(0, 10) : [];
  const systemPrompt = String(body.systemPrompt ?? '').trim() || SYSTEM_PROMPT;
  const enabledTools: string[] = (Array.isArray(body.enabledTools) ? body.enabledTools : Object.keys(TOOL_SPECS)).filter((t: string) => t in TOOL_SPECS);

  // --- Resolve conversation (RLS scopes lookups to the signed-in user) ------
  let conversationId: string | undefined = body.conversationId;
  let title = deriveTitle(userText);
  try {
    if (conversationId) {
      const found = await base44.entities.Conversation.filter({ id: conversationId }).catch(() => []);
      const convo = found?.[0];
      if (!convo) return Response.json({ error: 'Conversation not found' }, { status: 404 });
      title = convo.title;
    } else {
      const created = await base44.entities.Conversation.create({ title, model, last_message_at: new Date().toISOString() });
      conversationId = created.id;
    }
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
  const convId = conversationId as string;

  // --- Thread surgery for regenerate / edit ---------------------------------
  let regenAttachments: Attachment[] = [];
  let editFrom = -1;
  let removeTail: (idx: number) => Promise<void> = async () => {};
  try {
    const all = (await base44.entities.Message.filter({ conversation_id: convId }, 'created_date', 500)) as any[];
    removeTail = async (idx: number) => {
      for (const m of all.slice(idx)) {
        const calls = (await base44.entities.ToolCall.filter({ message_id: m.id }, 'created_date', 100).catch(() => [])) as any[];
        await Promise.all(calls.map((c) => base44.entities.ToolCall.delete(c.id).catch(() => {})));
        await base44.entities.Message.delete(m.id).catch(() => {});
      }
    };
    if (mode === 'regenerate') {
      // Previous answers are kept: the UI shows them as switchable variants.
      let lastUser = -1;
      for (let i = all.length - 1; i >= 0; i--) if (all[i].role === 'user') { lastUser = i; break; }
      if (lastUser === -1) return Response.json({ error: 'Nothing to regenerate' }, { status: 400 });
      userText = String(all[lastUser].content ?? '');
      regenAttachments = Array.isArray(all[lastUser].attachments) ? all[lastUser].attachments : [];
    } else if (mode === 'edit') {
      const idx = all.findIndex((m) => m.id === body.targetMessageId);
      if (idx === -1 || all[idx].role !== 'user') return Response.json({ error: 'Message to edit not found' }, { status: 404 });
      editFrom = idx;
    }
  } catch (e) {
    return Response.json({ error: `Could not prepare conversation: ${(e as Error).message}` }, { status: 500 });
  }

  if (mode === 'regenerate') attachments = regenAttachments.slice(0, 10);
  if (mode !== 'regenerate') {
    const created = await base44.entities.Message.create({ conversation_id: convId, role: 'user', content: userText, attachments, status: 'complete' });
    // Edit: only now that the replacement exists is it safe to drop the old turn and everything after it.
    if (editFrom >= 0) { await removeTail(editFrom); void created; }
  }
  const assistant = await base44.entities.Message.create({ conversation_id: convId, role: 'assistant', content: '', model, status: 'streaming' });

  const rawHistory = ((await base44.entities.Message.filter({ conversation_id: convId }, 'created_date', HISTORY_LIMIT)) as any[])
    .filter((m) => m.id !== assistant.id && (m.role === 'user' || (m.role === 'assistant' && m.content)));
  // Variants of earlier turns collapse to the newest answer; variants of the
  // turn being regenerated are dropped so the model does not echo itself.
  const history: any[] = [];
  for (let i = 0; i < rawHistory.length; i++) {
    const m = rawHistory[i];
    if (m.role === 'assistant') {
      const next = rawHistory[i + 1];
      if (next && next.role === 'assistant') continue;      // keep only the last of a run
      if (i === rawHistory.length - 1) continue;             // trailing run = the turn being (re)answered
    }
    history.push(m);
  }
  const attachNote = attachments.length ? `\n\n[Attached files: ${attachments.map((a) => `${a.name} (${a.mime})`).join(', ')}]` : '';
  const chatHistory: ChatMsg[] = history.map((m, i) => ({
    role: m.role as 'user' | 'assistant',
    content: i === history.length - 1 && m.role === 'user' ? m.content + attachNote : m.content,
  }));

  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Json) => { try { controller.enqueue(enc.encode(JSON.stringify(event) + '\n')); } catch { /* client went away */ } };
      let finalText = '';
      try {
        send({ type: 'conversation', conversationId: convId, title });
        send({ type: 'message_start', messageId: assistant.id });

        const scratch: string[] = [];
        // Same tool + same args twice means the model is looping; stop calling tools.
        const called: string[] = [];

        // Phase 1: tool loop (decide whether a tool is needed).
        if (enabledTools.length) {
          const toolList = enabledTools.map((t) => `- ${t}: ${TOOL_SPECS[t].description} args: ${TOOL_SPECS[t].args}`).join('\n');
          for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
            const instruction = `${systemPrompt}

You can call ONE tool per step. Available tools:
${toolList}

Decide the next step. Respond with ONLY a JSON object, no prose, no code fences:
- To call a tool: {"action":"tool","tool":"<name>","args":{...}}
- If no tool is needed (or you have enough information): {"action":"final"}
Only call a tool when it clearly helps (current facts, exact math, weather, time, attached files).` +
              (scratch.length ? `\n\nTool results so far:\n${scratch.join('\n')}` : '');
            const { text } = await complete(model, [{ role: 'system', content: instruction }, ...chatHistory], 1200, TOOL_TIMEOUT_MS);
            const act = parseAction(text);
            if (act?.action === 'tool' && act.tool && enabledTools.includes(act.tool)) {
              const signature = `${act.tool}:${JSON.stringify(act.args ?? {})}`;
              if (called.includes(signature)) break; // duplicate call -> answer with what we have
              called.push(signature);
              const callId = `call_${crypto.randomUUID()}`;
              const args = (act.args && typeof act.args === 'object' ? act.args : {}) as Json;
              send({ type: 'tool_call', id: callId, name: act.tool, arguments: args });
              const started = Date.now();
              const outcome = await runTool(base44, act.tool, args, attachments);
              const durationMs = Date.now() - started;
              const status = outcome.ok ? 'success' : 'error';
              send({ type: 'tool_result', id: callId, name: act.tool, result: outcome.data, status, error: outcome.error, durationMs });
              await base44.entities.ToolCall.create({
                message_id: assistant.id, conversation_id: convId, name: act.tool, arguments: args,
                result: (outcome.data ?? {}) as Json, status, error: outcome.error ?? '', duration_ms: durationMs,
              }).catch(() => {});
              scratch.push(`[${act.tool}] ${JSON.stringify(outcome.ok ? outcome.data : { error: outcome.error }).slice(0, 8000)}`);
              continue;
            }
            break; // "final", unparsable, or disabled tool -> go answer
          }
        }

        // Phase 2: stream the final answer token-by-token.
        const answerSystem = systemPrompt + (scratch.length
          ? `\n\nUse these tool results to answer. Do not mention the JSON protocol.\n${scratch.join('\n')}` : '');
        for await (const part of streamComplete(model, [{ role: 'system', content: answerSystem }, ...chatHistory])) {
          if (part.delta) { finalText += part.delta; send({ type: 'delta', text: part.delta }); }
        }
        finalText = finalText.trim();
        if (!finalText) throw new Error('The model returned an empty answer. Please try again.');

        await base44.entities.Message.update(assistant.id, { content: finalText, status: 'complete' });
        await base44.entities.Conversation.update(convId, { last_message_at: new Date().toISOString(), model });
        send({ type: 'message_end', messageId: assistant.id, content: finalText });
        send({ type: 'done' });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unexpected error';
        // A failed turn that produced nothing must not leave an empty answer behind
        // (it would show up as a blank variant). Keep partial text, drop empty rows.
        if (finalText.trim()) await base44.entities.Message.update(assistant.id, { content: finalText, status: 'error' }).catch(() => {});
        else {
          const calls = (await base44.entities.ToolCall.filter({ message_id: assistant.id }, 'created_date', 50).catch(() => [])) as any[];
          await Promise.all(calls.map((c) => base44.entities.ToolCall.delete(c.id).catch(() => {})));
          await base44.entities.Message.delete(assistant.id).catch(() => {});
        }
        send({ type: 'error', message });
        send({ type: 'done' });
      } finally {
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-cache, no-transform' },
  });
});
