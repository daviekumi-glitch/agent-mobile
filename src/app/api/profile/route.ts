import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// GET  /api/profile  — the caller's profile (default model, system prompt)
// PATCH /api/profile — update those preferences
//
// No service-role key here on purpose: every read and write goes through the
// user-scoped client so the `profiles_*_own` RLS policies remain the actual
// enforcement point. A user can only ever touch their own row.
// ---------------------------------------------------------------------------

const MAX_PROMPT_LENGTH = 8000;
const MAX_MODEL_LENGTH = 64;

/** Only these columns are user-writable through this endpoint. */
interface ProfilePatch {
  default_model?: string;
  system_prompt?: string | null;
  display_name?: string | null;
}

function parsePatch(body: unknown): { patch: ProfilePatch } | { error: string } {
  if (typeof body !== "object" || body === null) {
    return { error: "Body must be a JSON object." };
  }

  const input = body as Record<string, unknown>;
  const patch: ProfilePatch = {};

  if ("default_model" in input) {
    const value = input.default_model;
    if (typeof value !== "string" || !value.trim()) {
      return { error: "`default_model` must be a non-empty string." };
    }
    if (value.length > MAX_MODEL_LENGTH) {
      return { error: `\`default_model\` must be ${MAX_MODEL_LENGTH} characters or fewer.` };
    }
    patch.default_model = value.trim();
  }

  if ("system_prompt" in input) {
    const value = input.system_prompt;
    if (value !== null && typeof value !== "string") {
      return { error: "`system_prompt` must be a string or null." };
    }
    if (typeof value === "string" && value.length > MAX_PROMPT_LENGTH) {
      return { error: `\`system_prompt\` must be ${MAX_PROMPT_LENGTH} characters or fewer.` };
    }
    const trimmed = typeof value === "string" ? value.trim() : null;
    patch.system_prompt = trimmed ? trimmed : null;
  }

  if ("display_name" in input) {
    const value = input.display_name;
    if (value !== null && typeof value !== "string") {
      return { error: "`display_name` must be a string or null." };
    }
    const trimmed = typeof value === "string" ? value.trim().slice(0, 80) : null;
    patch.display_name = trimmed ? trimmed : null;
  }

  if (Object.keys(patch).length === 0) {
    return { error: "No supported fields were provided." };
  }

  return { patch };
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parsePatch(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  // A profile row is created by the `on_auth_user_created` trigger at signup,
  // but an upsert keeps this endpoint working for accounts that predate it.
  const { data, error } = await supabase
    .from("profiles")
    .upsert({ id: user.id, ...parsed.patch }, { onConflict: "id" })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}
