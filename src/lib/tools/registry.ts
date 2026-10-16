// ---------------------------------------------------------------------------
// Tool / skill registry.
//
// A "skill" is a named bundle of tools the model may call. The registry is the
// single source of truth for: the JSON schema handed to the LLM, the metadata
// rendered in the Tools & Skills panel, and the server-side executor.
// ---------------------------------------------------------------------------

export type ToolName =
  | "web_search"
  | "run_code"
  | "generate_image"
  | "read_file"
  | "get_current_time";

export interface ToolDefinition {
  name: ToolName;
  /** Human label shown in the UI. */
  label: string;
  /** One-line description shown in the Tools & Skills panel. */
  description: string;
  /** Lucide icon name, resolved in the UI. */
  icon: string;
  /** Which skill bundle this tool belongs to. */
  skill: SkillId;
  /** JSON Schema for the model's function-calling interface. */
  parameters: Record<string, unknown>;
  /** True when the tool needs an env var that may be missing. */
  requiresEnv?: string;
}

export type SkillId = "research" | "code" | "media" | "files" | "utility";

export interface SkillDefinition {
  id: SkillId;
  label: string;
  description: string;
  icon: string;
  tools: ToolName[];
}

export const SKILLS: SkillDefinition[] = [
  {
    id: "research",
    label: "Web Research",
    description: "Search the live web and read pages for up-to-date answers.",
    icon: "Globe",
    tools: ["web_search"],
  },
  {
    id: "code",
    label: "Code Execution",
    description: "Run JavaScript in a sandbox to compute, parse or transform data.",
    icon: "Terminal",
    tools: ["run_code"],
  },
  {
    id: "media",
    label: "Image Generation",
    description: "Create images from a text prompt and render them inline.",
    icon: "Image",
    tools: ["generate_image"],
  },
  {
    id: "files",
    label: "File Reading",
    description: "Read text content out of files attached to the conversation.",
    icon: "FileText",
    tools: ["read_file"],
  },
  {
    id: "utility",
    label: "Utilities",
    description: "Small helpers such as the current date and time.",
    icon: "Wrench",
    tools: ["get_current_time"],
  },
];

export const TOOLS: ToolDefinition[] = [
  {
    name: "web_search",
    label: "Web search",
    description: "Search the web for current information and return ranked results.",
    icon: "Globe",
    skill: "research",
    requiresEnv: "TAVILY_API_KEY",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "The search query." },
        max_results: {
          type: "integer",
          description: "How many results to return (1-8). Defaults to 5.",
          minimum: 1,
          maximum: 8,
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "run_code",
    label: "Run code",
    description: "Execute a JavaScript snippet in a sandbox and return its output.",
    icon: "Terminal",
    skill: "code",
    requiresEnv: "ENABLE_CODE_EXECUTION",
    parameters: {
      type: "object",
      properties: {
        code: {
          type: "string",
          description:
            "JavaScript to execute. Use `return` to produce a value, or console.log to emit output.",
        },
      },
      required: ["code"],
      additionalProperties: false,
    },
  },
  {
    name: "generate_image",
    label: "Generate image",
    description: "Generate an image from a text prompt and return its URL.",
    icon: "Image",
    skill: "media",
    requiresEnv: "OPENAI_API_KEY",
    parameters: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "A detailed description of the image." },
        size: {
          type: "string",
          enum: ["1024x1024", "1024x1536", "1536x1024"],
          description: "Output size. Defaults to 1024x1024.",
        },
      },
      required: ["prompt"],
      additionalProperties: false,
    },
  },
  {
    name: "read_file",
    label: "Read file",
    description: "Read the text content of a file attached to this conversation.",
    icon: "FileText",
    skill: "files",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "The attachment filename to read, e.g. 'notes.md'.",
        },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "get_current_time",
    label: "Current time",
    description: "Return the current date and time in a given IANA timezone.",
    icon: "Clock",
    skill: "utility",
    parameters: {
      type: "object",
      properties: {
        timezone: {
          type: "string",
          description: "IANA timezone, e.g. 'Africa/Blantyre'. Defaults to UTC.",
        },
      },
      additionalProperties: false,
    },
  },
];

export const TOOL_MAP: Record<string, ToolDefinition> = Object.fromEntries(
  TOOLS.map((t) => [t.name, t]),
);

/** Tools whose required env var is present in this deployment. */
export function availableToolNames(): ToolName[] {
  return TOOLS.filter((t) => {
    if (!t.requiresEnv) return true;
    const value = process.env[t.requiresEnv];
    if (t.requiresEnv === "ENABLE_CODE_EXECUTION") return value === "1";
    return Boolean(value);
  }).map((t) => t.name);
}

/** OpenAI-style function definitions for the enabled subset. */
export function toOpenAITools(names: string[]) {
  return names
    .map((n) => TOOL_MAP[n])
    .filter(Boolean)
    .map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
}
