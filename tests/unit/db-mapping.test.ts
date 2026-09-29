import { describe, it, expect } from "vitest";
import {
  sliderToDb,
  dbToSlider,
  duckingGain,
  pitchVariation,
  shouldPauseAudio,
  DUCK,
  MASTER_HEADROOM_DB,
} from "../../src/lib/game/audio/db-mapping";

describe("Audio dB mapping (logarithmic)", () => {
  it("sliderToDb: 0 → -∞ (mute)", () => {
    expect(sliderToDb(0)).toBe(-Infinity);
  });

  it("sliderToDb: 1 → 0 dBFS", () => {
    expect(sliderToDb(1)).toBeCloseTo(0, 5);
  });

  it("sliderToDb: logarithmic — 0.5 ≈ -6dB (half power ≈ -6)", () => {
    expect(sliderToDb(0.5)).toBeCloseTo(-6.02, 1);
  });

  it("dbToSlider inverse của sliderToDb", () => {
    for (const s of [0.1, 0.3, 0.5, 0.7, 1]) {
      expect(dbToSlider(sliderToDb(s))).toBeCloseTo(s, 3);
    }
  });

  it("dbToSlider(-∞) = 0", () => {
    expect(dbToSlider(-Infinity)).toBe(0);
  });

  it("duckingGain: active → gain < 1 (dip)", () => {
    expect(duckingGain(true)).toBeLessThan(1);
    expect(duckingGain(false)).toBe(1);
  });

  it("DUCK: -12dB dip, attack 10ms, release 300-500ms", () => {
    expect(DUCK.dipDb).toBe(-12);
    expect(DUCK.attackMs).toBe(10);
    expect(DUCK.releaseMs).toBeGreaterThanOrEqual(300);
    expect(DUCK.releaseMs).toBeLessThanOrEqual(500);
  });

  it("MASTER_HEADROOM < 0 dBFS", () => {
    expect(MASTER_HEADROOM_DB).toBeLessThan(0);
  });

  it("pitchVariation: deterministic ±6% (0.94..1.06)", () => {
    const v1 = pitchVariation(5);
    const v2 = pitchVariation(5);
    expect(v1).toBe(v2); // deterministic
    expect(v1).toBeGreaterThanOrEqual(0.94);
    expect(v1).toBeLessThanOrEqual(1.06);
  });

  it("pitchVariation: khác seed → có thể khác giá trị", () => {
    const vals = new Set<number>();
    for (let i = 0; i < 20; i++) vals.add(pitchVariation(i));
    expect(vals.size).toBeGreaterThan(1);
  });

  it("shouldPauseAudio: hidden → true", () => {
    expect(shouldPauseAudio(true)).toBe(true);
    expect(shouldPauseAudio(false)).toBe(false);
  });
});
