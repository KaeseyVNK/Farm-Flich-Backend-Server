import { describe, it, expect, beforeEach } from "vitest";
import {
  resetDailyRaidCountIfStale,
  canRaidToday,
  effectiveRaidCap,
  DAILY_RAID_CAP,
} from "../../src/lib/game/raid-cap";
import { useProgressionStore } from "../../src/store/progressionStore";

describe("resetDailyRaidCountIfStale (audit H6 — reset 24h)", () => {
  it("reset khi chưa có dailyRaidResetAt", () => {
    const now = new Date("2026-08-10T12:00:00Z");
    const r = resetDailyRaidCountIfStale({ dailyRaidCount: 2, dailyRaidResetAt: null }, now);
    expect(r.dailyRaidCount).toBe(0);
    expect(r.dailyRaidResetAt).toEqual(now);
  });
  it("reset khi qua 24h", () => {
    const now = new Date("2026-08-11T13:00:00Z");
    const r = resetDailyRaidCountIfStale(
      { dailyRaidCount: 3, dailyRaidResetAt: new Date("2026-08-10T12:00:00Z") },
      now,
    );
    expect(r.dailyRaidCount).toBe(0);
    expect(r.dailyRaidResetAt).toEqual(now);
  });
  it("giữ nguyên khi chưa qua 24h", () => {
    const now = new Date("2026-08-10T23:00:00Z");
    const reset = new Date("2026-08-10T12:00:00Z");
    const r = resetDailyRaidCountIfStale({ dailyRaidCount: 2, dailyRaidResetAt: reset }, now);
    expect(r.dailyRaidCount).toBe(2);
    expect(r.dailyRaidResetAt).toEqual(reset);
  });
});

describe("canRaidToday (cap 3 vụ/ngày — concept §13)", () => {
  it("cho phép khi dưới cap", () => {
    expect(canRaidToday(0)).toBe(true);
    expect(canRaidToday(2)).toBe(true);
  });
  it("reject khi đạt cap", () => {
    expect(canRaidToday(DAILY_RAID_CAP)).toBe(false);
    expect(canRaidToday(5)).toBe(false);
  });
});

describe("effectiveRaidCap + Raid Cap +1 perk (combat rank 4)", () => {
  beforeEach(() => {
    useProgressionStore.getState().reset();
  });
  it("không perk → cap = DAILY_RAID_CAP (3)", () => {
    expect(effectiveRaidCap()).toBe(DAILY_RAID_CAP);
  });
  it("combat rank 4 → cap +1 = 4", () => {
    useProgressionStore.getState().hydrate({
      perkAllocations: { farming: 0, combat: 4, social: 0 },
    });
    expect(effectiveRaidCap()).toBe(DAILY_RAID_CAP + 1);
    // canRaidToday default dùng effectiveRaidCap → count 3 vẫn cho phép khi có perk.
    expect(canRaidToday(3)).toBe(true);
    expect(canRaidToday(4)).toBe(false);
  });
});
