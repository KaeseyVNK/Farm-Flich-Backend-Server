import { describe, it, expect } from "vitest";
import { validateTrapPayload } from "../../src/lib/raid/defense-config-service";

// Audit: defense-config-service.ts validateTrapPayload (audit H3 hardening) chưa
// có unit test. Chặn payload không hợp lệ lên DB — kind lạ, tile ngoài map,
// durability ngoài 1-5, level ngoài 1-3.

describe("validateTrapPayload", () => {
  const MAP = 3600; // 60×60 farm

  it("payload hợp lệ → true", () => {
    expect(validateTrapPayload({ kind: "bear", tile: 100, durability: 3, level: 1 }, MAP)).toBe(true);
    expect(validateTrapPayload({ kind: "spike", tile: 0, durability: 1, level: 3 }, MAP)).toBe(true);
    expect(validateTrapPayload({ kind: "alarm", tile: 3599, durability: 5, level: 2 }, MAP)).toBe(true);
  });

  it("kind không thuộc bear/spike/alarm → false", () => {
    expect(validateTrapPayload({ kind: "nuke", tile: 10, durability: 2, level: 1 }, MAP)).toBe(false);
    expect(validateTrapPayload({ kind: "", tile: 10, durability: 2, level: 1 }, MAP)).toBe(false);
  });

  it("tile ngoài range map → false", () => {
    expect(validateTrapPayload({ kind: "bear", tile: -1, durability: 2, level: 1 }, MAP)).toBe(false);
    expect(validateTrapPayload({ kind: "bear", tile: 3600, durability: 2, level: 1 }, MAP)).toBe(false);
    expect(validateTrapPayload({ kind: "bear", tile: 1.5, durability: 2, level: 1 }, MAP)).toBe(false); // không integer
    expect(validateTrapPayload({ kind: "bear", tile: "abc", durability: 2, level: 1 }, MAP)).toBe(false);
  });

  it("durability ngoài 1-5 → false (mặc định 3 khi thiếu)", () => {
    expect(validateTrapPayload({ kind: "bear", tile: 10, durability: 0, level: 1 }, MAP)).toBe(false);
    expect(validateTrapPayload({ kind: "bear", tile: 10, durability: 6, level: 1 }, MAP)).toBe(false);
    expect(validateTrapPayload({ kind: "bear", tile: 10, durability: 2.5, level: 1 }, MAP)).toBe(false);
    // thiếu durability → mặc định 3 (hợp lệ)
    expect(validateTrapPayload({ kind: "bear", tile: 10, level: 1 }, MAP)).toBe(true);
  });

  it("level ngoài 1-3 → false (chặn super-trap, audit H3)", () => {
    expect(validateTrapPayload({ kind: "bear", tile: 10, durability: 2, level: 0 }, MAP)).toBe(false);
    expect(validateTrapPayload({ kind: "bear", tile: 10, durability: 2, level: 4 }, MAP)).toBe(false);
    expect(validateTrapPayload({ kind: "bear", tile: 10, durability: 2, level: 9 }, MAP)).toBe(false);
    // thiếu level → mặc định 1 (hợp lệ)
    expect(validateTrapPayload({ kind: "bear", tile: 10, durability: 2 }, MAP)).toBe(true);
  });

  it("non-object / null / undefined → false", () => {
    expect(validateTrapPayload(null, MAP)).toBe(false);
    expect(validateTrapPayload(undefined, MAP)).toBe(false);
    expect(validateTrapPayload("bear", MAP)).toBe(false);
    expect(validateTrapPayload(42, MAP)).toBe(false);
    expect(validateTrapPayload([], MAP)).toBe(false);
  });
});
