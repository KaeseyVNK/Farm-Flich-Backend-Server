import { describe, it, expect } from "vitest";
import {
  ANIMALS,
  ANIMAL_STATES,
  animalSpriteKey,
  allAnimalBaseKeys,
  expectedSheetCount,
  type AnimalType,
} from "../../src/lib/game/assets/animal-types";
import { ASSET_MANIFEST } from "../../src/lib/game/assets/asset-manifest";

describe("Animal sprite mapper (8 loài × 5 state)", () => {
  it("8 loài: chicken/cow/duck/goat/horse/pig/sheep/ostrich", () => {
    const types = Object.keys(ANIMALS);
    expect(types).toHaveLength(8);
    expect(types).toEqual(
      expect.arrayContaining([
        "chicken",
        "cow",
        "duck",
        "goat",
        "horse",
        "pig",
        "sheep",
        "ostrich",
      ]),
    );
  });

  it("5 state anim: idle/eat/sleep/run/walk", () => {
    expect(ANIMAL_STATES).toEqual(["idle", "eat", "sleep", "run", "walk"]);
  });

  it("mỗi AnimalType có baseKey", () => {
    for (const def of Object.values(ANIMALS)) {
      expect(def.baseKey).toMatch(/^animal\./);
      expect(def.colorVariants.length).toBeGreaterThan(0);
    }
  });

  it("animalSpriteKey deterministic + state/variant trong key", () => {
    const k = animalSpriteKey("chicken", "walk", 0);
    expect(k).toBe("animal.chicken.walk.white");
    const k2 = animalSpriteKey("chicken", "walk", 0);
    expect(k).toBe(k2);
  });

  it("allAnimalBaseKeys resolve trong manifest phase 1", () => {
    const manifestKeys = new Set(ASSET_MANIFEST.map((e) => e.key));
    for (const base of allAnimalBaseKeys()) {
      expect(manifestKeys.has(base), `missing ${base}`).toBe(true);
    }
  });

  it("expectedSheetCount = 8 × 5 = 40", () => {
    expect(expectedSheetCount()).toBe(40);
  });

  it("variant fallback: variantIdx ngoài range → variant[0]", () => {
    const k = animalSpriteKey("pig", "idle", 99);
    expect(k).toContain("pink"); // pig chỉ có pink
  });
});
