"use client";

import * as React from "react";
import { Menu, PanelRight, Plus } from "lucide-react";
import { Composer } from "@/components/chat/composer";
import { EmptyState } from "@/components/chat/empty-state";
import { MessageThread } from "@/components/chat/message-thread";
import { Sidebar } from "@/components/chat/sidebar";
import { ToolsPanel } from "@/components/chat/tools-panel";
import { Button } from "@/components/ui/button";
import { useChatStore } from "@/lib/store/chat-store";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function ChatShell({
  user,
}: {
  user: { id: string; email?: string | null; name?: string | null; avatar?: string | null };
}) {
  const router = useRouter();
  const {
    messages,
    isStreaming,
    loadConversations,
    setSidebarOpen,
    setToolsPanelOpen,
    toolsPanelOpen,
    reset,
    sendMessage,
    conversations,
    activeId,
  } = useChatStore();

  const activeTitle =
    conversations.find((c) => c.id === activeId)?.title ?? "New chat";

  React.useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const regenerate = () => {
    // Re-send the most recent user message.
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser) void sendMessage(lastUser.content, lastUser.attachments ?? []);
  };

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background">
      <Sidebar user={user} onSignOut={signOut} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3 sm:px-4">
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <Menu className="size-4" />
          </Button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{activeTitle}</p>
          </div>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              reset();
            }}
            aria-label="New chat"
          >
            <Plus className="size-4" />
          </Button>

          <Button
            variant={toolsPanelOpen ? "secondary" : "ghost"}
            size="icon-sm"
            onClick={() => setToolsPanelOpen(!toolsPanelOpen)}
            aria-label="Toggle tools panel"
          >
            <PanelRight className="size-4" />
          </Button>
        </header>

        {/* Thread / empty state */}
        {messages.length === 0 ? (
          <EmptyState userName={user.name} />
        ) : (
          <MessageThread
            messages={messages}
            userName={user.name}
            isStreaming={isStreaming}
            onRegenerate={regenerate}
          />
        )}

        <ToolsPanel />
        <Composer />
      </div>
    </div>
  );
}
