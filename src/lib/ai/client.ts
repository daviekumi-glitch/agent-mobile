// ---------------------------------------------------------------------------
// Model catalog (client side).
//
// The browser never talks to an AI provider and never holds an API key. Chat
// requests go to the Base44 `agentChat` function, which owns the NVIDIA and
// OpenRouter keys as backend secrets and walks a fallback chain when a provider
// is rate limited or down.
//
// IDs here MUST match the MODELS allow-list in base44/functions/agentChat.ts.
// Only models that were verified to answer are listed.
// ---------------------------------------------------------------------------

export interface ModelOption {
  id: string;
  label: string;
  description: string;
  /** Provider that serves the model first. */
  provider: "NVIDIA" | "OpenRouter";
  /** Rough context window, shown in the picker. */
  context: string;
  /** Whether the model supports tool calling. */
  tools: boolean;
}

export const MODELS: ModelOption[] = [
  {
    id: "nemotron-super",
    label: "Nemotron 3 Super 120B",
    description: "Strong general reasoning and tool use. The default.",
    provider: "NVIDIA",
    context: "262K",
    tools: true,
  },
  {
    id: "gpt-oss-20b",
    label: "GPT-OSS 20B",
    description: "Very fast open-weight model for everyday chat.",
    provider: "NVIDIA",
    context: "128K",
    tools: true,
  },
  {
    id: "nemotron-super-or",
    label: "Nemotron 3 Super (OpenRouter)",
    description: "Same model served through OpenRouter.",
    provider: "OpenRouter",
    context: "262K",
    tools: true,
  },
  {
    id: "nemotron-omni-or",
    label: "Nemotron Omni 30B (OpenRouter)",
    description: "Compact reasoning model, quick responses.",
    provider: "OpenRouter",
    context: "256K",
    tools: true,
  },
];

/**
 * The model a conversation falls back to. Exported so the client store seeds
 * its initial state from the same source of truth as the picker.
 */
export const DEFAULT_MODEL = "nemotron-super";

/** True when `id` names a model in the catalog. Narrows the type for callers. */
export function isKnownModel(id: string | null | undefined): id is string {
  return MODELS.some((m) => m.id === id);
}
