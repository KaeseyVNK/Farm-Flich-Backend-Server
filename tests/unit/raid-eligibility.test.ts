import { describe, it, expect } from "vitest";
import { isFarmRaidable, type FarmStatus } from "../../src/lib/raid/eligibility";

describe("isFarmRaidable (audit M5 — away hoặc offline; red-team #15)", () => {
  const now = new Date("2026-08-10T12:00:00Z");

  it("away + không shield → raid được", () => {
    expect(isFarmRaidable("away", null, now)).toBe(true);
  });
  it("offline + không shield → raid được", () => {
    expect(isFarmRaidable("offline", null, now)).toBe(true);
  });
  it("playing (owner đang ở farm) → KHÔNG raid được", () => {
    expect(isFarmRaidable("playing", null, now)).toBe(false);
  });
  it("shield còn hạn → KHÔNG raid được", () => {
    const future = new Date("2026-08-10T13:00:00Z");
    expect(isFarmRaidable("away", future, now)).toBe(false);
  });
  it("shield hết hạn → raid được", () => {
    const past = new Date("2026-08-10T11:00:00Z");
    expect(isFarmRaidable("away", past, now)).toBe(true);
  });
});
