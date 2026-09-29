import { describe, it, expect } from "vitest";
import {
  FEEDBACK_TIERS,
  EVENT_TIER,
  specForEvent,
  hitStopMs,
  clampParticles,
  applyReducedMotion,
} from "../../src/lib/game/feedback/feedback-bundle";

describe("Feedback bundle (juice tiers)", () => {
  it("3 tier có spec đầy đủ shake/hitStop/particles/sfx", () => {
    expect(FEEDBACK_TIERS.small.shake).toBe(0.15);
    expect(FEEDBACK_TIERS.medium.hitStop).toBe(0.05);
    expect(FEEDBACK_TIERS.large.particles).toBe(30);
    expect(FEEDBACK_TIERS.small.sfx).toBe("tick");
    expect(FEEDBACK_TIERS.large.sfx).toBe("boom");
  });

  it("tier order: shake/hitStop/particles tăng dần small→large", () => {
    expect(FEEDBACK_TIERS.small.shake).toBeLessThan(FEEDBACK_TIERS.medium.shake);
    expect(FEEDBACK_TIERS.medium.shake).toBeLessThan(FEEDBACK_TIERS.large.shake);
    expect(FEEDBACK_TIERS.large.particles).toBeGreaterThan(FEEDBACK_TIERS.medium.particles);
  });

  it("event → tier mapping đúng", () => {
    expect(EVENT_TIER.harvest).toBe("small");
    expect(EVENT_TIER["hit-enemy"]).toBe("medium");
    expect(EVENT_TIER["blood-moon-start"]).toBe("large");
    expect(EVENT_TIER["level-up"]).toBe("large");
    expect(EVENT_TIER.death).toBe("large");
    expect(EVENT_TIER.warp).toBe("small");
  });

  it("specForEvent resolve spec", () => {
    expect(specForEvent("death").shake).toBe(0.8);
    expect(specForEvent("harvest").hitStop).toBe(0);
  });

  it("hitStopMs = seconds × 1000 (real-time wait)", () => {
    expect(hitStopMs(FEEDBACK_TIERS.medium)).toBe(50);
    expect(hitStopMs(FEEDBACK_TIERS.large)).toBe(120);
    expect(hitStopMs(FEEDBACK_TIERS.small)).toBe(0);
  });

  it("clampParticles: không vượt budget, không âm", () => {
    expect(clampParticles(30, 100)).toBe(30);
    expect(clampParticles(50, 20)).toBe(20);
    expect(clampParticles(-5, 100)).toBe(0);
  });

  it("applyReducedMotion: kill shake/hitStop/particles khi reduced", () => {
    const reduced = applyReducedMotion(FEEDBACK_TIERS.large, true);
    expect(reduced.shake).toBe(0);
    expect(reduced.hitStop).toBe(0);
    expect(reduced.particles).toBe(0);
    // không reduced → unchanged
    expect(applyReducedMotion(FEEDBACK_TIERS.large, false).shake).toBe(0.8);
  });
});
