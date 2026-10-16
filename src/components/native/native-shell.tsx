"use client";

import * as React from "react";
import { AppUrlSetup } from "@/components/native/app-url-setup";
import { isNativeApp, resolveAppUrl } from "@/lib/mobile/app-url";
import { getStoredAppUrl, setStoredAppUrl } from "@/lib/mobile/preferences";

/** sessionStorage key guarding against a redirect loop. */
const REDIRECT_FLAG = "agent-mobile.redirecting";

/**
 * Native-shell gate.
 *
 * On the web this renders its children and does nothing else. Inside the
 * Capacitor WebView it makes sure the app has somewhere to point:
 *
 * 1. A URL baked in at build time (via `server.url`, handed down through
 *    `NEXT_PUBLIC_BUILD_APP_URL`) - render normally.
 * 2. A URL the user saved earlier - navigate the WebView there once.
 * 3. Neither - show the setup screen instead of a blank page.
 */
export function NativeShell({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = React.useState(false);
  const [native, setNative] = React.useState(false);

  React.useEffect(() => {
    const isNative = isNativeApp();
    setNative(isNative);

    if (isNative) {
      const stored = getStoredAppUrl();
      const loopGuard = window.sessionStorage?.getItem(REDIRECT_FLAG);

      // Only follow a stored URL when it points somewhere other than where we
      // already are, and only once per session - otherwise a bad value would
      // bounce the user forever.
      if (stored && stored !== window.location.origin && loopGuard !== stored) {
        try {
          window.sessionStorage.setItem(REDIRECT_FLAG, stored);
        } catch {
          /* sessionStorage unavailable - proceed without the guard */
        }
        window.location.replace(stored);
        return;
      }
    }

    setReady(true);
  }, []);

  // Render children during SSR and on the first client paint so the app is not
  // held back behind a hydration check on the web.
  if (!ready || !native) return <>{children}</>;

  const configured = getStoredAppUrl() ?? resolveAppUrl();
  if (configured) return <>{children}</>;

  return (
    <AppUrlSetup
      onConfigured={(url) => {
        setStoredAppUrl(url);
        try {
          window.sessionStorage.setItem(REDIRECT_FLAG, url);
        } catch {
          /* non-fatal */
        }
        window.location.replace(url);
      }}
    />
  );
}
