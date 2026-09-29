import { describe, it, expect } from "bun:test";
import { getMaskEffect, MASK_EFFECTS, DEFAULT_MASK_EFFECT, type MaskId } from "../src/mask-effects";

describe("getMaskEffect (phase 4)", () => {
  it("rogue → speed ×1.2, other default", () => {
    const e = getMaskEffect("rogue");
    expect(e.speedMult).toBe(1.2);
    expect(e.alertDecayMult).toBe(1);
    expect(e.dogVisionMult).toBe(1);
  });
  it("phantom → alertDecay ×1.5", () => {
    expect(getMaskEffect("phantom").alertDecayMult).toBe(1.5);
  });
  it("bandit → lootCap +10%", () => {
    expect(getMaskEffect("bandit").lootCapBonus).toBe(0.1);
  });
  it("scout → dogVision ×0.75", () => {
    expect(getMaskEffect("scout").dogVisionMult).toBe(0.75);
  });
  it("unknown maskId → default (no bonus)", () => {
    expect(getMaskEffect("nonexistent")).toEqual(DEFAULT_MASK_EFFECT);
  });
  it("8 mask defined (4 tier 1 + 4 tier 2 chợ đen W7d-P2)", () => {
    expect(Object.keys(MASK_EFFECTS).length).toBe(8);
    (["rogue", "phantom", "bandit", "scout", "rogue2", "phantom2", "bandit2", "scout2"] as MaskId[]).forEach((m) => {
      expect(MASK_EFFECTS[m]).toBeDefined();
    });
  });
  it("tier 2 ≈ tier 1 ×1.15 (hiệu ứng mạnh hơn 15%)", () => {
    expect(MASK_EFFECTS.rogue2.speedMult).toBeCloseTo(1.2 * 1.15, 2);
    expect(MASK_EFFECTS.phantom2.alertDecayMult).toBeCloseTo(1.5 * 1.15, 2);
    expect(MASK_EFFECTS.bandit2.lootCapBonus).toBeCloseTo(0.1 * 1.15, 2);
    expect(MASK_EFFECTS.scout2.dogVisionMult).toBeCloseTo(0.75 * 1.15, 2);
  });
});
