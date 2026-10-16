import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface Params {
  params: Promise<{ id: string }>;
}

/** GET /api/conversations/:id → conversation + messages + tool calls */
export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (convError) return NextResponse.json({ error: convError.message }, { status: 500 });
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: messages, error: msgError } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  if (msgError) return NextResponse.json({ error: msgError.message }, { status: 500 });

  const messageIds = (messages ?? []).map((m) => m.id);
  let toolCalls: unknown[] = [];
  if (messageIds.length > 0) {
    const { data } = await supabase
      .from("tool_calls")
      .select("*")
      .in("message_id", messageIds)
      .order("created_at", { ascending: true });
    toolCalls = data ?? [];
  }

  const byMessage = new Map<string, unknown[]>();
  for (const tc of toolCalls as Array<{ message_id: string }>) {
    const list = byMessage.get(tc.message_id) ?? [];
    list.push(tc);
    byMessage.set(tc.message_id, list);
  }

  return NextResponse.json({
    conversation,
    messages: (messages ?? []).map((m) => ({
      ...m,
      tool_calls: byMessage.get(m.id) ?? [],
    })),
  });
}

/** PATCH /api/conversations/:id → rename / pin / archive / change model */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if (typeof body.title === "string") patch.title = body.title.trim().slice(0, 200) || "New chat";
  if (typeof body.pinned === "boolean") patch.pinned = body.pinned;
  if (typeof body.archived === "boolean") patch.archived = body.archived;
  if (typeof body.model === "string") patch.model = body.model;
  if (typeof body.system_prompt === "string") patch.system_prompt = body.system_prompt;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("conversations")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ conversation: data });
}

/** DELETE /api/conversations/:id → cascade-deletes messages and tool calls */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { error } = await supabase
    .from("conversations")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
