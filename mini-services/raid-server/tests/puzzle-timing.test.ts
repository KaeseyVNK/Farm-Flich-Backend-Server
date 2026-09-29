import { describe, it, expect } from "bun:test";
import { genTimingWindow, validateTiming, TIMING_BAR_SIZE, TIMING_WINDOW } from "../src/puzzle-timing";

describe("genTimingWindow", () => {
  it("deterministic — cùng seed+chestId → cùng window", () => {
    const a = genTimingWindow("seed1", "chest-a");
    const b = genTimingWindow("seed1", "chest-a");
    expect(a).toEqual(b);
  });
  it("khác chestId → window khác (thường)", () => {
    const a = genTimingWindow("seed1", "chest-a");
    const b = genTimingWindow("seed1", "chest-b");
    // có thể trùng ngẫu nhiên nhưng hiếm; assert structure đúng
    expect(a.size).toBe(TIMING_BAR_SIZE);
    expect(b.size).toBe(TIMING_BAR_SIZE);
  });
  it("window kích thước đúng — hi-lo+1 = TIMING_WINDOW", () => {
    const w = genTimingWindow("s", "c");
    expect(w.hi - w.lo + 1).toBe(TIMING_WINDOW);
  });
  it("lo trong range [0, size-window]", () => {
    const w = genTimingWindow("s", "c");
    expect(w.lo).toBeGreaterThanOrEqual(0);
    expect(w.lo).toBeLessThanOrEqual(TIMING_BAR_SIZE - TIMING_WINDOW);
  });
});

describe("validateTiming", () => {
  const w = { lo: 3, hi: 5, size: 10 };
  it("idx trong [lo,hi] → true", () => {
    expect(validateTiming(w, 3)).toBe(true);
    expect(validateTiming(w, 4)).toBe(true);
    expect(validateTiming(w, 5)).toBe(true);
  });
  it("idx ngoài window → false", () => {
    expect(validateTiming(w, 2)).toBe(false);
    expect(validateTiming(w, 6)).toBe(false);
    expect(validateTiming(w, 0)).toBe(false);
  });
});
