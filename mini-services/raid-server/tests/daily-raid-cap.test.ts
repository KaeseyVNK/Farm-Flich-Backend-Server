import { describe, it, expect } from "bun:test";
import {
  effectiveDailyRaidCount,
  canRaidFarm,
  DAILY_RESET_WINDOW_MS,
} from "../src/daily-raid-cap.js";
import { DAILY_RAID_CAP } from "../src/constants.js";

/**
 * Daily raid cap reset window (join gate + finalize RPC share logic).
 * Bug gốc: join chỉ so raw `dailyRaidCount >= cap` — farm đủ cap 1 ngày rồi
 * không bị raid lại → count giữ cap + resetAt cũ → join reject farm mãi dù đã
 * qua 24h. Helper pure tính count hiệu dụng theo reset window.
 */
const NOW = 1_000_000_000_000; // fixed now

describe("effectiveDailyRaidCount", () => {
  it("rawCount null → 0", () => {
    expect(effectiveDailyRaidCount(null, null, NOW)).toBe(0);
  });

  it("resetAt null → count hiệu dụng = rawCount", () => {
    expect(effectiveDailyRaidCount(2, null, NOW)).toBe(2);
  });

  it("trong window (resetAt gần đây) → giữ rawCount", () => {
    const resetAt = new Date(NOW - 1000).toISOString();
    expect(effectiveDailyRaidCount(3, resetAt, NOW)).toBe(3);
  });

  it("qua 24h (resetAt cũ) → reset về 0", () => {
    const resetAt = new Date(NOW - DAILY_RESET_WINDOW_MS - 1).toISOString();
    expect(effectiveDailyRaidCount(3, resetAt, NOW)).toBe(0);
  });

  it("đúng 24h trước → chưa reset (chỉ reset khi > window)", () => {
    const resetAt = new Date(NOW - DAILY_RESET_WINDOW_MS).toISOString();
    expect(effectiveDailyRaidCount(3, resetAt, NOW)).toBe(3);
  });
});

describe("canRaidFarm", () => {
  it("count dưới cap → true", () => {
    expect(canRaidFarm(2, null, NOW)).toBe(true);
  });

  it("count = cap trong window → false", () => {
    expect(canRaidFarm(DAILY_RAID_CAP, new Date(NOW - 1000).toISOString(), NOW)).toBe(false);
  });

  it("count = cap nhưng qua 24h → true (window mới)", () => {
    const resetAt = new Date(NOW - DAILY_RESET_WINDOW_MS - 1).toISOString();
    expect(canRaidFarm(DAILY_RAID_CAP, resetAt, NOW)).toBe(true);
  });
});
