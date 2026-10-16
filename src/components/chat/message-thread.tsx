"use client";

import * as React from "react";
import { ArrowDown } from "lucide-react";
import { MessageBubble } from "@/components/chat/message-bubble";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Message } from "@/lib/types";

export function MessageThread({
  messages,
  userName,
  isStreaming,
  onRegenerate,
  className,
}: {
  messages: Message[];
  userName?: string | null;
  isStreaming: boolean;
  onRegenerate?: () => void;
  className?: string;
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = React.useState(true);

  // Auto-scroll while pinned to the bottom.
  React.useEffect(() => {
    if (!pinned) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, pinned]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setPinned(distance < 80);
  };

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setPinned(true);
  };

  const lastAssistantIndex = React.useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return i;
    }
    return -1;
  }, [messages]);

  return (
    <div className={cn("relative flex-1 overflow-hidden", className)}>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="scrollbar-thin h-full overflow-y-auto overscroll-contain"
      >
        <div className="mx-auto w-full max-w-3xl py-4">
          {messages.map((m, i) => (
            <MessageBubble
              key={m.id}
              message={m}
              userName={userName}
              isLast={i === lastAssistantIndex && !isStreaming}
              onRegenerate={
                i === lastAssistantIndex && !isStreaming ? onRegenerate : undefined
              }
            />
          ))}
          <div className="h-6" />
        </div>
      </div>

      {!pinned && (
        <Button
          variant="outline"
          size="icon"
          onClick={scrollToBottom}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full shadow-lg"
          aria-label="Scroll to latest"
        >
          <ArrowDown className="size-4" />
        </Button>
      )}
    </div>
  );
}
