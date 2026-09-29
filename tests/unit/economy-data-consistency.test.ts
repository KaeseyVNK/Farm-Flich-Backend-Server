import { describe, it, expect } from "vitest";
import { ITEMS } from "../../src/lib/game/data";
import { ECONOMY, vendorSellPrice, shippingSellPrice } from "../../src/lib/game/economy";

// Drift guard: data.ts (def.sellPrice, hardcoded) phải KHỚP economy.json (single
// source of truth). 2 kênh bán (vendor qua inv.sellItem dùng def.sellPrice, shipping
// qua shippingSellPrice dùng economy.json) — nếu lệch, player bán vendor nhận giá khác
// shipping box cho cùng item. Trước đây seed price đã drift (CROPS.seedPrice vs seed buy).
// Test này fail nếu ai sửa 1 bên mà quên bên kia → buộc single source.
describe("economy.json ↔ data.ts single-source consistency", () => {
  const allCats = [
    ["crops", ECONOMY.crops],
    ["seeds", ECONOMY.seeds],
    ["resources", ECONOMY.resources],
    ["forage", ECONOMY.forage],
    ["food", ECONOMY.food],
    ["crafts", ECONOMY.crafts],
  ] as const;

  it("mọi item trong economy.json có def.sellPrice khớp vendorSellPrice", () => {
    for (const [, cat] of allCats) {
      for (const [itemId, entry] of Object.entries(cat)) {
        const def = ITEMS[itemId];
        if (!def) continue; // item không có trong data.ts (skip, không phải drift)
        if (def.sellPrice == null) continue;
        const expected = entry.sell ?? entry.base ?? Math.round((entry.buy ?? 0) * 0.5);
        expect(def.sellPrice, `drift: ${itemId} data.ts=${def.sellPrice} vs economy=${expected}`).toBe(expected);
      }
    }
  });

  it("shippingSellPrice = 60% vendorSellPrice cho mọi crop", () => {
    for (const [itemId] of Object.entries(ECONOMY.crops)) {
      const vendor = vendorSellPrice(itemId, "crop");
      const ship = shippingSellPrice(itemId, "crop");
      expect(ship).toBe(Math.round(vendor * ECONOMY.shippingRate));
    }
  });

  it("vendorRate = 1.0, shippingRate = 0.6 (Stardew-style 60% overnight)", () => {
    expect(ECONOMY.vendorRate).toBe(1.0);
    expect(ECONOMY.shippingRate).toBe(0.6);
  });
});
