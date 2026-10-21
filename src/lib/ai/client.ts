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
    id: "gpt-oss-20b",
    label: "GPT-OSS 20B",
    description: "Fast, reliable default. Handles tools well.",
    provider: "NVIDIA",
    context: "128K",
    tools: true,
  },
  {
    id: "gemma-4-31b",
    label: "Gemma 4 31B",
    description: "Google's latest open model, large context.",
    provider: "OpenRouter",
    context: "262K",
    tools: true,
  },
  {
    id: "gemma-4-26b",
    label: "Gemma 4 26B",
    description: "Lighter Gemma variant, quick responses.",
    provider: "OpenRouter",
    context: "262K",
    tools: true,
  },
];

/**
 * The model a conversation falls back to. Exported so the client store seeds
 * its initial state from the same source of truth as the picker.
 */
export const DEFAULT_MODEL = "gpt-oss-20b";

/** True when `id` names a model in the catalog. Narrows the type for callers. */
export function isKnownModel(id: string | null | undefined): id is string {
  return MODELS.some((m) => m.id === id);
}
