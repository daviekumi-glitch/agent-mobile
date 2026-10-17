import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { RedirectIfAuthed } from "@/components/auth/auth-provider";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <RedirectIfAuthed>
        <AuthForm mode="login" />
      </RedirectIfAuthed>
    </Suspense>
  );
}
