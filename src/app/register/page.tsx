import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { RedirectIfAuthed } from "@/components/auth/auth-provider";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RedirectIfAuthed>
        <AuthForm mode="register" />
      </RedirectIfAuthed>
    </Suspense>
  );
}
