"use client";

import Link from "next/link";
import {
  ArrowRight,
  CloudSun,
  Clock,
  Code2,
  FileText,
  Globe,
  Sparkles,
  Zap,
} from "lucide-react";
import { Wordmark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// Features map 1:1 to the tools the backend actually ships: web_search,
// get_weather, calculator, get_current_time and read_file. Never advertise
// capabilities the app does not have.
const FEATURES = [
  {
    icon: Globe,
    title: "Web search",
    body: "Pull live results into the answer instead of relying on stale training data.",
  },
  {
    icon: CloudSun,
    title: "Live weather",
    body: "Ask about the weather anywhere and get the current conditions in the reply.",
  },
  {
    icon: Code2,
    title: "Exact math",
    body: "A real calculator evaluates the expression, so numbers are never hallucinated.",
  },
  {
    icon: FileText,
    title: "File reading",
    body: "Attach a text, code or CSV file and the assistant reads it before answering.",
  },
];

export default function LandingPage() {
  return (
    <div className="relative min-h-dvh overflow-hidden">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 size-[560px] -translate-x-1/2 rounded-full bg-brand/20 blur-[120px]" />
        <div className="absolute bottom-0 right-0 size-[420px] rounded-full bg-fuchsia-500/10 blur-[120px]" />
        <div className="grid-noise absolute inset-0 opacity-[0.35]" />
      </div>

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
        <Wordmark />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="brand" size="sm" asChild>
            <Link href="/chat">Start chatting</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 pb-20">
        {/* Hero */}
        <section className="flex flex-col items-center pt-10 text-center sm:pt-16">
          <Badge variant="brand" className="mb-5 gap-1.5 px-3 py-1">
            <Sparkles className="size-3" />
            No sign-up needed
          </Badge>

          <h1 className="max-w-3xl text-balance text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
            An AI assistant that can
            <span className="brand-text-gradient"> actually do things</span>
          </h1>

          <p className="mt-5 max-w-xl text-pretty text-base leading-7 text-muted-foreground">
            Agent Mobile is a ChatGPT-style workspace where the model searches the web, checks
            the weather, does exact math and reads your files — with every tool call visible
            in the conversation. Jump straight in: there is no account to create.
          </p>

          <div className="mt-8 flex flex-col gap-2.5 sm:flex-row">
            <Button variant="brand" size="lg" asChild>
              <Link href="/chat">
                Open the chat
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>

          <p className="mt-4 flex items-center gap-1.5 text-2xs text-muted-foreground">
            <Clock className="size-3" />
            Your conversations stay on this device — nothing to sign up for.
          </p>
        </section>

        {/* App preview */}
        <section className="mt-16">
          <div className="overflow-hidden rounded-3xl border border-border bg-card/70 shadow-2xl backdrop-blur">
            <div className="flex items-center gap-1.5 border-b border-border px-4 py-3">
              <span className="size-2.5 rounded-full bg-red-400/70" />
              <span className="size-2.5 rounded-full bg-amber-400/70" />
              <span className="size-2.5 rounded-full bg-emerald-400/70" />
              <span className="ml-3 text-2xs text-muted-foreground">agent-mobile.app/chat</span>
            </div>

            <div className="grid gap-0 sm:grid-cols-[200px_1fr]">
              {/* Fake sidebar */}
              <div className="hidden flex-col gap-1.5 border-r border-border bg-sidebar p-3 sm:flex">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-2xs font-semibold">Agent Mobile</span>
                </div>
                {["Today", "Yesterday"].map((bucket) => (
                  <div key={bucket} className="mt-2">
                    <p className="px-1 text-[0.625rem] font-semibold uppercase tracking-wide text-muted-foreground">
                      {bucket}
                    </p>
                    <div className="mt-1 space-y-1">
                      <div className="h-6 rounded-md bg-sidebar-accent" />
                      <div className="h-6 rounded-md bg-sidebar-accent/60" />
                    </div>
                  </div>
                ))}
              </div>

              {/* Fake thread */}
              <div className="space-y-4 p-5">
                <div className="flex justify-end">
                  <div className="max-w-[70%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-xs text-primary-foreground">
                    What&apos;s the weather in Blantyre right now?
                  </div>
                </div>

                <div className="flex gap-2.5">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1 text-[0.625rem]">
                      <CloudSun className="size-3 text-brand" />
                      <span className="font-medium">Weather</span>
                      <span className="text-muted-foreground">Blantyre, Malawi</span>
                      <Badge variant="success" className="ml-1">
                        380ms
                      </Badge>
                    </div>
                    <div className="space-y-1.5">
                      <div className="h-2.5 w-[92%] rounded-full bg-muted" />
                      <div className="h-2.5 w-[78%] rounded-full bg-muted" />
                      <div className="h-2.5 w-[85%] rounded-full bg-muted" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mt-16 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-border bg-card/60 p-4 transition-colors hover:border-brand/30"
            >
              <span className="flex size-9 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <f.icon className="size-4" />
              </span>
              <h3 className="mt-3 text-sm font-semibold">{f.title}</h3>
              <p className="mt-1 text-2xs leading-5 text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </section>

        {/* Bottom CTA */}
        <section className="mt-16 flex flex-col items-center gap-4 text-center">
          <Zap className="size-5 text-brand" />
          <h2 className="text-balance text-2xl font-semibold sm:text-3xl">
            Ready when you are
          </h2>
          <Button variant="brand" size="lg" asChild>
            <Link href="/chat">
              Start chatting
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </section>
      </main>
    </div>
  );
}
