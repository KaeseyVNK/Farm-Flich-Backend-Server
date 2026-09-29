import { describe, it, expect } from "vitest";
import {
  NPC_PRICES,
  PRICE_BAND,
  priceFloor,
  priceCeiling,
  isValidListingPrice,
  MAX_ACTIVE_LISTINGS,
  LISTING_TTL_DAYS,
} from "../../src/lib/game/npc-shop-prices";

// Audit: npc-shop-prices.ts (phase 6 marketplace) chưa có unit test.
// priceFloor/Ceiling + isValidListingPrice kiểm soát băng giá ±60% listing
// trên marketplace — lỗi ở đây tạo spread exploit giá.

describe("npc-shop-prices", () => {
  it("priceFloor/Ceiling quanh NPC_PRICES ± PRICE_BAND (60%)", () => {
    for (const [itemId, npc] of Object.entries(NPC_PRICES)) {
      const floor = priceFloor(itemId);
      const ceiling = priceCeiling(itemId);
      expect(floor, `${itemId} floor`).toBe(Math.max(1, Math.floor(npc * (1 - PRICE_BAND))));
      expect(ceiling, `${itemId} ceiling`).toBe(Math.ceil(npc * (1 + PRICE_BAND)));
      expect(floor, `${itemId} floor < ceiling`).toBeLessThan(ceiling);
      expect(floor, `${itemId} floor >= 1`).toBeGreaterThanOrEqual(1);
    }
  });

  it("isValidListingPrice chấp nhận trong band, từ chối ngoài band", () => {
    // wood: NPC 5 → floor 2, ceiling 8
    expect(isValidListingPrice("wood", 5)).toBe(true); // giá gốc
    expect(isValidListingPrice("wood", 2)).toBe(true); // floor
    expect(isValidListingPrice("wood", 8)).toBe(true); // ceiling
    expect(isValidListingPrice("wood", 1)).toBe(false); // dưới floor
    expect(isValidListingPrice("wood", 9)).toBe(false); // trên ceiling
  });

  it("item không có trong NPC_PRICES → fallback 10 (floor 4, ceiling 16)", () => {
    expect(isValidListingPrice("nonexistent_xyz", 5)).toBe(true); // 10±60% → 4..16
    expect(isValidListingPrice("nonexistent_xyz", 4)).toBe(true);
    expect(isValidListingPrice("nonexistent_xyz", 3)).toBe(false);
    expect(isValidListingPrice("nonexistent_xyz", 17)).toBe(false);
  });

  it("giá trị biên không bị làm tròn sai hướng (floor down, ceiling up)", () => {
    // gem: NPC 50 → floor 20, ceiling 80 (chính xác)
    expect(priceFloor("gem")).toBe(20);
    expect(priceCeiling("gem")).toBe(80);
    // parsnip: NPC 35 → floor 14, ceiling 56
    expect(priceFloor("parsnip")).toBe(14);
    expect(priceCeiling("parsnip")).toBe(56);
  });

  it("hằng số marketplace hợp lệ", () => {
    expect(MAX_ACTIVE_LISTINGS).toBeGreaterThan(0);
    expect(LISTING_TTL_DAYS).toBeGreaterThan(0);
    expect(PRICE_BAND).toBeGreaterThan(0);
    expect(PRICE_BAND).toBeLessThan(1);
  });
});
