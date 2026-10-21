"use client";

import Link from "next/link";
import { ArrowRight, Calculator, Clock, CloudSun, FileText, Globe, Play } from "lucide-react";
import { SiteHeader } from "@/components/site/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * Tools map 1:1 to the backend TOOL_SPECS in agentChat. Each card deep-links
 * into the chat with a prefilled prompt via ?q= so users can try it in one tap.
 */
const TOOLS = [
  {
    icon: Globe,
    name: "Web search",
    tagline: "Live results, not stale memories",
    body: "Searches the web for current events, news and facts, then answers with the results and shows the source snippets it used.",
    demo: "Search the web for today's top technology headlines and summarise the three most important.",
  },
  {
    icon: CloudSun,
    name: "Weather",
    tagline: "Current conditions anywhere",
    body: "Real weather lookups for any city, with temperature, conditions, wind and humidity pulled live at answer time.",
    demo: "What's the weather in Blantyre, Malawi right now?",
  },
  {
    icon: Calculator,
    name: "Calculator",
    tagline: "Exact math, never hallucinated",
    body: "Arithmetic, powers, percentages, sqrt, log, min/max — evaluated by a real calculator engine, not by guesswork.",
    demo: "Calculate (1250 * 1.18) / 3 and show the exact result.",
  },
  {
    icon: Clock,
    name: "Time & timezones",
    tagline: "What time is it, anywhere",
    body: "Accurate current date and time for any IANA timezone, useful for scheduling across regions.",
    demo: "What time is it right now in Europe/London?",
  },
  {
    icon: FileText,
    name: "File reading",
    tagline: "Bring your own documents",
    body: "Attach text, code, CSV, Markdown or JSON files and the assistant reads their contents before answering.",
    demo: "I'm going to attach a file — read it and summarise what's inside.",
  },
];

export default function ToolsPage() {
  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 right-0 size-[420px] rounded-full bg-brand/15 blur-[120px]" />
        <div className="grid-noise absolute inset-0 opacity-30" />
      </div>

      <SiteHeader />

      <main className="mx-auto w-full max-w-4xl px-5 pb-20 pt-10 sm:pt-14">
        <Badge variant="brand" className="mb-4 px-3 py-1">
          <Play className="size-3" />
          Live tools
        </Badge>
        <h1 className="animate-md-pop text-balance text-3xl font-semibold leading-[1.15] tracking-tight sm:text-4xl">
          Five tools, <span className="brand-text-gradient">no smoke and mirrors</span>
        </h1>
        <p className="animate-md-pop stagger-2 mt-4 max-w-2xl text-pretty leading-7 text-muted-foreground">
          The assistant decides on its own when a tool helps. Every call is visible
          in the conversation with its result and how long it took. Tap a card to try it.
        </p>

        <div className="mt-10 grid gap-3">
          {TOOLS.map((t, i) => (
            <div
              key={t.name}
              className={`elev-1 lift animate-md-rise stagger-${i + 1} rounded-3xl border border-border/70 bg-card/70 p-5 hover:elev-2 sm:p-6`}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand/12 text-brand">
                  <t.icon className="size-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold">{t.name}</h2>
                    <Badge variant="outline" className="shrink-0 font-normal">
                      {t.tagline}
                    </Badge>
                  </div>
                  <p className="mt-1.5 text-2xs leading-5 text-muted-foreground sm:text-xs">{t.body}</p>
                </div>
                <Button
                  variant="brand"
                  size="sm"
                  className="press shrink-0 rounded-full"
                  asChild
                >
                  <Link href={`/chat?q=${encodeURIComponent(t.demo)}`}>
                    Try it
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-2xs leading-5 text-muted-foreground">
          Tools can be switched on or off per chat from the Skills &amp; tools panel
          inside the conversation.
        </p>
      </main>
    </div>
  );
}
