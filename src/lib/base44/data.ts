import { base44 } from "./client";
import type { Attachment, Conversation, Message, ToolCallRecord } from "@/lib/types";

// ---------------------------------------------------------------------------
// Data access over Base44 entities. Records are mapped to the app's existing
// domain types so UI components stay unchanged.
// Row-level isolation is enforced server-side by Base44 (users only see
// records they created).
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
const E = () => (base44.entities as any);

export function toConversation(r: any): Conversation {
  return {
    id: r.id,
    user_id: r.created_by_id ?? r.created_by ?? "me",
    title: r.title || "New chat",
    model: r.model || "gpt_5_mini",
    system_prompt: r.system_prompt ?? null,
    pinned: Boolean(r.pinned),
    archived: Boolean(r.archived),
    last_message_at: r.last_message_at || r.updated_date || r.created_date,
    created_at: r.created_date,
    updated_at: r.updated_date,
  };
}

export function toMessage(r: any): Message {
  return {
    id: r.id,
    conversation_id: r.conversation_id,
    user_id: r.created_by_id ?? "me",
    role: r.role,
    content: r.content ?? "",
    model: r.model ?? null,
    attachments: (r.attachments ?? []) as Attachment[],
    token_count: null,
    created_at: r.created_date,
  };
}

export function toToolCall(r: any): ToolCallRecord {
  return {
    id: r.id,
    message_id: r.message_id,
    name: r.name,
    arguments: (r.arguments ?? {}) as Record<string, unknown>,
    result: r.result ?? null,
    status: r.status ?? "success",
    error: r.error || null,
    duration_ms: r.duration_ms ?? null,
    created_at: r.created_date,
  };
}

export async function listConversations(): Promise<Conversation[]> {
  const rows = await E().Conversation.list("-last_message_at", 200);
  return (rows as any[]).filter((r) => !r.archived).map(toConversation);
}

export async function getConversation(id: string) {
  const [convo] = await E().Conversation.filter({ id });
  if (!convo) return null;
  const [msgs, calls] = await Promise.all([
    E().Message.filter({ conversation_id: id }, "created_date", 500),
    E().ToolCall.filter({ conversation_id: id }, "created_date", 500),
  ]);
  const byMessage = new Map<string, ToolCallRecord[]>();
  for (const c of calls as any[]) {
    const list = byMessage.get(c.message_id) ?? [];
    list.push(toToolCall(c));
    byMessage.set(c.message_id, list);
  }
  const messages = (msgs as any[])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ ...toMessage(m), tool_calls: byMessage.get(m.id) ?? [] }));
  return { conversation: toConversation(convo), messages };
}

export const updateConversation = (id: string, patch: Partial<{ title: string; pinned: boolean; archived: boolean; model: string }>) =>
  E().Conversation.update(id, patch);

export async function deleteConversation(id: string) {
  const [msgs, calls] = await Promise.all([
    E().Message.filter({ conversation_id: id }, "created_date", 1000),
    E().ToolCall.filter({ conversation_id: id }, "created_date", 1000),
  ]);
  await Promise.all([
    ...(msgs as any[]).map((m) => E().Message.delete(m.id)),
    ...(calls as any[]).map((c) => E().ToolCall.delete(c.id)),
  ]);
  await E().Conversation.delete(id);
}

/** Delete one message together with its tool-call records. */
export async function deleteMessage(id: string) {
  const calls = (await E().ToolCall.filter({ message_id: id }, "created_date", 200).catch(() => [])) as any[];
  await Promise.all(calls.map((c) => E().ToolCall.delete(c.id).catch(() => {})));
  await E().Message.delete(id);
}

// --- Storage ----------------------------------------------------------------
export async function uploadAttachment(file: File): Promise<Attachment> {
  const MAX = 10 * 1024 * 1024;
  if (file.size > MAX) throw new Error("File exceeds the 10 MB limit");
  const { file_url } = await base44.integrations.Core.UploadFile({ file });

  let text: string | undefined;
  const isText =
    file.type.startsWith("text/") ||
    file.type === "application/json" ||
    /\.(md|txt|csv|json|ts|tsx|js|jsx|py|sql|yml|yaml|toml)$/i.test(file.name);
  if (isText && file.size <= 256 * 1024) text = await file.text();

  return {
    id: crypto.randomUUID(),
    name: file.name,
    mime: file.type || "application/octet-stream",
    size: file.size,
    url: file_url,
    text,
  };
}

// --- Realtime ---------------------------------------------------------------
export type Unsubscribe = () => void;

/** Live updates for the sidebar (create / update / delete from any device). */
export function subscribeConversations(cb: (type: string, c: Conversation, id: string) => void): Unsubscribe {
  return E().Conversation.subscribe((evt: any) => cb(evt.type, toConversation(evt.data ?? { id: evt.id }), evt.id));
}

/** Live updates for messages (e.g. the same chat open in another tab/device). */
export function subscribeMessages(cb: (type: string, m: Message, id: string) => void): Unsubscribe {
  return E().Message.subscribe((evt: any) => cb(evt.type, toMessage(evt.data ?? { id: evt.id }), evt.id));
}

// --- Profile / settings -----------------------------------------------------
export interface ProfileSettings {
  default_model: string | null;
  system_prompt: string | null;
  display_name: string | null;
}

const MAX_PROMPT_LENGTH = 8000;

/** Settings stored on the signed-in user's own User record. */
export async function getProfileSettings(): Promise<ProfileSettings> {
  const me = (await base44.auth.me()) as Record<string, unknown>;
  return {
    default_model: (me.default_model as string) || null,
    system_prompt: (me.system_prompt as string) || null,
    display_name: (me.full_name as string) || null,
  };
}

export async function saveProfileSettings(
  patch: Partial<{ default_model: string; system_prompt: string | null }>,
): Promise<void> {
  const body: Record<string, unknown> = {};
  if (patch.default_model !== undefined) {
    const v = patch.default_model.trim();
    if (!v) throw new Error("Choose a model.");
    body.default_model = v.slice(0, 64);
  }
  if (patch.system_prompt !== undefined) {
    const v = (patch.system_prompt ?? "").trim();
    if (v.length > MAX_PROMPT_LENGTH) {
      throw new Error(`Custom instructions must be ${MAX_PROMPT_LENGTH} characters or fewer.`);
    }
    body.system_prompt = v;
  }
  if (Object.keys(body).length === 0) throw new Error("Nothing to save.");
  await base44.auth.updateMe(body);
}
