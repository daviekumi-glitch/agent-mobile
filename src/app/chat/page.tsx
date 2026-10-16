import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ChatShell } from "@/components/chat/chat-shell";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Chat" };
export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/chat");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <ChatShell
      user={{
        id: user.id,
        email: user.email,
        name: profile?.display_name ?? (user.user_metadata?.display_name as string | undefined) ?? null,
        avatar: profile?.avatar_url ?? null,
      }}
    />
  );
}
