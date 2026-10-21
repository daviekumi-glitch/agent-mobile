"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Cpu, Info, Palette, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site/site-header";
import { ModelPicker } from "@/components/chat/model-picker";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { getDeviceId } from "@/lib/base44/device";
import { getProfileSettings, saveProfileSettings, listConversations, deleteConversation } from "@/lib/base44/data";
import { useChatStore } from "@/lib/store/chat-store";

const MAX_PROMPT = 8000;

/**
 * Settings: the single home for everything the in-chat settings dialog used to
 * hold, plus device/privacy controls. Values are stored on the device profile
 * (localStorage) and the chat store — guest mode has no server account.
 */
export default function SettingsPage() {
  const { model, setModel } = useChatStore();
  const [systemPrompt, setSystemPrompt] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [savingPrompt, setSavingPrompt] = React.useState(false);
  const [clearing, setClearing] = React.useState(false);
  const [deviceId, setDeviceId] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const profile = await getProfileSettings();
        if (cancelled) return;
        setSystemPrompt(profile.system_prompt ?? "");
        if (profile.default_model) setModel(profile.default_model);
      } catch {
        if (!cancelled) toast.error("Could not load your settings.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    setDeviceId(getDeviceId());
    return () => {
      cancelled = true;
    };
  }, [setModel]);

  const saveModel = async (id: string) => {
    setModel(id);
    try {
      await saveProfileSettings({ default_model: id });
      toast.success("Default model saved");
    } catch {
      toast.error("Could not save the default model.");
    }
  };

  const savePrompt = async () => {
    if (systemPrompt.length > MAX_PROMPT) {
      toast.error(`Custom instructions must be ${MAX_PROMPT} characters or fewer.`);
      return;
    }
    setSavingPrompt(true);
    try {
      await saveProfileSettings({ system_prompt: systemPrompt.trim() || null });
      toast.success("Custom instructions saved");
    } catch {
      toast.error("Could not save your instructions.");
    } finally {
      setSavingPrompt(false);
    }
  };

  const clearAllChats = async () => {
    if (clearing) return;
    if (!window.confirm("Delete every conversation stored for this device? This cannot be undone.")) return;
    setClearing(true);
    try {
      const convos = await listConversations();
      let deleted = 0;
      for (const c of convos) {
        try {
          await deleteConversation(c.id);
          deleted += 1;
        } catch {
          /* skip failures, report the count */
        }
      }
      useChatStore.getState().reset();
      toast.success(deleted > 0 ? `Deleted ${deleted} conversation${deleted === 1 ? "" : "s"}.` : "No conversations to delete.");
    } catch {
      toast.error("Could not clear conversations.");
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 left-1/2 size-[420px] -translate-x-1/2 rounded-full bg-brand/15 blur-[120px]" />
        <div className="grid-noise absolute inset-0 opacity-30" />
      </div>

      <SiteHeader />

      <main className="mx-auto w-full max-w-3xl px-5 pb-20 pt-10 sm:pt-14">
        <h1 className="animate-md-pop text-3xl font-semibold tracking-tight sm:text-4xl">
          Settings
        </h1>
        <p className="animate-md-pop stagger-2 mt-2 text-sm leading-6 text-muted-foreground">
          Everything here is stored on your device. There is no account.
        </p>

        {/* Default model */}
        <section className="elev-1 animate-md-rise stagger-2 mt-8 rounded-3xl border border-border/70 bg-card/70 p-5 sm:p-6">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-2xl bg-brand/12 text-brand">
              <Cpu className="size-4" />
            </span>
            <h2 className="text-sm font-semibold">Default model</h2>
            <Badge variant="outline" className="ml-auto shrink-0 font-normal">
              {loading ? "loading…" : "483 live models"}
            </Badge>
          </div>
          <p className="mt-2 text-2xs leading-5 text-muted-foreground">
            Recommended models are verified to answer well. &ldquo;All models&rdquo; lists every
            model on OpenRouter and NVIDIA — search and pick anything; the curated chain
            still backs it up if the provider is rate-limited.
          </p>
          <div className="mt-3">
            <ModelPicker value={model} onChange={(id) => void saveModel(id)} className="-ml-2" />
          </div>
        </section>

        {/* Custom instructions */}
        <section className="elev-1 animate-md-rise stagger-3 mt-4 rounded-3xl border border-border/70 bg-card/70 p-5 sm:p-6">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-2xl bg-brand/12 text-brand">
              <Info className="size-4" />
            </span>
            <h2 className="text-sm font-semibold">Custom instructions</h2>
          </div>
          <p className="mt-2 text-2xs leading-5 text-muted-foreground">
            A standing instruction included with every message in every chat, e.g.
            &ldquo;Answer in simple English&rdquo; or &ldquo;Always show your working&rdquo;.
          </p>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={4}
            maxLength={MAX_PROMPT}
            placeholder="How should the assistant respond?"
            aria-label="Custom instructions"
            className="scrollbar-thin mt-3 w-full resize-none rounded-2xl border border-border bg-background/60 px-3.5 py-3 text-sm leading-6 outline-none transition-colors focus:border-brand/40"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-2xs tabular-nums text-muted-foreground">
              {systemPrompt.length.toLocaleString()} / {MAX_PROMPT.toLocaleString()}
            </span>
            <Button variant="brand" size="sm" className="press rounded-full" onClick={() => void savePrompt()} disabled={savingPrompt}>
              {savingPrompt ? <Check className="size-3.5" /> : null}
              {savingPrompt ? "Saving…" : "Save instructions"}
            </Button>
          </div>
        </section>

        {/* Appearance */}
        <section className="elev-1 animate-md-rise stagger-4 mt-4 rounded-3xl border border-border/70 bg-card/70 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-2xl bg-brand/12 text-brand">
                <Palette className="size-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold">Appearance</h2>
                <p className="text-2xs leading-5 text-muted-foreground">Light or dark theme, saved on this device.</p>
              </div>
            </div>
            <ThemeToggle />
          </div>
          <p className="mt-3 text-2xs leading-5 text-muted-foreground">
            Tools are switched per chat from the <Link href="/chat" className="font-medium text-brand">Skills &amp; tools panel</Link> in the conversation.
          </p>
        </section>

        {/* Device & privacy */}
        <section className="elev-1 animate-md-rise stagger-5 mt-4 rounded-3xl border border-border/70 bg-card/70 p-5 sm:p-6">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="size-4" />
            </span>
            <h2 className="text-sm font-semibold">Device &amp; privacy</h2>
          </div>
          <p className="mt-2 text-2xs leading-5 text-muted-foreground">
            Guest mode: your chats are tied to this anonymous device id. No email,
            no profile, no tracking. Clearing site data or the app storage removes access.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="rounded-lg border border-border bg-muted/60 px-2.5 py-1.5 font-mono text-2xs">{deviceId || "…"}</code>
          </div>
          <Button
            variant="destructive"
            size="sm"
            className="press mt-4 rounded-full"
            onClick={() => void clearAllChats()}
            disabled={clearing}
          >
            <Trash2 className="size-3.5" />
            {clearing ? "Deleting…" : "Delete all conversations"}
          </Button>
        </section>
      </main>
    </div>
  );
}
