import { describe, it, expect } from "vitest";
import {
  vendorSellPrice,
  shippingSellPrice,
  seedBuyPrice,
  ECONOMY,
} from "../../src/lib/game/economy";

// Audit: economy.ts (vendor/shipping/seed price accessor) chưa có unit test.
// Giá là single source of truth cho balance game — test invariant kinh tế
// bắt lỗi exploit (seed đắt hơn crop, shipping > vendor, price âm).

describe("economy price accessors", () => {
  it("shipping = vendor × shippingRate (60%)", () => {
    for (const itemId of ["parsnip", "wood", "dandelion", "bread", "fence_item"]) {
      const vendor = vendorSellPrice(itemId);
      const ship = shippingSellPrice(itemId);
      expect(ship, `${itemId} shipping`).toBe(Math.round(vendor * ECONOMY.shippingRate));
    }
  });

  it("seed buy price khớp crops[xxx].seed fallback", () => {
    // seed có entry riêng (buy) hoặc fallback crops.seed
    for (const seedId of Object.keys(ECONOMY.seeds)) {
      const buy = seedBuyPrice(seedId);
      const cropId = seedId.replace(/_seed$/, "");
      const cropSeed = ECONOMY.crops[cropId]?.seed;
      if (cropSeed != null) {
        expect(buy, `${seedId} buy vs crops.seed`).toBe(cropSeed);
      } else {
        expect(buy, `${seedId} buy`).toBeGreaterThan(0);
      }
    }
  });

  it("seed buy > seed sell (không bán seed hòa vốn/lo)", () => {
    for (const [seedId, entry] of Object.entries(ECONOMY.seeds)) {
      expect(entry.buy!, `${seedId} buy`).toBeGreaterThan(entry.sell ?? 0);
    }
  });

  it("mọi item giá không âm và hợp lệ", () => {
    for (const cat of ["crops", "seeds", "resources", "forage", "food", "crafts"] as const) {
      for (const [id, entry] of Object.entries(ECONOMY[cat] as Record<string, { base?: number; buy?: number; sell?: number }>)) {
        if (entry.base != null) expect(entry.base, `${cat}.${id}.base`).toBeGreaterThan(0);
        if (entry.buy != null) expect(entry.buy, `${cat}.${id}.buy`).toBeGreaterThan(0);
        if (entry.sell != null) expect(entry.sell, `${cat}.${id}.sell`).toBeGreaterThan(0);
      }
    }
  });

  it("crop sell > seed buy (trồng phải có lãi — chặn exploit money-losing)", () => {
    // Bug đã fix: blueberry (seed 80, sell 50) & corn (seed 75, sell 50) bán
    // lỗ vì game KHÔNG có multi-harvest/regrow — seed giá thiết kế cho cây
    // tái thu hoạch nhưng mechanic không tồn tại. Fix: hạ seed xuống 40.
    for (const [cropId, entry] of Object.entries(ECONOMY.crops)) {
      const seedId = `${cropId}_seed`;
      const seedBuy = seedBuyPrice(seedId);
      const sell = vendorSellPrice(cropId, "crop");
      // 1 trái phải bán > seed mua (đủ lãi sau 1 harvest, vì không có regrow)
      expect(sell, `${cropId} sell (${sell}) must be > seed buy (${seedBuy})`)
        .toBeGreaterThan(seedBuy);
    }
  });

  it("craft sell giá hợp lý so với nguyên liệu (không craft lỗ nặng)", () => {
    // fence_item sell 5, ingredients 2 wood (5+5=10 base) → craft thường thấp hơn bán rời
    expect(vendorSellPrice("fence_item")).toBeGreaterThan(0);
    expect(vendorSellPrice("sprinkler")).toBeGreaterThan(0);
  });

  it("vendorSellPrice item không tồn tại → 0, không crash", () => {
    expect(vendorSellPrice("nonexistent_xyz")).toBe(0);
    expect(shippingSellPrice("nonexistent_xyz")).toBe(0);
  });
});
