"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, Briefcase, Code2, GraduationCap, LineChart, PenLine, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/site/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * Skill starters: curated prompts that showcase what the assistant does well.
 * Each links into the chat with the prompt prefilled (?q= deep link).
 */
const SKILLS = [
  {
    icon: PenLine,
    title: "Writing",
    body: "Draft emails, messages and posts with the right tone — or rewrite what you already have.",
    prompt: "Help me write a short, friendly follow-up email after a job interview.",
    accent: "bg-rose-500/12 text-rose-500",
  },
  {
    icon: Code2,
    title: "Coding",
    body: "Write, explain and debug code. Answers come in proper fenced blocks with a language tag.",
    prompt: "Explain the difference between let, const and var in JavaScript, with short examples.",
    accent: "bg-sky-500/12 text-sky-500",
  },
  {
    icon: LineChart,
    title: "Analysis",
    body: "Break down numbers, compare options and think through trade-offs step by step.",
    prompt: "I save 15% of my income each month. Walk me through building a 6-month emergency fund plan.",
    accent: "bg-emerald-500/12 text-emerald-500",
  },
  {
    icon: Briefcase,
    title: "Work & study",
    body: "Summarise documents, plan projects, prep for interviews — with tools reading your files.",
    prompt: "I'll attach a document next — summarise it into five bullet points when I do.",
    accent: "bg-amber-500/12 text-amber-500",
  },
  {
    icon: GraduationCap,
    title: "Learning",
    body: "Explain anything at the level you need, from beginner to deep dives with examples.",
    prompt: "Teach me how compound interest works, using a simple example I can remember.",
    accent: "bg-violet-500/12 text-violet-500",
  },
  {
    icon: BookOpen,
    title: "Research",
    body: "Combine live web search with careful reasoning, and cite what the sources actually said.",
    prompt: "Search the web and give me a brief, balanced overview of electric vehicle adoption trends this year.",
    accent: "bg-fuchsia-500/12 text-fuchsia-500",
  },
];

export default function SkillsPage() {
  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 left-0 size-[420px] rounded-full bg-brand/15 blur-[120px]" />
        <div className="grid-noise absolute inset-0 opacity-30" />
      </div>

      <SiteHeader />

      <main className="mx-auto w-full max-w-4xl px-5 pb-20 pt-10 sm:pt-14">
        <Badge variant="brand" className="mb-4 px-3 py-1">
          <Sparkles className="size-3" />
          Skills
        </Badge>
        <h1 className="animate-md-pop text-balance text-3xl font-semibold leading-[1.15] tracking-tight sm:text-4xl">
          What the assistant is <span className="brand-text-gradient">good at</span>
        </h1>
        <p className="animate-md-pop stagger-2 mt-4 max-w-2xl text-pretty leading-7 text-muted-foreground">
          Skill starters give you a one-tap way to see the assistant in action.
          Every prompt opens in the chat, ready to edit or send.
        </p>

        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          {SKILLS.map((s, i) => (
            <div
              key={s.title}
              className={`elev-1 lift animate-md-rise stagger-${i + 1} flex flex-col rounded-3xl border border-border/70 bg-card/70 p-5 hover:elev-2`}
            >
              <span className={`flex size-10 items-center justify-center rounded-2xl ${s.accent}`}>
                <s.icon className="size-5" />
              </span>
              <h2 className="mt-3 text-sm font-semibold">{s.title}</h2>
              <p className="mt-1 flex-1 text-2xs leading-5 text-muted-foreground">{s.body}</p>
              <Button variant="outline" size="sm" className="press mt-4 w-full rounded-full" asChild>
                <Link href={`/chat?q=${encodeURIComponent(s.prompt)}`}>
                  Try this skill
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
