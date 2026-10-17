"use client";

import { ChatShell } from "@/components/chat/chat-shell";
import { RequireAuth } from "@/components/auth/auth-provider";

export default function ChatPage() {
  return (
    <RequireAuth>
      {(user) => (
        <ChatShell
          user={{
            id: user.id,
            email: user.email,
            name: user.full_name || user.email?.split("@")[0] || null,
            avatar: null,
          }}
        />
      )}
    </RequireAuth>
  );
}
