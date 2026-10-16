"use client";

import * as React from "react";
import { Code2, FileText, Globe, Image as ImageIcon, Sparkles } from "lucide-react";
import { Logo } from "@/components/logo";
import { useChatStore } from "@/lib/store/chat-store";

const SUGGESTIONS = [
  {
    icon: Globe,
    title: "Research something current",
    prompt: "Search the web for the latest Next.js 15 release notes and summarise what changed.",
  },
  {
    icon: Code2,
    title: "Write and run code",
    prompt:
      "Write a JavaScript function that finds the longest palindromic substring, then run it on 'babad' and 'cbbd'.",
  },
  {
    icon: ImageIcon,
    title: "Generate an image",
    prompt: "Generate an image of a neon-lit cyberpunk city skyline at night, cinematic wide shot.",
  },
  {
    icon: FileText,
    title: "Analyse a file",
    prompt: "I'll attach a CSV — read it and give me a summary of the columns and any anomalies.",
  },
];

export function EmptyState({ userName }: { userName?: string | null }) {
  const { sendMessage } = useChatStore();

  return (
    <div className="flex flex-1 items-center justify-center overflow-y-auto px-4 py-10 sm:px-6">
      <div className="w-full max-w-2xl animate-fade-in">
        <div className="flex flex-col items-center text-center">
          <Logo size={52} />
          <h1 className="mt-5 text-display">
            {userName ? `Hi ${userName.split(" ")[0]}, ` : ""}
            <span className="brand-text-gradient">what can I build for you?</span>
          </h1>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Agent Mobile can search the web, run code, generate images and read your files —
            all inside the conversation.
          </p>
        </div>

        <div className="mt-8 grid gap-2.5 sm:grid-cols-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.title}
              type="button"
              onClick={() => void sendMessage(s.prompt)}
              className="group flex items-start gap-3 rounded-2xl border border-border bg-card/60 p-3.5 text-left transition-all hover:border-brand/40 hover:bg-card hover:shadow-sm"
            >
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand transition-colors group-hover:bg-brand/15">
                <s.icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-[0.8125rem] font-semibold">{s.title}</span>
                <span className="mt-0.5 block text-2xs leading-5 text-muted-foreground">
                  {s.prompt}
                </span>
              </span>
            </button>
          ))}
        </div>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-2xs text-muted-foreground">
          <Sparkles className="size-3 text-brand" />
          Tools are enabled per chat in the Skills &amp; tools panel below.
        </p>
      </div>
    </div>
  );
}
