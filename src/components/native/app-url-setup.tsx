"use client";

import * as React from "react";
import { ArrowRight, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { normaliseAppUrl } from "@/lib/mobile/preferences";
import { suggestedAppUrl } from "@/lib/mobile/app-url";

/**
 * First-run screen shown inside the native shell when the app was built without
 * a backend URL.
 *
 * A remote-URL wrapper with no URL configured renders an empty WebView, which
 * is indistinguishable from a crash. Rather than ship that, the app detects the
 * condition and asks for the URL.
 */
export function AppUrlSetup({ onConfigured }: { onConfigured: (url: string) => void }) {
  const [value, setValue] = React.useState(suggestedAppUrl());
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalised = normaliseAppUrl(value);
    if (!normalised) {
      setError("Enter a full URL, for example https://your-app.vercel.app");
      return;
    }
    setError(null);
    setBusy(true);
    onConfigured(normalised);
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo size={48} />
          <h1 className="mt-4 text-lg font-semibold tracking-tight">Connect Agent Mobile</h1>
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
            This build was not shipped with a backend address. Point it at your deployed
            Agent Mobile instance to continue.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <label htmlFor="app-url" className="sr-only">
            App URL
          </label>
          <input
            id="app-url"
            type="url"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            placeholder="https://your-app.vercel.app"
            className="h-11 w-full rounded-xl border border-border bg-card px-3.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-brand/50"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "app-url-error" : undefined}
          />

          {error && (
            <p id="app-url-error" role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" variant="brand" size="lg" className="w-full" disabled={busy}>
            {busy ? "Connecting..." : "Continue"}
            {!busy && <ArrowRight className="size-4" />}
          </Button>
        </form>

        <p className="mt-5 flex items-start gap-1.5 text-2xs leading-4 text-muted-foreground">
          <Smartphone className="mt-px size-3 shrink-0" />
          <span>
            Tip: to bake this address into the APK permanently, rebuild with the
            <code className="mx-1 rounded bg-muted px-1 py-0.5">CAPACITOR_APP_URL</code>
            variable set. See the README &rarr; Android.
          </span>
        </p>
      </div>
    </div>
  );
}
