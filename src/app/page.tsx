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
          <Button variant="brand" size="sm" className="press rounded-full" asChild>
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

          <h1 className="animate-md-pop max-w-3xl text-balance text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
            An AI assistant that can
            <span className="brand-text-gradient"> actually do things</span>
          </h1>

          <p className="animate-md-pop stagger-2 mt-5 max-w-xl text-pretty text-base leading-7 text-muted-foreground">
            Agent Mobile is a ChatGPT-style workspace where the model searches the web, checks
            the weather, does exact math and reads your files — with every tool call visible
            in the conversation. Jump straight in: there is no account to create.
          </p>

          <div className="mt-8 flex flex-col gap-2.5 sm:flex-row">
            <Button variant="brand" size="lg" className="press glow-brand animate-md-pop stagger-3 rounded-full px-8" asChild>
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

        {/* App preview: real product screenshots, not a mockup */}
        <div className="mt-8 flex flex-col items-center gap-6 md:flex-row md:items-start md:justify-center">
          <figure className="animate-md-rise stagger-3 w-full max-w-xl overflow-hidden elev-3 rounded-3xl border border-border/70 bg-card/80 p-2 shadow-2xl">
            <img
              src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/screenshots/08-chat-desktop.png`}
              alt="Agent Mobile chat on desktop: a tool-using answer with live weather data"
              className="w-full rounded-2xl"
              loading="lazy"
            />
            <figcaption className="px-2 pt-2 pb-1 text-center text-2xs text-muted-foreground">
              Real conversation with the weather tool - not a mockup
            </figcaption>
          </figure>
          <figure className="animate-md-rise stagger-4 w-40 shrink-0 overflow-hidden elev-2 rounded-3xl border border-border/70 bg-card/80 p-1.5 md:mt-8 shadow-xl">
            <img
              src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/screenshots/responsive-mobile.png`}
              alt="Agent Mobile chat on a phone"
              className="w-full rounded-2xl"
              loading="lazy"
            />
            <figcaption className="px-1.5 pt-1.5 pb-0.5 text-center text-[0.5rem] text-muted-foreground">
              390px phone layout
            </figcaption>
          </figure>
        </div>

        {/* Features */}
        <section className="mt-16 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, idx) => (
            <div
              key={f.title}
              className={`elev-1 lift animate-md-rise stagger-${idx + 1} rounded-3xl border border-border/70 bg-card/70 p-4 hover:border-brand/30 hover:elev-2`}
            >
              <span className="flex size-10 items-center justify-center rounded-2xl bg-brand/12 text-brand">
                <f.icon className="size-5" />
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
          <Button variant="brand" size="lg" className="press glow-brand rounded-full px-8" asChild>
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
