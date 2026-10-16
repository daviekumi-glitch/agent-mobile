import { afterEach, describe, expect, it, vi } from "vitest";
import { buildAppUrl, isNativeApp, resolveAppUrl, suggestedAppUrl } from "@/lib/mobile/app-url";

const ORIGINAL_BUILD_URL = process.env.NEXT_PUBLIC_BUILD_APP_URL;

afterEach(() => {
  vi.unstubAllGlobals();
  if (ORIGINAL_BUILD_URL === undefined) delete process.env.NEXT_PUBLIC_BUILD_APP_URL;
  else process.env.NEXT_PUBLIC_BUILD_APP_URL = ORIGINAL_BUILD_URL;
});

describe("isNativeApp", () => {
  it("is false on the server, where there is no window", () => {
    expect(isNativeApp()).toBe(false);
  });

  it("is false in a browser that has no Capacitor bridge", () => {
    vi.stubGlobal("window", {});
    expect(isNativeApp()).toBe(false);
  });

  it("is true when the Capacitor bridge reports a native platform", () => {
    vi.stubGlobal("window", { Capacitor: { isNativePlatform: () => true } });
    expect(isNativeApp()).toBe(true);
  });

  it("survives a Capacitor object with no isNativePlatform", () => {
    vi.stubGlobal("window", { Capacitor: {} });
    expect(isNativeApp()).toBe(false);
  });
});

describe("buildAppUrl", () => {
  it("is null when the build injected nothing", () => {
    delete process.env.NEXT_PUBLIC_BUILD_APP_URL;
    expect(buildAppUrl()).toBeNull();
  });

  it("returns the injected URL", () => {
    process.env.NEXT_PUBLIC_BUILD_APP_URL = "https://app.example.com";
    expect(buildAppUrl()).toBe("https://app.example.com");
  });

  it("rejects a non-http value so a bad injection cannot crash the shell", () => {
    process.env.NEXT_PUBLIC_BUILD_APP_URL = "javascript:alert(1)";
    expect(buildAppUrl()).toBeNull();
  });

  it("rejects an empty injection", () => {
    process.env.NEXT_PUBLIC_BUILD_APP_URL = "";
    expect(buildAppUrl()).toBeNull();
  });
});

describe("resolveAppUrl / suggestedAppUrl", () => {
  it("prefers the build-injected URL", () => {
    process.env.NEXT_PUBLIC_BUILD_APP_URL = "https://build.example.com";
    expect(resolveAppUrl()).toBe("https://build.example.com");
  });

  it("falls back to null when nothing is configured, which the setup screen needs", () => {
    delete process.env.NEXT_PUBLIC_BUILD_APP_URL;
    // NEXT_PUBLIC_APP_URL is captured at import time and is unset in tests.
    expect(resolveAppUrl()).toBeNull();
  });

  it("always offers a suggestion for the setup form", () => {
    delete process.env.NEXT_PUBLIC_BUILD_APP_URL;
    expect(suggestedAppUrl()).toMatch(/^https:\/\//);
  });
});
