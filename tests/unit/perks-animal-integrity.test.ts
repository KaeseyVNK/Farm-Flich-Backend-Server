import { describe, it, expect } from "vitest";
import { PERKS } from "../../src/lib/game/progression/perks";
import {
  ANIMALS,
  ANIMAL_STATES,
  animalSpriteKey,
  allAnimalBaseKeys,
  expectedSheetCount,
} from "../../src/lib/game/assets/animal-types";
import {
  DEFENSE_MAX_LEVEL,
  DEFENSE_UPGRADE_COST_PER_LEVEL,
  upgradeCost,
  DEFENSE_LABEL,
} from "../../src/lib/game/defense-xp-config";

// Audit: perks.ts (3 tree × 10 rank), animal-types.ts (8 loài × 5 state),
// defense-xp-config.ts (cost/label) chưa có unit test integrity.

describe("PERKS data integrity", () => {
  it("3 skill tree, mỗi tree đủ rank 1-10 liên tục", () => {
    const trees = Object.keys(PERKS);
    expect(trees.sort()).toEqual(["combat", "farming", "social"]);
    for (const [tree, perks] of Object.entries(PERKS)) {
      const ranks = perks.map((p) => p.rank).sort((a, b) => a - b);
      expect(ranks, `${tree} rank`).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      expect(perks.length).toBe(10);
    }
  });

  it("mọi perk có id unique + name/desc/effectHook đầy đủ", () => {
    const seen = new Set<string>();
    for (const perks of Object.values(PERKS)) {
      for (const p of perks) {
        expect(seen.has(p.id), `${p.id} trùng id`).toBe(false);
        seen.add(p.id);
        expect(p.name).toBeTruthy();
        expect(p.desc).toBeTruthy();
        expect(p.effectHook).toBeTruthy();
      }
    }
  });

  it("modifier (nếu có) là chuỗi non-empty + effectHook trỏ đúng target", () => {
    for (const perks of Object.values(PERKS)) {
      for (const p of perks) {
        // modifier optional nhưng nếu có phải non-empty
        if (p.modifier != null) expect(p.modifier.length).toBeGreaterThan(0);
        // effectHook theo dạng `file.ts:method` (actions.ts:harvest) hoặc `domain:method` (raid:loot)
        expect(p.effectHook).toMatch(/^[a-z-]+(\.ts)?:[a-zA-Z]+$/);
      }
    }
  });
});

describe("animal-types", () => {
  it("8 loài × 5 state = 40 sheet", () => {
    expect(Object.keys(ANIMALS).length).toBe(8);
    expect(ANIMAL_STATES.length).toBe(5);
    expect(expectedSheetCount()).toBe(40);
  });

  it("animalSpriteKey tạo key theo baseKey.state.variant", () => {
    expect(animalSpriteKey("chicken", "idle")).toBe("animal.chicken.idle.white");
    expect(animalSpriteKey("chicken", "run", 1)).toBe("animal.chicken.run.brown");
    expect(animalSpriteKey("pig", "walk", 5)).toBe("animal.pig.walk.pink"); // variant fallback
  });

  it("allAnimalBaseKeys trả 8 key duy nhất", () => {
    const keys = allAnimalBaseKeys();
    expect(keys.length).toBe(8);
    expect(new Set(keys).size).toBe(8);
    expect(keys).toContain("animal.ostrich");
  });

  it("mọi animal có ít nhất 1 color variant + baseKey đúng prefix", () => {
    for (const [type, def] of Object.entries(ANIMALS)) {
      expect(def.baseKey, `${type} baseKey`).toBe(`animal.${type}`);
      expect(def.colorVariants.length).toBeGreaterThan(0);
    }
  });
});

describe("defense-xp-config", () => {
  it("upgradeCost = level × 50", () => {
    expect(upgradeCost(1)).toBe(50);
    expect(upgradeCost(2)).toBe(100);
    expect(upgradeCost(DEFENSE_MAX_LEVEL)).toBe(DEFENSE_MAX_LEVEL * DEFENSE_UPGRADE_COST_PER_LEVEL);
  });

  it("DEFENSE_MAX_LEVEL >= 1 + label đủ 3 target", () => {
    expect(DEFENSE_MAX_LEVEL).toBeGreaterThanOrEqual(1);
    expect(Object.keys(DEFENSE_LABEL).sort()).toEqual(["dog", "fence", "trap"]);
    for (const label of Object.values(DEFENSE_LABEL)) expect(label).toBeTruthy();
  });
});
