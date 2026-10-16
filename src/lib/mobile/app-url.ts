// ---------------------------------------------------------------------------
// Native (Capacitor) awareness.
//
// The web app has no notion that a native shell is displaying it. These
// helpers give the UI that awareness, which matters for one concrete reason:
// a packaged Android app that was never told which URL to load renders a
// blank WebView. Instead of that, the shell reports itself and the setup
// screen takes over.
// ---------------------------------------------------------------------------

/** Where a build should point when no explicit URL was configured. */
export const PRODUCTION_URL = "https://agent-mobile.vercel.app";

/** Inlined at build time by Next.js (must be a NEXT_PUBLIC_* variable). */
const APP_URL_ENV = process.env.NEXT_PUBLIC_APP_URL;

/** True when running inside the Capacitor native shell (Android or iOS). */
export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as {
    Capacitor?: { isNativePlatform?: () => boolean };
  }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

/**
 * URL injected by the Android build via `BuildConfig` (see
 * `android/app/build.gradle`). It arrives as a `NEXT_PUBLIC_*` variable so
 * Next inlines it into the client bundle at build time.
 */
export function buildAppUrl(): string | null {
  const value = process.env.NEXT_PUBLIC_BUILD_APP_URL;
  return value && /^https?:\/\//.test(value) ? value : null;
}

/**
 * The URL a packaged app should load, or `null` when the build was never given
 * one. `null` is a meaningful answer: the setup screen uses it to ask the user
 * for a URL rather than showing a blank page.
 */
export function resolveAppUrl(): string | null {
  return buildAppUrl() ?? (APP_URL_ENV && /^https?:\/\//.test(APP_URL_ENV) ? APP_URL_ENV : null);
}

/** Where the setup screen should suggest pointing the app. */
export function suggestedAppUrl(): string {
  return resolveAppUrl() ?? PRODUCTION_URL;
}
