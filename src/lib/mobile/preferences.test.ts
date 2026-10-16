import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getStoredAppUrl,
  normaliseAppUrl,
  setStoredAppUrl,
} from "@/lib/mobile/preferences";

describe("normaliseAppUrl", () => {
  it("adds https when the scheme is omitted", () => {
    expect(normaliseAppUrl("example.com")).toBe("https://example.com");
  });

  it("keeps an explicit scheme", () => {
    expect(normaliseAppUrl("http://example.com")).toBe("http://example.com");
  });

  it("reduces a deep link to its origin", () => {
    expect(normaliseAppUrl("https://example.com/chat?id=1#x")).toBe("https://example.com");
  });

  it("preserves a non-default port", () => {
    expect(normaliseAppUrl("example.com:8443")).toBe("https://example.com:8443");
  });

  it("trims surrounding whitespace", () => {
    expect(normaliseAppUrl("  example.com  ")).toBe("https://example.com");
  });

  it("allows an explicit localhost escape hatch", () => {
    expect(normaliseAppUrl("localhost:3000")).toBe("https://localhost:3000");
  });

  it("allows a bare IPv4 address", () => {
    expect(normaliseAppUrl("192.168.1.10:3000")).toBe("https://192.168.1.10:3000");
  });

  it("rejects an empty string", () => {
    expect(normaliseAppUrl("")).toBeNull();
  });

  it("rejects a single word that is not a host", () => {
    expect(normaliseAppUrl("notaurl")).toBeNull();
  });

  it("rejects embedded whitespace", () => {
    expect(normaliseAppUrl("not a url")).toBeNull();
  });

  it("rejects a non-http protocol", () => {
    expect(normaliseAppUrl("ftp://example.com")).toBeNull();
  });
});

describe("stored app url", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubStorage() {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
        removeItem: (key: string) => void store.delete(key),
      },
    });
    return store;
  }

  it("round-trips a value", () => {
    stubStorage();
    setStoredAppUrl("https://example.com");
    expect(getStoredAppUrl()).toBe("https://example.com");
  });

  it("returns null before anything is stored", () => {
    stubStorage();
    expect(getStoredAppUrl()).toBeNull();
  });

  it("clears the value when set to null", () => {
    stubStorage();
    setStoredAppUrl("https://example.com");
    setStoredAppUrl(null);
    expect(getStoredAppUrl()).toBeNull();
  });

  it("ignores a stored value that is not a URL", () => {
    stubStorage();
    setStoredAppUrl("garbage");
    expect(getStoredAppUrl()).toBeNull();
  });

  it("survives localStorage throwing, as it does in private mode", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new Error("denied");
        },
        setItem: () => {
          throw new Error("denied");
        },
        removeItem: () => {
          throw new Error("denied");
        },
      },
    });
    expect(() => setStoredAppUrl("https://example.com")).not.toThrow();
    expect(getStoredAppUrl()).toBeNull();
  });

  it("does nothing on the server where there is no window", () => {
    expect(() => setStoredAppUrl("https://example.com")).not.toThrow();
    expect(getStoredAppUrl()).toBeNull();
  });
});
