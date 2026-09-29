import { describe, it, expect } from "vitest";
import { MASK_CATALOG, findRecipe } from "../../src/lib/game/mask-catalog";
import { ITEMS } from "../../src/lib/game/data";

// Audit: mask-catalog.ts (phase 4 mask recipe). 4 mask — integrity:
// maskId duy nhất, mọi ingredient phải tồn tại trong client ITEMS (craftable
// không cần raid-loot-only item như cloth/gem/iron — chicken-egg: cần mask để
// raid, cần raid để có item craft mask).

describe("mask-catalog", () => {
  it("4 mask với maskId duy nhất", () => {
    const ids = MASK_CATALOG.map((m) => m.maskId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("rogue");
    expect(ids).toContain("phantom");
    expect(ids).toContain("bandit");
    expect(ids).toContain("scout");
  });

  it("mọi ingredient tồn tại trong ITEMS (craftable từ farm, không raid-only) + qty > 0", () => {
    // Trước đây recipe dùng cloth/gem/iron — không có trong ITEMS (cloth không có
    // path thu thập nào, gem/iron chỉ rớt từ raid chest). Mask uncraftable.
    for (const m of MASK_CATALOG) {
      expect(Object.keys(m.ingredients).length, `${m.maskId} ingredients`).toBeGreaterThan(0);
      for (const [item, qty] of Object.entries(m.ingredients)) {
        expect(ITEMS[item], `${m.maskId} ingredient ${item} không có trong ITEMS`).toBeDefined();
        expect(qty, `${m.maskId} ${item} qty`).toBeGreaterThan(0);
      }
    }
  });

  it("không ingredient nào là item raid-only (cloth/gem/iron/gold_ore) — chặn chicken-egg", () => {
    const RAID_ONLY = new Set(["cloth", "gem", "iron", "gold_ore", "gold_bar", "coin_pouch"]);
    for (const m of MASK_CATALOG) {
      for (const item of Object.keys(m.ingredients)) {
        expect(RAID_ONLY.has(item), `${m.maskId} dùng raid-only ${item}`).toBe(false);
      }
    }
  });

  it("goldCost > 0, durabilityCap > 0, tier >= 1", () => {
    for (const m of MASK_CATALOG) {
      expect(m.goldCost, `${m.maskId} goldCost`).toBeGreaterThan(0);
      expect(m.durabilityCap, `${m.maskId} durabilityCap`).toBeGreaterThan(0);
      expect(m.tier, `${m.maskId} tier`).toBeGreaterThanOrEqual(1);
      expect(m.label, `${m.maskId} label`).toBeTruthy();
      expect(m.desc, `${m.maskId} desc`).toBeTruthy();
    }
  });

  it("findRecipe tìm đúng mask, trả undefined cho mask lạ", () => {
    expect(findRecipe("rogue")?.label).toBe(MASK_CATALOG[0].label);
    expect(findRecipe("phantom")?.maskId).toBe("phantom");
    expect(findRecipe("bandit")?.ingredients).toEqual({ stone: 12 });
    expect(findRecipe("scout")?.label).toContain("Lẩn tránh"); // label chứa tên mask
    expect(findRecipe("nobody")).toBeUndefined();
  });
});
