"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/auth/auth-provider";
import {
  authErrorMessage,
  requestPasswordReset,
  resendCode,
  signIn,
  signInWithGoogle,
  signUp,
  verifyEmail,
} from "@/lib/base44/auth";
import { isConfigured } from "@/lib/base44/client";

type Step = "form" | "verify" | "reset";

/** Only allow same-site relative redirects (prevents open redirects). */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/chat";
  return raw;
}

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const params = useSearchParams();
  const { setUser } = useAuth();
  const next = safeNext(params.get("next"));

  const [step, setStep] = React.useState<Step>("form");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [code, setCode] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const isRegister = mode === "register";

  const finishSignIn = async () => {
    const user = await signIn(email.trim(), password);
    setUser(user);
    toast.success("Signed in");
    router.replace(next);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      if (!isConfigured) throw new Error("The backend is not configured yet.");

      if (step === "reset") {
        await requestPasswordReset(email.trim());
        toast.success("If that account exists, reset instructions are on their way.");
        setStep("form");
      } else if (step === "verify") {
        await verifyEmail(email.trim(), code.trim());
        toast.success("Email verified");
        await finishSignIn();
      } else if (isRegister) {
        const res = (await signUp(email.trim(), password)) as { status?: string; message?: string } | undefined;
        if (res?.status === "pending") {
          // App requires admin approval before sign-in is possible.
          toast.info(res.message ?? "Access requested. You'll be emailed once approved.");
          router.replace("/login");
        } else {
          toast.success("Check your inbox for a verification code");
          setStep("verify");
        }
      } else {
        await finishSignIn();
      }
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    try {
      await resendCode(email.trim());
      toast.success("A new code is on its way");
    } catch (err) {
      setError(authErrorMessage(err));
    }
  };

  const heading =
    step === "verify"
      ? "Verify your email"
      : step === "reset"
        ? "Reset your password"
        : isRegister
          ? "Create your account"
          : "Welcome back";

  const sub =
    step === "verify"
      ? `Enter the code we sent to ${email || "your email"}.`
      : step === "reset"
        ? "We'll email you a link to choose a new password."
        : isRegister
          ? "Start chatting with tools in under a minute."
          : "Sign in to continue your conversations.";

  const submitLabel =
    step === "verify" ? "Verify & continue" : step === "reset" ? "Send reset link" : isRegister ? "Create account" : "Sign in";

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 left-1/2 size-[480px] -translate-x-1/2 rounded-full bg-brand/20 blur-[120px]" />
        <div className="grid-noise absolute inset-0 opacity-30" />
      </div>

      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo size={44} />
          <h1 className="mt-4 text-xl font-semibold tracking-tight">{heading}</h1>
          <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-3 rounded-2xl border border-border bg-card/80 p-5 shadow-lg backdrop-blur"
        >
          {step !== "verify" && (
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-medium">
                Email
              </label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>
          )}

          {step === "form" && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-xs font-medium">
                  Password
                </label>
                {!isRegister && (
                  <button
                    type="button"
                    className="text-2xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setError(null);
                      setStep("reset");
                    }}
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete={isRegister ? "new-password" : "current-password"}
              />
            </div>
          )}

          {step === "verify" && (
            <div className="space-y-1.5">
              <label htmlFor="code" className="text-xs font-medium">
                Verification code
              </label>
              <Input
                id="code"
                required
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                autoComplete="one-time-code"
              />
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2 text-xs text-destructive"
            >
              {error}
            </p>
          )}

          <Button type="submit" variant="brand" className="w-full" disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            {submitLabel}
          </Button>

          {step === "form" && (
            <>
              <div className="flex items-center gap-3 text-2xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                or
                <span className="h-px flex-1 bg-border" />
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={!isConfigured}
                onClick={() => signInWithGoogle(next)}
              >
                Continue with Google
              </Button>
            </>
          )}

          {step === "verify" && (
            <button
              type="button"
              onClick={onResend}
              className="w-full text-center text-2xs text-muted-foreground hover:text-foreground"
            >
              Didn&apos;t get a code? Resend
            </button>
          )}
          {step !== "form" && (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setStep("form");
              }}
              className="w-full text-center text-2xs text-muted-foreground hover:text-foreground"
            >
              Back
            </button>
          )}
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          {isRegister ? "Already have an account? " : "New to Agent Mobile? "}
          <Link
            href={isRegister ? "/login" : "/register"}
            className="font-medium text-brand hover:underline"
          >
            {isRegister ? "Sign in" : "Create one"}
          </Link>
        </p>
      </div>
    </div>
  );
}
