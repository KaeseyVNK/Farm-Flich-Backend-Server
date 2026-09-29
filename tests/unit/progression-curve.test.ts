import { describe, it, expect } from "vitest";
import {
  createProgression,
  addXp,
  xpToNext,
  levelFromTotalXp,
  MAX_LEVEL,
} from "../../src/lib/game/progression/progression-curve";

describe("Progression XP curve", () => {
  it("xpToNext: level^2 * 100", () => {
    expect(xpToNext(1)).toBe(100);
    expect(xpToNext(2)).toBe(400);
    expect(xpToNext(5)).toBe(2500);
    expect(xpToNext(10)).toBe(0); // max level
  });

  it("createProgression: level 1, xp 0", () => {
    const p = createProgression();
    expect(p.level).toBe(1);
    expect(p.xp).toBe(0);
    expect(p.skillPoints).toBe(0);
  });

  it("addXp: đủ XP → level up + skill point", () => {
    const p = createProgression();
    const r = addXp(p, 100);
    expect(r.state.level).toBe(2);
    expect(r.state.skillPoints).toBe(1);
    expect(r.levelsGained).toBe(1);
  });

  it("addXp: multi-level up trong 1 lần", () => {
    const p = createProgression();
    // level 1→2 cần 100; 2→3 cần 400; tổng 500.
    const r = addXp(p, 500);
    expect(r.state.level).toBe(3);
    expect(r.state.skillPoints).toBe(2);
    expect(r.levelsGained).toBe(2);
  });

  it("addXp: partial XP không level up", () => {
    const p = createProgression();
    const r = addXp(p, 50);
    expect(r.state.level).toBe(1);
    expect(r.state.xp).toBe(50);
    expect(r.levelsGained).toBe(0);
  });

  it("addXp: cap ở MAX_LEVEL 10", () => {
    const p = createProgression();
    const r = addXp(p, 999999);
    expect(r.state.level).toBe(MAX_LEVEL);
    expect(r.state.xp).toBe(0); // max → xp reset
  });

  it("addXp: totalXp accumulate", () => {
    const p = createProgression();
    const r = addXp(p, 350);
    expect(r.state.totalXp).toBe(350);
  });

  it("addXp: pure (không mutate input)", () => {
    const p = createProgression();
    addXp(p, 500);
    expect(p.level).toBe(1); // unchanged
  });

  it("levelFromTotalXp: tính level từ tổng XP", () => {
    expect(levelFromTotalXp(0)).toBe(1);
    expect(levelFromTotalXp(100)).toBe(2);
    expect(levelFromTotalXp(500)).toBe(3);
    expect(levelFromTotalXp(999999)).toBe(MAX_LEVEL);
  });
});
