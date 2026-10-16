import { NextResponse, type NextRequest } from "next/server";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { createClient } from "@/lib/supabase/server";
import { getLLMClient, DEFAULT_MODEL, DEFAULT_SYSTEM_PROMPT, isKnownModel } from "@/lib/ai/client";
import { availableToolNames, toOpenAITools } from "@/lib/tools/registry";
import { executeTool } from "@/lib/tools/executor";
import { deriveTitle } from "@/lib/utils";
import type { Attachment, ChatRequestBody, ChatStreamEvent, ToolCallStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_TOOL_ITERATIONS = 5;
const HISTORY_LIMIT = 30;

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

  const userText = (body.message ?? "").trim();
  if (!userText) {
    return NextResponse.json({ error: "`message` is required" }, { status: 400 });
  }

  const model = isKnownModel(body.model) ? body.model : DEFAULT_MODEL;
  const attachments: Attachment[] = Array.isArray(body.attachments) ? body.attachments : [];
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

  // --- Persist the user message -------------------------------------------
  const { error: userMsgError } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    user_id: user.id,
    role: "user",
    content: userText,
    attachments,
  });

  if (userMsgError) {
    return NextResponse.json({ error: userMsgError.message }, { status: 500 });
  }

  // --- Create the assistant message row up-front so tool calls can attach --
  const { data: assistantRow, error: assistantError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
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
  const convId = conversationId as string;

  // --- Build the LLM message history --------------------------------------
  const { data: history } = await supabase
    .from("messages")
    .select("role, content, attachments, created_at")
    .eq("conversation_id", convId)
    .order("created_at", { ascending: true })
    .limit(HISTORY_LIMIT);

  const llmMessages: ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
  ];

  for (const row of history ?? []) {
    if (row.role === "system") continue;
    // Skip the empty assistant placeholder we just created.
    if (row.role === "assistant" && !row.content) continue;

    let content = row.content as string;
    const rowAttachments = (row.attachments ?? []) as Attachment[];
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
      let aborted = false;

      try {
        send({ type: "conversation", conversationId: convId, title });
        send({ type: "message_start", messageId: assistantMessageId });

        const client = getLLMClient();
        const working: ChatCompletionMessageParam[] = [...llmMessages];

        for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
          const completion = await client.chat.completions.create(
            {
              model,
              messages: working,
              stream: true,
              ...(openaiTools.length > 0
                ? { tools: openaiTools, tool_choice: "auto" as const }
                : {}),
            },
            { signal: request.signal },
          );

          let iterationText = "";
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
        aborted = request.signal.aborted;
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
