"use client";

// ---------------------------------------------------------------------------
// Small persisted client preferences.
//
// Deliberately localStorage rather than @capacitor/preferences: it works
// identically in the browser and inside the WebView, needs no async plumbing,
// and every read is synchronous during render.
// ---------------------------------------------------------------------------

const APP_URL_KEY = "agent-mobile.app-url";

function safeRead(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    // Storage can throw in private mode or when disabled by policy.
    return null;
  }
}

function safeWrite(key: string, value: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {
    /* non-fatal — the session simply will not remember the choice */
  }
}

/** A previously chosen backend URL, if the user set one. */
export function getStoredAppUrl(): string | null {
  const value = safeRead(APP_URL_KEY);
  return value && /^https?:\/\//.test(value) ? value : null;
}

export function setStoredAppUrl(url: string | null) {
  safeWrite(APP_URL_KEY, url);
}

/**
 * Accept what a human actually types (`example.com`, `https://example.com/app`)
 * and reduce it to a safe origin. Returns `null` for anything that is not a
 * plausible http(s) host, so the caller can show a validation error instead of
 * navigating somewhere unexpected.
 */
export function normaliseAppUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value || /\s/.test(value)) return null;

  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  // Require a dot so `localhost`-ish typos and bare words are rejected, but
  // allow an explicit localhost/IP escape hatch for self-hosted setups.
  const isLocal = /^(localhost|\d{1,3}(\.\d{1,3}){3})$/.test(parsed.hostname);
  if (!isLocal && !parsed.hostname.includes(".")) return null;

  return parsed.origin;
}
