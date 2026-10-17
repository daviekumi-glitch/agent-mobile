"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Code2,
  FileText,
  Globe,
  Image as ImageIcon,
  Lock,
  Moon,
  Sparkles,
  Zap,
} from "lucide-react";
import { Logo, Wordmark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";

const FEATURES = [
  {
    icon: Globe,
    title: "Web search",
    body: "Pull live results into the answer instead of relying on stale training data.",
  },
  {
    icon: Code2,
    title: "Code execution",
    body: "Run JavaScript in a sandbox and see the real output, not a guess.",
  },
  {
    icon: ImageIcon,
    title: "Image generation",
    body: "Create images from a prompt and render them inline in the thread.",
  },
  {
    icon: FileText,
    title: "File reading",
    body: "Attach a CSV, markdown or source file and let the agent read it.",
  },
];

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (!loading && user) router.replace("/chat");
  }, [loading, user, router]);

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
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button variant="brand" size="sm" asChild>
            <Link href="/register">Get started</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 pb-20">
        {/* Hero */}
        <section className="flex flex-col items-center pt-10 text-center sm:pt-16">
          <Badge variant="brand" className="mb-5 gap-1.5 px-3 py-1">
            <Sparkles className="size-3" />
            Skills &amp; tools built in
          </Badge>

          <h1 className="max-w-3xl text-balance text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
            An AI assistant that can
            <span className="brand-text-gradient"> actually do things</span>
          </h1>

          <p className="mt-5 max-w-xl text-pretty text-base leading-7 text-muted-foreground">
            Agent Mobile is a ChatGPT-style workspace where the model searches the web, runs
            code, generates images and reads your files — with every tool call visible in the
            conversation.
          </p>

          <div className="mt-8 flex flex-col gap-2.5 sm:flex-row">
            <Button variant="brand" size="lg" asChild>
              <Link href="/register">
                Start chatting free
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/login">I already have an account</Link>
            </Button>
          </div>

          <p className="mt-4 flex items-center gap-1.5 text-2xs text-muted-foreground">
            <Lock className="size-3" />
            Your conversations are private — protected by row-level security.
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
                  <Logo size={22} />
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
                    What&apos;s the latest in Next.js 15?
                  </div>
                </div>

                <div className="flex gap-2.5">
                  <Logo size={22} />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1 text-[0.625rem]">
                      <Globe className="size-3 text-brand" />
                      <span className="font-medium">Web search</span>
                      <span className="text-muted-foreground">next.js 15 release</span>
                      <Badge variant="success" className="ml-1">
                        412ms
                      </Badge>
                    </div>
                    <div className="space-y-1.5">
                      <div className="h-2.5 w-[92%] rounded-full bg-muted" />
                      <div className="h-2.5 w-[78%] rounded-full bg-muted" />
                      <div className="h-2.5 w-[85%] rounded-full bg-muted" />
                    </div>
                    <div className="rounded-lg border border-border bg-muted/50 p-2.5">
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="font-mono text-[0.5625rem] uppercase text-muted-foreground">
                          tsx
                        </span>
                        <span className="text-[0.5625rem] text-muted-foreground">Copy</span>
                      </div>
                      <div className="space-y-1">
                        <div className="h-2 w-[60%] rounded-full bg-brand/30" />
                        <div className="h-2 w-[80%] rounded-full bg-muted-foreground/20" />
                        <div className="h-2 w-[45%] rounded-full bg-emerald-500/30" />
                      </div>
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
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </section>

        {/* Stack strip */}
        <section className="mt-14 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-2xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Zap className="size-3 text-brand" /> Next.js 15 App Router
          </span>
          <span className="flex items-center gap-1.5">
            <Zap className="size-3 text-brand" /> TypeScript + Tailwind
          </span>
          <span className="flex items-center gap-1.5">
            <Zap className="size-3 text-brand" /> Base44 Auth + Realtime DB
          </span>
          <span className="flex items-center gap-1.5">
            <Moon className="size-3 text-brand" /> Dark mode
          </span>
        </section>
      </main>
    </div>
  );
}
