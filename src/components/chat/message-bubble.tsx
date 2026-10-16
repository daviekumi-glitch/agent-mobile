"use client";

import * as React from "react";
import { Check, Copy, RefreshCw, ThumbsDown, ThumbsUp } from "lucide-react";
import { Logo } from "@/components/logo";
import { Markdown } from "@/components/chat/markdown";
import { ToolCallCard } from "@/components/chat/tool-call-card";
import { Button } from "@/components/ui/button";
import { cn, initials } from "@/lib/utils";
import type { Message } from "@/lib/types";

function CopyMessageButton({ content }: { content: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Copy message"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(content);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        } catch {
          /* ignore */
        }
      }}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </Button>
  );
}

export function MessageBubble({
  message,
  userName,
  isLast,
  onRegenerate,
}: {
  message: Message;
  userName?: string | null;
  isLast?: boolean;
  onRegenerate?: () => void;
}) {
  const isUser = message.role === "user";
  const isStreamingEmpty = !isUser && message.content === "" && (message.tool_calls?.length ?? 0) === 0;

  if (isUser) {
    return (
      <div className="group flex animate-fade-in justify-end gap-3 px-4 py-3 sm:px-6">
        <div className="flex max-w-[85%] flex-col items-end gap-1.5 sm:max-w-[75%]">
          {message.attachments?.length > 0 && (
            <div className="flex flex-wrap justify-end gap-1.5">
              {message.attachments.map((a) => (
                <span
                  key={a.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1 text-2xs text-muted-foreground"
                >
                  {a.mime.startsWith("image/") ? "🖼" : "📄"} {a.name}
                </span>
              ))}
            </div>
          )}
          <div className="rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[0.9375rem] leading-7 text-primary-foreground shadow-sm">
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          </div>
          <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <CopyMessageButton content={message.content} />
          </div>
        </div>
        <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-2xs font-semibold text-secondary-foreground">
          {initials(userName)}
        </div>
      </div>
    );
  }

  return (
    <div className="group flex animate-fade-in gap-3 px-4 py-3 sm:px-6">
      <Logo size={28} className="mt-0.5" />

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-xs font-semibold">Agent Mobile</span>
          {message.model && (
            <span className="text-2xs text-muted-foreground">{message.model}</span>
          )}
        </div>

        {message.tool_calls?.map((call) => (
          <ToolCallCard key={call.id} call={call} />
        ))}

        {isStreamingEmpty ? (
          <div className="flex items-center gap-1.5 py-1.5">
            <span className="size-1.5 animate-caret-blink rounded-full bg-brand" />
            <span className="size-1.5 animate-caret-blink rounded-full bg-brand [animation-delay:0.2s]" />
            <span className="size-1.5 animate-caret-blink rounded-full bg-brand [animation-delay:0.4s]" />
          </div>
        ) : (
          <Markdown content={message.content} />
        )}

        {!isStreamingEmpty && (
          <div
            className={cn(
              "mt-1.5 flex items-center gap-0.5 transition-opacity",
              isLast ? "opacity-100" : "opacity-0 group-hover:opacity-100",
            )}
          >
            <CopyMessageButton content={message.content} />
            {onRegenerate && (
              <Button variant="ghost" size="icon-sm" aria-label="Regenerate" onClick={onRegenerate}>
                <RefreshCw className="size-3.5" />
              </Button>
            )}
            <Button variant="ghost" size="icon-sm" aria-label="Good response">
              <ThumbsUp className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Bad response">
              <ThumbsDown className="size-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
