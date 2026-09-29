import { describe, it, expect } from "vitest";
import {
  KITCHEN_RECIPES,
  recipesForLevel,
  recipeUnlockLevel,
  missingInputs,
  totalInputCost,
  type IngredientCount,
} from "../../src/lib/game/cooking/recipe-catalog";
import { ITEMS, getItem } from "../../src/lib/game/data";
import { ECONOMY } from "../../src/lib/game/economy";

const avail = (m: Record<string, number>): IngredientCount => m;

describe("recipe-catalog (W2 P1 + W5) — 18 món nấu", () => {
  it("đúng 18 món, id + result unique", () => {
    expect(KITCHEN_RECIPES.length).toBe(18);
    const ids = new Set(KITCHEN_RECIPES.map((r) => r.id));
    const outs = new Set(KITCHEN_RECIPES.map((r) => r.outputItemId));
    expect(ids.size).toBe(18);
    expect(outs.size).toBe(18);
  });

  it("output là item food hợp lệ có energy > 0 và sellPrice > 0", () => {
    for (const r of KITCHEN_RECIPES) {
      const item = getItem(r.outputItemId);
      expect(item, `recipe ${r.id} output ${r.outputItemId} thiếu ITEMS`).toBeDefined();
      expect(item?.type).toBe("food");
      expect(item?.energy ?? 0).toBeGreaterThan(0);
      expect(item?.sellPrice ?? 0).toBeGreaterThan(0);
      // energy món > energy từng nguyên liệu thô (lý do để nấu)
      for (const ing of r.inputs) {
        const rawEnergy = getItem(ing.itemId)?.energy ?? 0;
        if (rawEnergy > 0) expect(r.energy).toBeGreaterThan(rawEnergy);
      }
    }
  });

  it("inputs là item hợp lệ, không seed/fry, qty > 0, ≥1 input", () => {
    for (const r of KITCHEN_RECIPES) {
      expect(r.inputs.length).toBeGreaterThan(0);
      for (const ing of r.inputs) {
        const def = getItem(ing.itemId);
        expect(def, `recipe ${r.id} input ${ing.itemId} thiếu ITEMS`).toBeDefined();
        expect(def?.type).not.toBe("seed");
        expect(ing.itemId.startsWith("fry_")).toBe(false);
        expect(ing.qty).toBeGreaterThan(0);
      }
    }
  });

  it("tier 1..3, unlock 1..5, minigame fields hợp lệ (tier2/3 rounds ≥ 1)", () => {
    for (const r of KITCHEN_RECIPES) {
      expect([1, 2, 3]).toContain(r.tier);
      expect(r.unlockLevel).toBeGreaterThanOrEqual(1);
      expect(r.unlockLevel).toBeLessThanOrEqual(5);
      if (r.tier === 1) {
        expect(r.rounds).toBe(0);
      } else {
        expect(r.rounds).toBeGreaterThanOrEqual(1);
        expect(r.zoneWidth).toBeGreaterThan(0);
        expect(r.zoneWidth).toBeLessThanOrEqual(0.35);
      }
      expect(r.cookXp).toBeGreaterThan(0);
    }
  });

  it("buff chỉ là speed|xp, và có đủ món buff mỗi loại", () => {
    const buffs = KITCHEN_RECIPES.map((r) => r.buff).filter((b): b is "speed" | "xp" => !!b);
    expect(buffs.length).toBeGreaterThanOrEqual(4);
    expect(buffs.includes("speed")).toBe(true);
    expect(buffs.includes("xp")).toBe(true);
  });

  it("recipesForLevel lọc đúng; recipeUnlockLevel lạ → 99", () => {
    const lv1 = recipesForLevel(1);
    expect(lv1.every((r) => r.unlockLevel <= 1)).toBe(true);
    expect(lv1.length).toBeGreaterThanOrEqual(2);
    const lv5 = recipesForLevel(5);
    expect(lv5.length).toBe(18);
    expect(recipesForLevel(1).some((r) => r.id === "ck_sashimi")).toBe(false);
    expect(recipeUnlockLevel("ck_sashimi")).toBe(5);
    expect(recipeUnlockLevel("ck_khong_ton_tai")).toBe(99);
  });

  it("missingInputs: đủ → [], thiếu → đúng deficit (bag∪silo gộp bởi caller)", () => {
    const r = KITCHEN_RECIPES.find((x) => x.id === "ck_omelet")!;
    expect(missingInputs(r, avail({ egg: 2, milk: 1 }))).toEqual([]);
    expect(missingInputs(r, avail({ egg: 1, milk: 1 }))).toEqual([{ itemId: "egg", need: 2, have: 1 }]);
    expect(missingInputs(r, avail({}))).toEqual([
      { itemId: "egg", need: 2, have: 0 },
      { itemId: "milk", need: 1, have: 0 },
    ]);
    // gộp bag+silo: caller cộng lại rồi truyền — hàm thuần không cần biết nguồn
    expect(missingInputs(r, avail({ egg: 1 }))).toEqual([
      { itemId: "egg", need: 2, have: 1 },
      { itemId: "milk", need: 1, have: 0 },
    ]);
  });

  it("lợi nhuận: sellPrice món > tổng giá bán nguyên liệu (mọi món)", () => {
    for (const r of KITCHEN_RECIPES) {
      const dish = getItem(r.outputItemId)!.sellPrice!;
      expect(dish).toBeGreaterThan(totalInputCost(r));
    }
  });

  it("economy.food có entry khớp ITEMS.sellPrice (chặn drift dual-source)", () => {
    for (const r of KITCHEN_RECIPES) {
      const base = (ECONOMY.food as Record<string, { base: number }>)[r.outputItemId]?.base;
      expect(base, `economy.food.${r.outputItemId} thiếu base`).toBeDefined();
      expect(base).toBe(getItem(r.outputItemId)?.sellPrice);
    }
  });

  it("emoji món unique toàn catalog ITEMS (không nhầm identity)", () => {
    const dishIds = new Set(KITCHEN_RECIPES.map((r) => r.outputItemId));
    const seen = new Map<string, string>();
    for (const [id, def] of Object.entries(ITEMS)) {
      if (seen.has(def.emoji)) {
        expect(dishIds.has(id) || dishIds.has(seen.get(def.emoji)!), `emoji ${def.emoji} trùng ${id} vs ${seen.get(def.emoji)}`).toBe(false);
      }
      seen.set(def.emoji, id);
    }
  });
});
