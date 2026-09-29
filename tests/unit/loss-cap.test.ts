import { describe, it, expect } from "vitest";
import {
  computeStealableNow,
  PER_RAID_CAP_PCT,
  PER_DAY_CAP_PCT,
} from "../../src/lib/raid/loss-cap";

describe("computeStealableNow (concept §13 loss cap — per-raid 10% / per-day 25%)", () => {
  it("pool 100, chưa mất hôm nay → min(10, 25) = 10", () => {
    expect(computeStealableNow(100, 0)).toBe(10);
  });
  it("pool 100, đã mất 20 hôm nay → min(10, 25-20=5) = 5", () => {
    expect(computeStealableNow(100, 20)).toBe(5);
  });
  it("pool 100, đã mất đủ 25 hôm nay → 0 (day cap đạt)", () => {
    expect(computeStealableNow(100, 25)).toBe(0);
  });
  it("pool 50, chưa mất → min(5, 12) = 5 (per-raid cap chặn trước)", () => {
    expect(computeStealableNow(50, 0)).toBe(5);
  });
  it("pool 0 → 0", () => {
    expect(computeStealableNow(0, 0)).toBe(0);
  });
  it("không vượt per-raid cap", () => {
    const r = computeStealableNow(1000, 0);
    expect(r).toBe(100); // 10% của 1000
    expect(r).toBeLessThanOrEqual(1000 * PER_RAID_CAP_PCT);
  });
});
