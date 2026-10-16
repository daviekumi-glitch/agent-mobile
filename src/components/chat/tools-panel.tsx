"use client";

import * as React from "react";
import {
  Calculator,
  Clock,
  CloudSun,
  FileText,
  Globe,
  Image as ImageIcon,
  Terminal,
  Wrench,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useChatStore } from "@/lib/store/chat-store";
import { cn } from "@/lib/utils";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Globe,
  Terminal,
  Image: ImageIcon,
  FileText,
  Clock,
  Wrench,
  Zap,
  Calculator,
  CloudSun,
};

interface ToolMeta {
  name: string;
  label: string;
  description: string;
  icon: string;
  skill: string;
  available: boolean;
  requiresEnv: string | null;
}

interface SkillMeta {
  id: string;
  label: string;
  description: string;
  icon: string;
  tools: string[];
}

export function ToolsPanel() {
  const {
    enabledTools,
    toggleTool,
    setEnabledTools,
    initEnabledTools,
    toolsPanelOpen,
    setToolsPanelOpen,
  } = useChatStore();
  const [tools, setTools] = React.useState<ToolMeta[]>([]);
  const [skills, setSkills] = React.useState<SkillMeta[]>([]);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/tools");
        if (!res.ok) return;
        const json = (await res.json()) as { tools: ToolMeta[]; skills: SkillMeta[] };
        if (cancelled) return;
        setTools(json.tools ?? []);
        setSkills(json.skills ?? []);
        // Default: enable every tool that is actually usable — but only once,
        // so switching all tools off is not undone on the next panel open.
        initEnabledTools((json.tools ?? []).filter((t) => t.available).map((t) => t.name));
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initEnabledTools]);

  const activeCount = enabledTools.length;

  return (
    <div className="border-t border-border bg-card/40">
      {/* Collapsed summary bar */}
      <button
        type="button"
        onClick={() => setToolsPanelOpen(!toolsPanelOpen)}
        className="flex w-full items-center gap-2 px-4 py-2 text-left transition-colors hover:bg-accent/40 sm:px-6"
      >
        <Zap className="size-3.5 text-brand" />
        <span className="text-xs font-medium">Skills &amp; tools</span>
        <Badge variant={activeCount > 0 ? "brand" : "outline"} className="shrink-0">
          {activeCount} active
        </Badge>
        <span className="ml-auto text-2xs text-muted-foreground">
          {toolsPanelOpen ? "Hide" : "Configure"}
        </span>
      </button>

      {toolsPanelOpen && (
        <div className="animate-fade-in border-t border-border px-4 py-3 sm:px-6">
          <Tabs defaultValue="tools">
            <TabsList>
              <TabsTrigger value="tools">
                <Wrench />
                Tools
              </TabsTrigger>
              <TabsTrigger value="skills">
                <Zap />
                Skills
              </TabsTrigger>
            </TabsList>

            <TabsContent value="tools">
              {!loaded ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-14 animate-pulse rounded-xl bg-muted/60" />
                  ))}
                </div>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {tools.map((t) => {
                    const Icon = ICONS[t.icon] ?? Wrench;
                    const enabled = enabledTools.includes(t.name);
                    return (
                      <li
                        key={t.name}
                        className={cn(
                          "flex items-start gap-3 rounded-xl border p-3 transition-colors",
                          enabled ? "border-brand/30 bg-brand/5" : "border-border bg-card/50",
                          !t.available && "opacity-60",
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg",
                            enabled ? "bg-brand/12 text-brand" : "bg-muted text-muted-foreground",
                          )}
                        >
                          <Icon className="size-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-semibold">{t.label}</p>
                            {!t.available && (
                              <Badge variant="warning" className="shrink-0">
                                needs {t.requiresEnv}
                              </Badge>
                            )}
                          </div>
                          <p className="mt-0.5 text-2xs leading-4 text-muted-foreground">
                            {t.description}
                          </p>
                        </div>
                        <Switch
                          checked={enabled}
                          disabled={!t.available}
                          onCheckedChange={() => toggleTool(t.name)}
                          aria-label={`Toggle ${t.label}`}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="skills">
              <ul className="grid gap-2 sm:grid-cols-2">
                {skills.map((s) => {
                  const Icon = ICONS[s.icon] ?? Zap;
                  const allOn = s.tools.every((t) => enabledTools.includes(t));
                  return (
                    <li
                      key={s.id}
                      className={cn(
                        "flex items-start gap-3 rounded-xl border p-3",
                        allOn ? "border-brand/30 bg-brand/5" : "border-border bg-card/50",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg",
                          allOn ? "bg-brand/12 text-brand" : "bg-muted text-muted-foreground",
                        )}
                      >
                        <Icon className="size-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold">{s.label}</p>
                        <p className="mt-0.5 text-2xs leading-4 text-muted-foreground">
                          {s.description}
                        </p>
                        <p className="mt-1 text-2xs text-muted-foreground">
                          {s.tools.length} tool{s.tools.length === 1 ? "" : "s"}
                        </p>
                      </div>
                      <Button
                        variant={allOn ? "secondary" : "outline"}
                        size="sm"
                        className="shrink-0"
                        onClick={() => {
                          const next = allOn
                            ? enabledTools.filter((t) => !s.tools.includes(t))
                            : Array.from(new Set([...enabledTools, ...s.tools]));
                          setEnabledTools(next);
                        }}
                      >
                        {allOn ? "Disable" : "Enable"}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
