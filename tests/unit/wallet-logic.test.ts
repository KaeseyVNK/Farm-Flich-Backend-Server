import { describe, it, expect } from "vitest";
import { validateGoldDelta, computeInventoryDelta } from "../../src/lib/game/wallet-logic";

describe("validateGoldDelta (server-authoritative gold — audit C1)", () => {
  it("cộng delta dương", () => {
    expect(validateGoldDelta(500, 120)).toBe(620);
  });
  it("trừ delta âm hợp lệ", () => {
    expect(validateGoldDelta(500, -200)).toBe(300);
  });
  it("reject kết quả âm (cheat / race)", () => {
    expect(() => validateGoldDelta(100, -200)).toThrow();
  });
  it("cho phép về đúng 0", () => {
    expect(validateGoldDelta(100, -100)).toBe(0);
  });
});

describe("computeInventoryDelta (atomic, chặn âm)", () => {
  it("thêm item", () => {
    expect(computeInventoryDelta(5, 3)).toEqual({ ok: true, newQty: 8 });
  });
  it("trừ item hợp lệ", () => {
    expect(computeInventoryDelta(5, -3)).toEqual({ ok: true, newQty: 2 });
  });
  it("reject trừ quá số hiện có (loot race)", () => {
    expect(computeInventoryDelta(2, -5)).toEqual({ ok: false, newQty: 2 });
  });
});
