"use client";

import { create } from "zustand";
import type {
  Attachment,
  ChatStreamEvent,
  Conversation,
  Message,
  ToolCallRecord,
} from "@/lib/types";
import { DEFAULT_MODEL } from "@/lib/ai/client";

// ---------------------------------------------------------------------------
// Chat store — the single source of truth for the client.
// Streaming updates mutate the in-flight assistant message in place.
// ---------------------------------------------------------------------------

interface ChatState {
  conversations: Conversation[];
  activeId: string | null;
  messages: Message[];
  model: string;
  enabledTools: string[];
  isStreaming: boolean;
  error: string | null;
  sidebarOpen: boolean;
  toolsPanelOpen: boolean;
  abortController: AbortController | null;

  // --- actions
  setConversations: (c: Conversation[]) => void;
  upsertConversation: (c: Conversation) => void;
  removeConversation: (id: string) => void;
  setActiveId: (id: string | null) => void;
  setMessages: (m: Message[]) => void;
  setModel: (m: string) => void;
  toggleTool: (name: string) => void;
  setEnabledTools: (names: string[]) => void;
  setSidebarOpen: (open: boolean) => void;
  setToolsPanelOpen: (open: boolean) => void;
  setError: (e: string | null) => void;
  stop: () => void;
  reset: () => void;

  loadConversations: () => Promise<void>;
  loadConversation: (id: string) => Promise<void>;
  sendMessage: (text: string, attachments?: Attachment[]) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  renameConversation: (id: string, title: string) => Promise<void>;
  togglePin: (id: string) => Promise<void>;
}

function tempId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeId: null,
  messages: [],
  model: DEFAULT_MODEL,
  enabledTools: [],
  isStreaming: false,
  error: null,
  sidebarOpen: false,
  toolsPanelOpen: false,
  abortController: null,

  setConversations: (conversations) => set({ conversations }),

  upsertConversation: (c) =>
    set((s) => {
      const rest = s.conversations.filter((x) => x.id !== c.id);
      return { conversations: [c, ...rest] };
    }),

  removeConversation: (id) =>
    set((s) => ({
      conversations: s.conversations.filter((c) => c.id !== id),
      activeId: s.activeId === id ? null : s.activeId,
      messages: s.activeId === id ? [] : s.messages,
    })),

  setActiveId: (activeId) => set({ activeId }),
  setMessages: (messages) => set({ messages }),
  setModel: (model) => set({ model }),
  setEnabledTools: (enabledTools) => set({ enabledTools }),
  toggleTool: (name) =>
    set((s) => ({
      enabledTools: s.enabledTools.includes(name)
        ? s.enabledTools.filter((t) => t !== name)
        : [...s.enabledTools, name],
    })),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setToolsPanelOpen: (toolsPanelOpen) => set({ toolsPanelOpen }),
  setError: (error) => set({ error }),

  stop: () => {
    get().abortController?.abort();
    set({ isStreaming: false, abortController: null });
  },

  reset: () =>
    set({
      activeId: null,
      messages: [],
      error: null,
      isStreaming: false,
      abortController: null,
    }),

  // --- data loading --------------------------------------------------------
  loadConversations: async () => {
    try {
      const res = await fetch("/api/conversations");
      if (!res.ok) return;
      const json = (await res.json()) as { conversations: Conversation[] };
      set({ conversations: json.conversations ?? [] });
    } catch {
      /* offline — keep whatever we have */
    }
  },

  loadConversation: async (id) => {
    set({ activeId: id, messages: [], error: null });
    try {
      const res = await fetch(`/api/conversations/${id}`);
      if (!res.ok) {
        set({ error: "Could not load this conversation." });
        return;
      }
      const json = (await res.json()) as {
        conversation: Conversation;
        messages: Message[];
      };
      set({
        messages: json.messages ?? [],
        model: json.conversation?.model ?? get().model,
      });
    } catch {
      set({ error: "Could not load this conversation." });
    }
  },

  // --- streaming send ------------------------------------------------------
  sendMessage: async (text, attachments = []) => {
    const trimmed = text.trim();
    if (!trimmed || get().isStreaming) return;

    const { activeId, model, enabledTools } = get();
    const controller = new AbortController();

    // Optimistic user message.
    const optimisticUser: Message = {
      id: tempId("user"),
      conversation_id: activeId ?? "pending",
      user_id: "me",
      role: "user",
      content: trimmed,
      model: null,
      attachments,
      token_count: null,
      created_at: new Date().toISOString(),
    };

    const assistantId = tempId("assistant");
    const optimisticAssistant: Message = {
      id: assistantId,
      conversation_id: activeId ?? "pending",
      user_id: "me",
      role: "assistant",
      content: "",
      model,
      attachments: [],
      token_count: null,
      created_at: new Date().toISOString(),
      tool_calls: [],
    };

    set((s) => ({
      messages: [...s.messages, optimisticUser, optimisticAssistant],
      isStreaming: true,
      error: null,
      abortController: controller,
    }));

    const patchAssistant = (fn: (m: Message) => Message) =>
      set((s) => ({
        messages: s.messages.map((m) => (m.id === assistantId ? fn(m) : m)),
      }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          conversationId: activeId ?? undefined,
          message: trimmed,
          model,
          attachments,
          enabledTools,
        }),
      });

      if (!res.ok || !res.body) {
        const detail = await res.json().catch(() => null);
        throw new Error(detail?.error ?? `Request failed (HTTP ${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          let event: ChatStreamEvent;
          try {
            event = JSON.parse(line) as ChatStreamEvent;
          } catch {
            continue;
          }

          switch (event.type) {
            case "conversation": {
              set({ activeId: event.conversationId });
              // Reflect the new conversation in the sidebar immediately.
              get().upsertConversation({
                id: event.conversationId,
                user_id: "me",
                title: event.title,
                model,
                system_prompt: null,
                pinned: false,
                archived: false,
                last_message_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
              break;
            }
            case "delta":
              patchAssistant((m) => ({ ...m, content: m.content + event.text }));
              break;
            case "tool_call":
              patchAssistant((m) => ({
                ...m,
                tool_calls: [
                  ...(m.tool_calls ?? []),
                  {
                    id: event.id,
                    message_id: m.id,
                    name: event.name,
                    arguments: event.arguments,
                    result: null,
                    status: "running",
                    error: null,
                    duration_ms: null,
                    created_at: new Date().toISOString(),
                  } satisfies ToolCallRecord,
                ],
              }));
              break;
            case "tool_result":
              patchAssistant((m) => ({
                ...m,
                tool_calls: (m.tool_calls ?? []).map((tc) =>
                  tc.id === event.id
                    ? {
                        ...tc,
                        result: event.result,
                        status: event.status,
                        error: event.error ?? null,
                        duration_ms: event.durationMs,
                      }
                    : tc,
                ),
              }));
              break;
            case "message_end":
              patchAssistant((m) => ({ ...m, id: event.messageId, content: event.content }));
              break;
            case "error":
              set({ error: event.message });
              break;
            case "done":
              break;
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        set({ error: err instanceof Error ? err.message : "Something went wrong." });
      }
    } finally {
      set({ isStreaming: false, abortController: null });
      // Refresh the sidebar so titles/ordering are authoritative.
      void get().loadConversations();
    }
  },

  // --- mutations -----------------------------------------------------------
  deleteConversation: async (id) => {
    get().removeConversation(id);
    await fetch(`/api/conversations/${id}`, { method: "DELETE" }).catch(() => {});
    void get().loadConversations();
  },

  renameConversation: async (id, title) => {
    set((s) => ({
      conversations: s.conversations.map((c) => (c.id === id ? { ...c, title } : c)),
    }));
    await fetch(`/api/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    }).catch(() => {});
  },

  togglePin: async (id) => {
    const current = get().conversations.find((c) => c.id === id);
    if (!current) return;
    const pinned = !current.pinned;
    set((s) => ({
      conversations: s.conversations.map((c) => (c.id === id ? { ...c, pinned } : c)),
    }));
    await fetch(`/api/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned }),
    }).catch(() => {});
  },
}));
