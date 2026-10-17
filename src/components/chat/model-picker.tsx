"use client";

import * as React from "react";
import { Check, ChevronDown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { MODELS } from "@/lib/ai/client";
import { cn } from "@/lib/utils";

export function ModelPicker({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  const current = MODELS.find((m) => m.id === value) ?? MODELS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground", className)}
        >
          <Sparkles className="size-3.5 text-brand" />
          {current.label}
          <ChevronDown className="size-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>Model</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {MODELS.map((m) => (
          <DropdownMenuItem
            key={m.id}
            onClick={() => onChange(m.id)}
            className="flex-col items-start gap-0.5 py-2.5"
          >
            <span className="flex w-full items-center gap-2">
              <span className="flex-1 text-sm font-medium">{m.label}</span>
              <Badge variant="outline" className="shrink-0">
                {m.context}
              </Badge>
              {m.id === value && <Check className="size-3.5 shrink-0 text-brand" />}
            </span>
            <span className="text-2xs leading-4 text-muted-foreground">
              {m.provider} &middot; {m.description}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
