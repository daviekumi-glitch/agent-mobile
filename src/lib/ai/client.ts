import OpenAI from "openai";

/**
 * Shared OpenAI-compatible client.
 * Point OPENAI_BASE_URL at any compatible gateway (OpenRouter, Groq, vLLM…).
 */
export function getLLMClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to .env.local to enable chat completions.",
    );
  }
  return new OpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
  });
}

export interface ModelOption {
  id: string;
  label: string;
  description: string;
  /** Rough context window, shown in the picker. */
  context: string;
  /** Whether the model supports tool calling. */
  tools: boolean;
}

export const MODELS: ModelOption[] = [
  {
    id: "gpt-4o-mini",
    label: "GPT-4o mini",
    description: "Fast and cheap — great default for everyday chat.",
    context: "128K",
    tools: true,
  },
  {
    id: "gpt-4o",
    label: "GPT-4o",
    description: "Stronger reasoning and better tool use.",
    context: "128K",
    tools: true,
  },
  {
    id: "gpt-4.1",
    label: "GPT-4.1",
    description: "Long-context flagship for complex coding tasks.",
    context: "1M",
    tools: true,
  },
  {
    id: "gpt-4.1-mini",
    label: "GPT-4.1 mini",
    description: "Balanced speed and quality with a large context.",
    context: "1M",
    tools: true,
  },
  {
    id: "o4-mini",
    label: "o4-mini",
    description: "Reasoning model — slower, better at hard problems.",
    context: "200K",
    tools: true,
  },
];

export const DEFAULT_MODEL = "gpt-4o-mini";

export function isKnownModel(id: string): boolean {
  return MODELS.some((m) => m.id === id);
}

export const DEFAULT_SYSTEM_PROMPT = `You are Agent Mobile, a helpful, precise AI assistant.

Guidelines:
- Answer directly and lead with the result. Skip preamble like "Great question!".
- Use GitHub-flavoured Markdown. Put code in fenced blocks with a language tag.
- When a tool would give a better answer, call it instead of guessing. Never invent
  tool output, URLs, or citations.
- If a tool fails, say so plainly and continue with what you know.
- Be concise by default; expand only when the question genuinely needs depth.`;
