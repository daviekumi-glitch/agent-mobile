import { describe, expect, it } from "vitest";
import {
  HEAD_GROUP,
  groupAssistantVariants,
  hasVariants,
  pickVariant,
  visibleMessages,
} from "@/lib/variants";
import type { Message, MessageRole } from "@/lib/types";

let counter = 0;

function msg(role: MessageRole, id?: string): Message {
  counter += 1;
  return {
    id: id ?? `${role}-${counter}`,
    conversation_id: "c1",
    user_id: "u1",
    role,
    content: `${role} body`,
    model: null,
    attachments: [],
    token_count: null,
    created_at: new Date(2026, 0, 1, 0, counter).toISOString(),
  };
}

const user1 = msg("user", "u1");
const user2 = msg("user", "u2");
const a1 = msg("assistant", "a1");
const a2 = msg("assistant", "a2");
const a3 = msg("assistant", "a3");
const a4 = msg("assistant", "a4");

describe("groupAssistantVariants", () => {
  it("keys a single answer by its user message", () => {
    const groups = groupAssistantVariants([user1, a1]);
    expect(groups.get("u1")?.map((m) => m.id)).toEqual(["a1"]);
  });

  it("collects several answers to one turn into a single group", () => {
    const groups = groupAssistantVariants([user1, a1, a2, a3]);
    expect(groups.get("u1")?.map((m) => m.id)).toEqual(["a1", "a2", "a3"]);
  });

  it("keeps separate turns in separate groups", () => {
    const groups = groupAssistantVariants([user1, a1, user2, a2, a3]);
    expect(groups.get("u1")?.map((m) => m.id)).toEqual(["a1"]);
    expect(groups.get("u2")?.map((m) => m.id)).toEqual(["a2", "a3"]);
  });

  it("puts a leading run under the head group", () => {
    const groups = groupAssistantVariants([a1, a2]);
    expect(groups.get(HEAD_GROUP)?.map((m) => m.id)).toEqual(["a1", "a2"]);
  });

  it("does not break a run on interleaved tool messages", () => {
    const groups = groupAssistantVariants([user1, a1, msg("tool"), a2]);
    expect(groups.get("u1")?.map((m) => m.id)).toEqual(["a1", "a2"]);
  });

  it("ignores system messages", () => {
    const groups = groupAssistantVariants([msg("system"), user1, a1]);
    expect([...groups.keys()]).toEqual(["u1"]);
  });

  it("returns an empty map for an empty thread", () => {
    expect(groupAssistantVariants([]).size).toBe(0);
  });
});

describe("hasVariants", () => {
  it("is false for a single answer", () => {
    expect(hasVariants(groupAssistantVariants([user1, a1]), "u1")).toBe(false);
  });

  it("is true once a second answer exists", () => {
    expect(hasVariants(groupAssistantVariants([user1, a1, a2]), "u1")).toBe(true);
  });

  it("is false for an unknown group", () => {
    expect(hasVariants(groupAssistantVariants([user1, a1]), "nope")).toBe(false);
  });
});

describe("pickVariant", () => {
  const groups = groupAssistantVariants([user1, a1, a2, a3]);

  it("defaults to the newest variant when nothing is selected", () => {
    expect(pickVariant(groups, "u1", undefined)?.id).toBe("a3");
  });

  it("returns the explicitly selected variant", () => {
    expect(pickVariant(groups, "u1", 0)?.id).toBe("a1");
    expect(pickVariant(groups, "u1", 1)?.id).toBe("a2");
  });

  it("clamps a stale index instead of returning nothing", () => {
    expect(pickVariant(groups, "u1", 99)?.id).toBe("a3");
    expect(pickVariant(groups, "u1", -4)?.id).toBe("a1");
  });

  it("returns null for an unknown group", () => {
    expect(pickVariant(groups, "nope", 0)).toBeNull();
  });
});

describe("visibleMessages", () => {
  it("collapses a variant group to the newest answer by default", () => {
    const visible = visibleMessages([user1, a1, a2], {});
    expect(visible.map((m) => m.id)).toEqual(["u1", "a2"]);
  });

  it("honours the selected index", () => {
    const visible = visibleMessages([user1, a1, a2], { u1: 0 });
    expect(visible.map((m) => m.id)).toEqual(["u1", "a1"]);
  });

  it("leaves a single-answer turn alone", () => {
    const visible = visibleMessages([user1, a1], {});
    expect(visible.map((m) => m.id)).toEqual(["u1", "a1"]);
  });

  it("preserves order across several turns", () => {
    const visible = visibleMessages([user1, a1, a2, user2, a3, a4], { u1: 1 });
    expect(visible.map((m) => m.id)).toEqual(["u1", "a2", "u2", "a4"]);
  });

  it("does not drop non-assistant messages", () => {
    const visible = visibleMessages([user1, msg("tool"), a1, a2], {});
    expect(visible.filter((m) => m.role === "tool")).toHaveLength(1);
  });
});
