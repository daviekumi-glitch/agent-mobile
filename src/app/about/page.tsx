"use client";

import Link from "next/link";
import { ArrowRight, Bot, Database, Globe2, KeyRound, Lock, Radio, Smartphone, Workflow } from "lucide-react";
import { SiteHeader } from "@/components/site/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const PILLARS = [
  {
    icon: Lock,
    title: "Guest by design",
    body: "No accounts, no passwords, no sign-up walls. Your chats are scoped to your device with an anonymous id generated on first visit.",
  },
  {
    icon: KeyRound,
    title: "Keys never leave the server",
    body: "AI provider keys live only in the secure backend. The app you download holds zero secrets — every model call is proxied server-side.",
  },
  {
    icon: Workflow,
    title: "A chain, not a single point of failure",
    body: "Five curated models across two providers, with a 483-model live catalog. If one provider rate-limits, the next answers instead.",
  },
  {
    icon: Bot,
    title: "Visible tool use",
    body: "Every web search, weather lookup, calculation or file read is shown in the conversation with its result and duration.",
  },
];

const STACK = [
  { label: "Frontend", value: "Next.js static bundle — ships inside the Android APK, no runtime web server" },
  { label: "Backend", value: "Base44 edge functions (agentChat, agentTools, agentData, agentModels, healthCheck)" },
  { label: "AI", value: "OpenRouter + NVIDIA NIM, MiniMax-first with automatic fallback" },
  { label: "Data", value: "Device-scoped conversations, messages and tool-call records" },
  { label: "Ops", value: "Automated health check every 6 hours; CI on every push" },
  { label: "Mobile", value: "Offline-ready APK with the full UI bundled in assets" },
];

export default function AboutPage() {
  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 left-1/2 size-[480px] -translate-x-1/2 rounded-full bg-brand/15 blur-[120px]" />
        <div className="grid-noise absolute inset-0 opacity-30" />
      </div>

      <SiteHeader />

      <main className="mx-auto w-full max-w-4xl px-5 pb-20 pt-10 sm:pt-14">
        <Badge variant="brand" className="mb-4 px-3 py-1">
          <Radio className="size-3" />
          About Agent Mobile
        </Badge>

        <h1 className="animate-md-pop text-balance text-3xl font-semibold leading-[1.15] tracking-tight sm:text-4xl">
          A private, tool-using AI assistant that
          <span className="brand-text-gradient"> respects your time</span>
        </h1>
        <p className="animate-md-pop stagger-2 mt-4 max-w-2xl text-pretty leading-7 text-muted-foreground">
          Agent Mobile started as a full Next.js app and was rebuilt as a lean static
          bundle backed by edge functions. The goal: instant access to real AI with
          real tools, nothing to sign up for, and nothing hidden behind the curtain.
        </p>

        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          {PILLARS.map((p, i) => (
            <div
              key={p.title}
              className={`elev-1 lift animate-md-rise stagger-${i + 1} rounded-3xl border border-border/70 bg-card/70 p-5 hover:elev-2`}
            >
              <span className="flex size-10 items-center justify-center rounded-2xl bg-brand/12 text-brand">
                <p.icon className="size-5" />
              </span>
              <h2 className="mt-3 text-sm font-semibold">{p.title}</h2>
              <p className="mt-1.5 text-2xs leading-5 text-muted-foreground">{p.body}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-14 text-section">Under the hood</h2>
        <div className="mt-4 overflow-hidden rounded-3xl border border-border/70">
          {STACK.map((row, i) => (
            <div
              key={row.label}
              className={`flex flex-col gap-1 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4 ${
                i % 2 === 0 ? "bg-card/60" : "bg-card/30"
              }`}
            >
              <span className="w-24 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {row.label}
              </span>
              <span className="text-2xs leading-5">{row.value}</span>
            </div>
          ))}
        </div>

        <div className="elev-2 mt-10 rounded-3xl border border-border/70 bg-card/70 p-6">
          <div className="flex items-start gap-3">
            <Smartphone className="mt-0.5 size-5 shrink-0 text-brand" />
            <div>
              <h3 className="text-sm font-semibold">Built for Android</h3>
              <p className="mt-1 text-2xs leading-5 text-muted-foreground">
                The whole interface is bundled into a signed APK so it opens instantly,
                even on a slow connection. Grab it from the GitHub releases page.
              </p>
              <Button variant="brand" size="sm" className="press glow-brand mt-4 rounded-full" asChild>
                <Link href="/chat">
                  Try it in the browser first
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>

        <p className="mt-10 flex items-center justify-center gap-1.5 text-2xs text-muted-foreground">
          <Database className="size-3" />
          Conversations live on your device — clearing browser data removes them.
          <Globe2 className="ml-1 size-3" />
        </p>
      </main>
    </div>
  );
}
