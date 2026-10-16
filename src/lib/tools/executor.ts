import type { Attachment } from "@/lib/types";
import { evaluate } from "@/lib/tools/calculator";
import { mapWeatherResponse, weatherUrl, type OpenWeatherResponse } from "@/lib/tools/weather";

// ---------------------------------------------------------------------------
// Server-side tool executors.
//
// Every executor returns a JSON-serialisable value and never throws — a
// failure is returned as { ok: false, error } so the model can recover and
// the UI can render an error tool-call card.
// ---------------------------------------------------------------------------

export interface ToolContext {
  attachments: Attachment[];
  signal?: AbortSignal;
}

export interface ToolOutcome {
  ok: boolean;
  /** Payload handed back to the model. */
  data: unknown;
  /** Present when ok === false. */
  error?: string;
}

const MAX_RESULT_CHARS = 12_000;

function truncate(value: unknown): unknown {
  const json = JSON.stringify(value);
  if (json.length <= MAX_RESULT_CHARS) return value;
  return {
    truncated: true,
    note: `Result exceeded ${MAX_RESULT_CHARS} characters and was truncated.`,
    preview: json.slice(0, MAX_RESULT_CHARS),
  };
}

// --- web_search -------------------------------------------------------------
async function webSearch(
  args: { query?: string; max_results?: number },
  ctx: ToolContext,
): Promise<ToolOutcome> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      data: null,
      error:
        "Web search is not configured on this deployment (TAVILY_API_KEY is missing). Answer from your own knowledge and say the search was unavailable.",
    };
  }
  const query = String(args.query ?? "").trim();
  if (!query) return { ok: false, data: null, error: "A non-empty `query` is required." };

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: Math.min(Math.max(args.max_results ?? 5, 1), 8),
      search_depth: "basic",
      include_answer: true,
    }),
    signal: ctx.signal,
  });

  if (!res.ok) {
    return { ok: false, data: null, error: `Search provider returned HTTP ${res.status}.` };
  }

  const json = (await res.json()) as {
    answer?: string;
    results?: Array<{ title: string; url: string; content: string }>;
  };

  return {
    ok: true,
    data: truncate({
      answer: json.answer ?? null,
      results: (json.results ?? []).map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.content?.slice(0, 600),
      })),
    }),
  };
}

// --- run_code ---------------------------------------------------------------
async function runCode(
  args: { code?: string },
): Promise<ToolOutcome> {
  if (process.env.ENABLE_CODE_EXECUTION !== "1") {
    return {
      ok: false,
      data: null,
      error:
        "Code execution is disabled on this deployment. Set ENABLE_CODE_EXECUTION=1 to enable it, or solve the problem without running code.",
    };
  }
  const code = String(args.code ?? "");
  if (!code.trim()) return { ok: false, data: null, error: "`code` must not be empty." };

  const logs: string[] = [];
  const sandboxConsole = {
    log: (...a: unknown[]) => logs.push(a.map(stringify).join(" ")),
    error: (...a: unknown[]) => logs.push(a.map(stringify).join(" ")),
    warn: (...a: unknown[]) => logs.push(a.map(stringify).join(" ")),
    info: (...a: unknown[]) => logs.push(a.map(stringify).join(" ")),
  };

  try {
    // NOTE: this runs in the app's own process. It is gated behind an explicit
    // opt-in env var and a hard timeout, but it is NOT a security boundary —
    // for untrusted multi-tenant use, move this to an isolated runner.
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (
      ...args: string[]
    ) => (...args: unknown[]) => Promise<unknown>;

    const fn = new AsyncFunction("console", `"use strict";\n${code}`);
    const result = await Promise.race([
      fn(sandboxConsole),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Execution timed out after 5000ms")), 5000),
      ),
    ]);

    return {
      ok: true,
      data: truncate({
        result: result === undefined ? null : result,
        logs,
      }),
    };
  } catch (err) {
    return {
      ok: false,
      data: { logs },
      error: err instanceof Error ? err.message : "Code execution failed.",
    };
  }
}

function stringify(v: unknown): string {
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

// --- generate_image ---------------------------------------------------------
async function generateImage(
  args: { prompt?: string; size?: string },
  ctx: ToolContext,
): Promise<ToolOutcome> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { ok: false, data: null, error: "Image generation is not configured (OPENAI_API_KEY missing)." };
  }
  const prompt = String(args.prompt ?? "").trim();
  if (!prompt) return { ok: false, data: null, error: "A non-empty `prompt` is required." };

  const base = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
  const res = await fetch(`${base}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt,
      size: args.size ?? "1024x1024",
      n: 1,
    }),
    signal: ctx.signal,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return {
      ok: false,
      data: null,
      error: `Image API returned HTTP ${res.status}. ${body.slice(0, 300)}`,
    };
  }

  const json = (await res.json()) as { data?: Array<{ url?: string; b64_json?: string }> };
  const first = json.data?.[0];
  const url = first?.url ?? (first?.b64_json ? `data:image/png;base64,${first.b64_json}` : null);

  if (!url) return { ok: false, data: null, error: "Image API returned no image." };

  return { ok: true, data: { url, prompt, size: args.size ?? "1024x1024" } };
}

// --- read_file --------------------------------------------------------------
async function readFile(
  args: { name?: string },
  ctx: ToolContext,
): Promise<ToolOutcome> {
  const name = String(args.name ?? "").trim();
  if (!name) return { ok: false, data: null, error: "`name` is required." };

  const match =
    ctx.attachments.find((a) => a.name === name) ??
    ctx.attachments.find((a) => a.name.toLowerCase() === name.toLowerCase());

  if (!match) {
    return {
      ok: false,
      data: null,
      error: `No attachment named "${name}". Available: ${
        ctx.attachments.map((a) => a.name).join(", ") || "(none)"
      }`,
    };
  }

  if (match.text) {
    return { ok: true, data: truncate({ name: match.name, mime: match.mime, content: match.text }) };
  }

  if (match.url) {
    try {
      const res = await fetch(match.url, { signal: ctx.signal });
      if (!res.ok) {
        return { ok: false, data: null, error: `Could not fetch attachment (HTTP ${res.status}).` };
      }
      const text = await res.text();
      return { ok: true, data: truncate({ name: match.name, mime: match.mime, content: text }) };
    } catch (err) {
      return {
        ok: false,
        data: null,
        error: err instanceof Error ? err.message : "Could not read the attachment.",
      };
    }
  }

  return {
    ok: false,
    data: null,
    error: `"${match.name}" is a binary file (${match.mime}) and has no readable text content.`,
  };
}

// --- get_current_time -------------------------------------------------------
async function getCurrentTime(args: { timezone?: string }): Promise<ToolOutcome> {
  const tz = args.timezone || "UTC";
  try {
    const now = new Date();
    return {
      ok: true,
      data: {
        timezone: tz,
        iso: now.toISOString(),
        local: new Intl.DateTimeFormat("en-GB", {
          timeZone: tz,
          dateStyle: "full",
          timeStyle: "long",
        }).format(now),
      },
    };
  } catch {
    return { ok: false, data: null, error: `Unknown timezone "${tz}".` };
  }
}

// --- calculator -------------------------------------------------------------
async function calculator(args: {
  expression?: string;
  precision?: number;
}): Promise<ToolOutcome> {
  const expression = String(args.expression ?? "").trim();
  if (!expression) return { ok: false, data: null, error: "`expression` is required." };
  try {
    return { ok: true, data: evaluate(expression, args.precision) };
  } catch (err) {
    return {
      ok: false,
      data: null,
      error: err instanceof Error ? err.message : "Could not evaluate the expression.",
    };
  }
}

// --- get_weather ------------------------------------------------------------
async function getWeather(
  args: { location?: string; units?: string },
  ctx: ToolContext,
): Promise<ToolOutcome> {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      data: null,
      error: "Weather lookups are not configured on this deployment (OPENWEATHER_API_KEY missing).",
    };
  }

  const location = String(args.location ?? "").trim();
  if (!location) return { ok: false, data: null, error: "`location` is required." };
  const units = args.units === "imperial" ? "imperial" : "metric";

  const res = await fetch(weatherUrl(apiKey, location, units), { signal: ctx.signal });
  if (!res.ok) {
    return {
      ok: false,
      data: null,
      error: `Weather provider returned HTTP ${res.status} for "${location}".`,
    };
  }

  const json = (await res.json()) as OpenWeatherResponse;
  const mapped = mapWeatherResponse(json, location, units);
  if (!mapped) {
    return { ok: false, data: null, error: `No weather data found for "${location}".` };
  }
  return { ok: true, data: mapped };
}

// --- dispatcher -------------------------------------------------------------
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolOutcome> {
  try {
    switch (name) {
      case "web_search":
        return await webSearch(args as { query?: string; max_results?: number }, ctx);
      case "run_code":
        return await runCode(args as { code?: string });
      case "generate_image":
        return await generateImage(args as { prompt?: string; size?: string }, ctx);
      case "read_file":
        return await readFile(args as { name?: string }, ctx);
      case "calculator":
        return await calculator(args as { expression?: string; precision?: number });
      case "get_weather":
        return await getWeather(args as { location?: string; units?: string }, ctx);
      case "get_current_time":
        return await getCurrentTime(args as { timezone?: string });
      default:
        return { ok: false, data: null, error: `Unknown tool "${name}".` };
    }
  } catch (err) {
    return {
      ok: false,
      data: null,
      error: err instanceof Error ? err.message : "Tool execution failed.",
    };
  }
}
