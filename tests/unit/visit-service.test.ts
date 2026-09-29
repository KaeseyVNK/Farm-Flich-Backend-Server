import { describe, it, expect, beforeEach } from "vitest";
import {
  checkVisitRateLimit,
  resetVisitRateLimit,
} from "@/lib/social/visit-rate-limit";
import { VISIT_SAFE_KEYS } from "@/lib/social/visit-service";

describe("visit rate-limit 10/min (phase 5 F5.7)", () => {
  beforeEach(() => {
    resetVisitRateLimit("u1");
    resetVisitRateLimit("u2");
  });

  it("10 lần đầu OK, lần 11 reject", () => {
    for (let i = 0; i < 10; i++) {
      expect(checkVisitRateLimit("u1")).toBe(true);
    }
    expect(checkVisitRateLimit("u1")).toBe(false);
  });

  it("rate-limit độc lập per user", () => {
    for (let i = 0; i < 10; i++) checkVisitRateLimit("u1");
    expect(checkVisitRateLimit("u2")).toBe(true); // user khác vẫn OK
  });

  it("reset → cho phép lại", () => {
    for (let i = 0; i < 10; i++) checkVisitRateLimit("u1");
    resetVisitRateLimit("u1");
    expect(checkVisitRateLimit("u1")).toBe(true);
  });
});

describe("visit safe keys projection (F5.5)", () => {
  it("chỉ có terrain/crops/objects/forage/placedDecor — không Inventory/gold/energy", () => {
    // W4: +placedDecor (visit render decor; DECOR_STEALABLE=false nên vô hại với raid)
    // W4 audit-fix: + pondFish (chấm cá ao — fishId/daysGrown vô hại).
    expect(VISIT_SAFE_KEYS).toEqual(["terrain", "crops", "objects", "forage", "placedDecor", "pondFish"]);
    expect(VISIT_SAFE_KEYS).not.toContain("inventory");
    expect(VISIT_SAFE_KEYS).not.toContain("gold");
    expect(VISIT_SAFE_KEYS).not.toContain("gameMeta");
  });
});
