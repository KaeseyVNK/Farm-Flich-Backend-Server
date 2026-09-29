import { describe, it, expect } from "vitest";
import {
  mergeProgression,
  defaultProgression,
} from "../../src/lib/game/cloud/anon-merge";
import { createProgression } from "../../src/lib/game/progression/progression-curve";

describe("Anon → registered merge (ADR-006)", () => {
  it("default: level 1, xp 0 (user mới)", () => {
    expect(defaultProgression()).toEqual(createProgression());
  });

  it("max(level): anon 5 + account 3 → level 5", () => {
    const anon = { ...createProgression(), level: 5, totalXp: 1500 };
    const account = { ...createProgression(), level: 3, totalXp: 500 };
    const merged = mergeProgression(anon, account);
    expect(merged.level).toBeGreaterThanOrEqual(5);
  });

  it("sum totalXp từ cả hai", () => {
    const anon = { ...createProgression(), level: 3, totalXp: 1000 };
    const account = { ...createProgression(), level: 2, totalXp: 400 };
    const merged = mergeProgression(anon, account);
    expect(merged.totalXp).toBe(1400);
  });

  it("sum skillPoints", () => {
    const anon = { ...createProgression(), level: 5, totalXp: 1000, skillPoints: 4 };
    const account = { ...createProgression(), level: 2, totalXp: 400, skillPoints: 1 };
    const merged = mergeProgression(anon, account);
    expect(merged.skillPoints).toBeGreaterThan(4); // 4+1 + bonus level diff
  });

  it("level 5 anon + level 3 account → level 5 (locked edge case plan line 79)", () => {
    const anon = { ...createProgression(), level: 5, totalXp: 1500 };
    const account = { ...createProgression(), level: 3, totalXp: 500 };
    const merged = mergeProgression(anon, account);
    expect(merged.level).toBeGreaterThanOrEqual(5);
  });

  it("1 bên empty (anon chưa chơi) → giữ existing", () => {
    const account = { ...createProgression(), level: 5, totalXp: 1000, skillPoints: 4 };
    const anon = createProgression();
    const merged = mergeProgression(anon, account);
    expect(merged.level).toBe(5);
    expect(merged.totalXp).toBe(1000);
  });

  it("cap MAX_LEVEL 10", () => {
    const anon = { ...createProgression(), level: 10, totalXp: 50000 };
    const account = { ...createProgression(), level: 10, totalXp: 50000 };
    const merged = mergeProgression(anon, account);
    expect(merged.level).toBeLessThanOrEqual(10);
  });
});
