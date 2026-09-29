import { describe, it, expect } from "bun:test";
import { isBloodMoon, currentUtcDayKey, hashSeed } from "../src/blood-moon.js";

describe("isBloodMoon (review H3b — UTC date, không client-controlled)", () => {
  it("deterministic — cùng (dayKey, ownerId) → cùng kết quả", () => {
    const first = isBloodMoon(20260824, "owner-1");
    for (let i = 0; i < 100; i++) {
      expect(isBloodMoon(20260824, "owner-1")).toBe(first);
    }
  });

  it("~1/7 ngày blood-moon (sanity distribution trên 700 ngày)", () => {
    let count = 0;
    for (let d = 20260101; d < 20260101 + 700; d++) {
      if (isBloodMoon(d, "owner-x")) count++;
    }
    // 700 ngày → kỳ vọng ~100. Cho phép ±40 (statistical, không flaky).
    expect(count).toBeGreaterThan(60);
    expect(count).toBeLessThan(140);
  });

  it("đổi ownerId hoặc dayKey → seed khác (không collision hệ thống)", () => {
    // Cùng key shape nhưng giá trị khác phải độc lập (spot-check 20 cặp).
    let diffs = 0;
    for (let i = 0; i < 20; i++) {
      if (isBloodMoon(20260824, `owner-${i}`) !== isBloodMoon(20260825, `owner-${i}`)) diffs++;
    }
    expect(diffs).toBeGreaterThan(0);
  });

  it("currentUtcDayKey format YYYYMMDD UTC", () => {
    // 2026-08-24 00:30 UTC
    const ms = Date.UTC(2026, 7, 24, 0, 30);
    expect(currentUtcDayKey(ms)).toBe(20260824);
    // 2026-12-31 23:59 UTC
    const ms2 = Date.UTC(2026, 11, 31, 23, 59);
    expect(currentUtcDayKey(ms2)).toBe(20261231);
  });

  it("hashSeed ổn định (regression — đổi thuật toán phá replay persist)", () => {
    // FNV-1a reference value cho chuỗi rỗng = 2166136261.
    expect(hashSeed("")).toBe(2166136261);
  });
});
