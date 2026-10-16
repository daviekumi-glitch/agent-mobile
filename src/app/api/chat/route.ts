import { NextResponse, type NextRequest } from "next/server";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { createClient } from "@/lib/supabase/server";
import { getLLMClient, DEFAULT_MODEL, DEFAULT_SYSTEM_PROMPT, isKnownModel } from "@/lib/ai/client";
import { withRetry } from "@/lib/ai/retry";
import { availableToolNames, toOpenAITools } from "@/lib/tools/registry";
import { executeTool } from "@/lib/tools/executor";
import { deriveTitle } from "@/lib/utils";
import type {
  Attachment,
  ChatMode,
  ChatRequestBody,
  ChatStreamEvent,
  ToolCallStatus,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_TOOL_ITERATIONS = 5;
/**
 * How many prior messages to replay into the model.
 *
 * The query takes the *newest* N rows and reverses them, so a long thread
 * always keeps its most recent context instead of the first N messages ever
 * sent (which is what a naive ascending `limit` returns).
 */
const HISTORY_LIMIT = 60;

interface HistoryRow {
  id: string;
  role: string;
  content: string;
  attachments: Attachment[] | null;
  created_at: string;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const mode: ChatMode =
    body.mode === "regenerate" || body.mode === "edit" ? body.mode : "send";

  let userText = (body.message ?? "").trim();
  if (mode !== "regenerate" && !userText) {
    return NextResponse.json({ error: "`message` is required" }, { status: 400 });
  }

  const model = isKnownModel(body.model) ? body.model : DEFAULT_MODEL;
  let attachments: Attachment[] = Array.isArray(body.attachments) ? body.attachments : [];
  const systemPrompt = body.systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT;

  // --- Resolve the conversation -------------------------------------------
  let conversationId = body.conversationId;
  let title = deriveTitle(userText);

  if (conversationId) {
    const { data: existing } = await supabase
      .from("conversations")
      .select("id, title")
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
    title = existing.title;
  } else {
    if (mode !== "send") {
      return NextResponse.json(
        { error: "`conversationId` is required for this mode" },
        { status: 400 },
      );
    }
    const { data: created, error } = await supabase
      .from("conversations")
      .insert({ user_id: user.id, title, model })
      .select("id")
      .single();

    if (error || !created) {
      return NextResponse.json(
        { error: error?.message ?? "Could not create conversation" },
        { status: 500 },
      );
    }
    conversationId = created.id;
  }

  const convId = conversationId as string;

  // --- Mode-specific preparation ------------------------------------------
  if (mode === "regenerate") {
    // Reuse the last user turn verbatim. The previous answer is deliberately
    // KEPT: it stays in the thread as an earlier variant of this same turn,
    // which is exactly what the variant switcher in the UI reads.
    const { data: lastUser } = await supabase
      .from("messages")
      .select("id, content, attachments, created_at")
      .eq("conversation_id", convId)
      .eq("user_id", user.id)
      .eq("role", "user")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!lastUser) {
      return NextResponse.json({ error: "Nothing to regenerate" }, { status: 400 });
    }

    userText = lastUser.content as string;
    if ((lastUser.attachments as Attachment[] | null)?.length) {
      attachments = lastUser.attachments as Attachment[];
    }

    // Nothing is deleted here. Deleting the previous reply is what previously
    // made the variant switcher dead code: the client-side grouping in
    // src/lib/variants.ts can only offer a choice when more than one assistant
    // message answers the same turn. An interrupted turn's empty placeholder is
    // already removed by the catch block below, and the client filters any that
    // survive, so no cleanup is needed to keep blank bubbles out of the thread.
  }

  if (mode === "edit") {
    if (!body.targetMessageId) {
      return NextResponse.json(
        { error: "`targetMessageId` is required when editing" },
        { status: 400 },
      );
    }

    const { data: target } = await supabase
      .from("messages")
      .select("id, role, created_at")
      .eq("id", body.targetMessageId)
      .eq("conversation_id", convId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!target) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }
    if (target.role !== "user") {
      return NextResponse.json({ error: "Only user messages can be edited" }, { status: 400 });
    }

    await supabase
      .from("messages")
      .update({ content: userText, attachments })
      .eq("id", target.id)
      .eq("user_id", user.id);

    // Everything after an edited message is invalidated, so the model answers
    // the corrected prompt instead of continuing the old branch.
    await supabase
      .from("messages")
      .delete()
      .eq("conversation_id", convId)
      .eq("user_id", user.id)
      .gt("created_at", target.created_at as string);
  }

  // --- Persist the user message (send mode only) --------------------------
  if (mode === "send") {
    const { error: userMsgError } = await supabase.from("messages").insert({
      conversation_id: convId,
      user_id: user.id,
      role: "user",
      content: userText,
      attachments,
    });

    if (userMsgError) {
      return NextResponse.json({ error: userMsgError.message }, { status: 500 });
    }
  }

  // --- Create the assistant message row up-front so tool calls can attach --
  const { data: assistantRow, error: assistantError } = await supabase
    .from("messages")
    .insert({
      conversation_id: convId,
      user_id: user.id,
      role: "assistant",
      content: "",
      model,
    })
    .select("id")
    .single();

  if (assistantError || !assistantRow) {
    return NextResponse.json(
      { error: assistantError?.message ?? "Could not create message" },
      { status: 500 },
    );
  }

  const assistantMessageId = assistantRow.id;

  // --- Build the LLM message history --------------------------------------
  // Newest-first + reverse keeps the most recent context for long threads.
  const { data: historyDesc } = await supabase
    .from("messages")
    .select("id, role, content, attachments, created_at")
    .eq("conversation_id", convId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  const history = ((historyDesc ?? []) as HistoryRow[]).slice().reverse();

  const llmMessages: ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
  ];

  for (const row of history) {
    if (row.role === "system") continue;
    // Skip the assistant placeholder we just created, and any previously
    // interrupted assistant turn that never produced text.
    if (row.role === "assistant" && (!row.content || row.id === assistantMessageId)) continue;

    let content = row.content;
    const rowAttachments = row.attachments ?? [];
    if (row.role === "user" && rowAttachments.length > 0) {
      const list = rowAttachments.map((a) => `${a.name} (${a.mime})`).join(", ");
      content += `\n\n[Attached files: ${list}. Use the read_file tool to read their contents.]`;
    }
    llmMessages.push({ role: row.role as "user" | "assistant", content });
  }

  // --- Enabled tools -------------------------------------------------------
  const requested = Array.isArray(body.enabledTools) ? body.enabledTools : [];
  const available = availableToolNames();
  const enabled = requested.length > 0 ? requested.filter((t) => available.includes(t as never)) : available;
  const openaiTools = toOpenAITools(enabled);

  // --- Stream --------------------------------------------------------------
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatStreamEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      let fullText = "";

      try {
        send({ type: "conversation", conversationId: convId, title });
        send({ type: "message_start", messageId: assistantMessageId });

        const client = getLLMClient();
        const working: ChatCompletionMessageParam[] = [...llmMessages];

        for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
          let iterationText = "";

          // Establishing the stream is the part worth retrying: a 429 while a
          // rate limit resets, or a 502/503 from a load balancer, is transient.
          // Once this iteration has emitted any text a retry would replay it,
          // so `hasProducedOutput` stops that and the error surfaces instead.
          const completion = await withRetry(
            () =>
              client.chat.completions.create(
                {
                  model,
                  messages: working,
                  stream: true,
                  ...(openaiTools.length > 0
                    ? { tools: openaiTools, tool_choice: "auto" as const }
                    : {}),
                },
                { signal: request.signal },
              ),
            {
              maxAttempts: 3,
              hasProducedOutput: () => iterationText.length > 0,
              onRetry: ({ attempt, delayMs, error }) => {
                console.warn(
                  `[chat] model call failed (attempt ${attempt}), retrying in ${delayMs}ms:`,
                  error instanceof Error ? error.message : error,
                );
              },
            },
          );
          const pendingCalls = new Map<
            number,
            { id: string; name: string; args: string }
          >();
          let finishReason: string | null = null;

          for await (const chunk of completion) {
            const choice = chunk.choices[0];
            if (!choice) continue;

            const delta = choice.delta;

            if (delta?.content) {
              iterationText += delta.content;
              fullText += delta.content;
              send({ type: "delta", text: delta.content });
            }

            for (const tc of delta?.tool_calls ?? []) {
              const idx = tc.index ?? 0;
              const entry = pendingCalls.get(idx) ?? { id: "", name: "", args: "" };
              if (tc.id) entry.id = tc.id;
              if (tc.function?.name) entry.name = tc.function.name;
              if (tc.function?.arguments) entry.args += tc.function.arguments;
              pendingCalls.set(idx, entry);
            }

            if (choice.finish_reason) finishReason = choice.finish_reason;
          }

          // No tool calls → the turn is complete.
          if (pendingCalls.size === 0 || finishReason !== "tool_calls") {
            break;
          }

          // --- Execute the requested tools ---------------------------------
          const calls = [...pendingCalls.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([, v]) => v)
            .filter((c) => c.name);

          working.push({
            role: "assistant",
            content: iterationText || null,
            tool_calls: calls.map((c) => ({
              id: c.id || `call_${crypto.randomUUID()}`,
              type: "function" as const,
              function: { name: c.name, arguments: c.args || "{}" },
            })),
          });

          for (const call of calls) {
            const callId = call.id || `call_${crypto.randomUUID()}`;
            let parsedArgs: Record<string, unknown> = {};
            try {
              parsedArgs = call.args ? (JSON.parse(call.args) as Record<string, unknown>) : {};
            } catch {
              parsedArgs = { _raw: call.args };
            }

            send({ type: "tool_call", id: callId, name: call.name, arguments: parsedArgs });

            const startedAt = Date.now();
            const outcome = await executeTool(call.name, parsedArgs, {
              attachments,
              signal: request.signal,
            });
            const durationMs = Date.now() - startedAt;
            const status: ToolCallStatus = outcome.ok ? "success" : "error";

            send({
              type: "tool_result",
              id: callId,
              name: call.name,
              result: outcome.data,
              status,
              error: outcome.error,
              durationMs,
            });

            // Persist the tool call for replay on reload.
            await supabase.from("tool_calls").insert({
              message_id: assistantMessageId,
              name: call.name,
              arguments: parsedArgs,
              result: (outcome.data ?? null) as never,
              status,
              error: outcome.error ?? null,
              duration_ms: durationMs,
            });

            working.push({
              role: "tool",
              tool_call_id: callId,
              content: JSON.stringify(
                outcome.ok ? outcome.data : { error: outcome.error },
              ).slice(0, 20_000),
            });
          }
        }

        // --- Finalise ------------------------------------------------------
        await supabase
          .from("messages")
          .update({ content: fullText })
          .eq("id", assistantMessageId)
          .eq("user_id", user.id);

        await supabase
          .from("conversations")
          .update({ last_message_at: new Date().toISOString(), model })
          .eq("id", convId)
          .eq("user_id", user.id);

        send({ type: "message_end", messageId: assistantMessageId, content: fullText });
        send({ type: "done" });
      } catch (err) {
        const aborted = request.signal.aborted;
        const message = aborted
          ? "Generation stopped."
          : err instanceof Error
            ? err.message
            : "The model request failed.";

        // Keep whatever text we already produced.
        if (fullText) {
          await supabase
            .from("messages")
            .update({ content: fullText })
            .eq("id", assistantMessageId)
            .eq("user_id", user.id)
            .then(undefined, () => {});
        } else {
          // The turn produced nothing usable — remove the empty placeholder so
          // a retry does not leave a blank assistant bubble in the thread.
          await supabase
            .from("messages")
            .delete()
            .eq("id", assistantMessageId)
            .eq("user_id", user.id)
            .then(undefined, () => {});
        }

        if (!aborted) send({ type: "error", message });
        send({ type: "done" });
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
