import { describe, it, expect } from "vitest";
import {
  DEFAULT_FX,
  BLOOD_MOON_FX,
  resolveFx,
  LIGHTING_BATCH_WARNING,
} from "../../src/lib/game/phaser/filter-postfx";

describe("Filter post-FX config (ADR-021)", () => {
  it("DEFAULT_FX: vignette + grade dark fantasy", () => {
    expect(DEFAULT_FX.vignette?.strength).toBeGreaterThan(0);
    expect(DEFAULT_FX.grade?.desaturation).toBeGreaterThan(0);
    expect(DEFAULT_FX.bloodMoon).toBe(false);
  });

  it("BLOOD_MOON_FX: mạnh hơn default (vignette + desaturation cao)", () => {
    expect(BLOOD_MOON_FX.vignette!.strength).toBeGreaterThan(DEFAULT_FX.vignette!.strength);
    expect(BLOOD_MOON_FX.grade!.desaturation).toBeGreaterThan(DEFAULT_FX.grade!.desaturation);
    expect(BLOOD_MOON_FX.bloodMoon).toBe(true);
  });

  it("resolveFx: bloodMoon active → BLOOD_MOON_FX", () => {
    expect(resolveFx(true).bloodMoon).toBe(true);
    expect(resolveFx(false).bloodMoon).toBe(false);
  });

  it("LIGHTING_BATCH_WARNING non-empty (spike #11)", () => {
    expect(LIGHTING_BATCH_WARNING.length).toBeGreaterThan(0);
    expect(LIGHTING_BATCH_WARNING).toContain("batching");
  });
});
