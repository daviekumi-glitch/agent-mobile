import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MODELS } from "@/lib/ai/client";
import { TOOLS, SKILLS, availableToolNames } from "@/lib/tools/registry";

/**
 * GET /api/tools
 * Returns the model list, the skill bundles, and which tools are actually
 * usable in this deployment (env vars present).
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const available = availableToolNames();

  return NextResponse.json({
    models: MODELS,
    skills: SKILLS,
    tools: TOOLS.map((t) => ({
      name: t.name,
      label: t.label,
      description: t.description,
      icon: t.icon,
      skill: t.skill,
      available: available.includes(t.name),
      requiresEnv: t.requiresEnv ?? null,
    })),
  });
}
