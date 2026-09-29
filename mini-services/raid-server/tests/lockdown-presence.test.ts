import { test, expect } from "bun:test";
import { derivePresenceState } from "../src/lockdown-presence.js";

test("offline khi owner không trong presence", () => {
  expect(derivePresenceState({}, "u1")).toBe("offline");
  expect(derivePresenceState({ u2: [{ status: "playing" }] }, "u1")).toBe("offline");
});

test("playing khi owner track status playing", () => {
  expect(derivePresenceState({ u1: [{ status: "playing" }] }, "u1")).toBe("playing");
});

test("away khi owner online nhưng status away", () => {
  expect(derivePresenceState({ u1: [{ status: "away" }] }, "u1")).toBe("away");
});

test("away khi owner online nhưng thiếu status", () => {
  expect(derivePresenceState({ u1: [{}] }, "u1")).toBe("away");
});

test("playing ưu tiên khi 1 trong nhiều presence playing", () => {
  expect(derivePresenceState({ u1: [{ status: "away" }, { status: "playing" }] }, "u1")).toBe("playing");
});
