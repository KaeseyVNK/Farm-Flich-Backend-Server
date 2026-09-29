// Animal type mapper (phase 4 — ADR-013 full 5-state from start).
// 8 loài farm: Chicken/Cow/Duck/Goat/Horse/Pig/Sheep/Ostrich.
// Full 5 state anim: idle/eat/sleep/run/walk. Fallback single-pose nếu sheet thiếu.
export type AnimalType =
  | "chicken"
  | "cow"
  | "duck"
  | "goat"
  | "horse"
  | "pig"
  | "sheep"
  | "ostrich";

export type AnimalState = "idle" | "eat" | "sleep" | "run" | "walk";
export const ANIMAL_STATES: AnimalState[] = ["idle", "eat", "sleep", "run", "walk"];

export interface AnimalDef {
  id: AnimalType;
  baseKey: string; // manifest asset key (animal.<type>)
  colorVariants: string[]; // vd chicken: ["white","brown"] — sheet suffix khi có
}

export const ANIMALS: Record<AnimalType, AnimalDef> = {
  chicken: { id: "chicken", baseKey: "animal.chicken", colorVariants: ["white", "brown"] },
  cow: { id: "cow", baseKey: "animal.cow", colorVariants: ["brown", "blonde"] },
  duck: { id: "duck", baseKey: "animal.duck", colorVariants: ["white"] },
  goat: { id: "goat", baseKey: "animal.goat", colorVariants: ["white", "brown"] },
  horse: { id: "horse", baseKey: "animal.horse", colorVariants: ["brown", "black"] },
  pig: { id: "pig", baseKey: "animal.pig", colorVariants: ["pink"] },
  sheep: { id: "sheep", baseKey: "animal.sheep", colorVariants: ["white"] },
  ostrich: { id: "ostrich", baseKey: "animal.ostrich", colorVariants: ["black"] },
};

/**
 * Sprite key cho animal + state + color variant.
 * Phase 1 manifest có base sheet per loài; full 5-state sheet wire phase 4 visual gate.
 */
export function animalSpriteKey(type: AnimalType, state: AnimalState, variantIdx = 0): string {
  const def = ANIMALS[type];
  const variant = def.colorVariants[variantIdx] ?? def.colorVariants[0];
  // Phase 1 manifest key = base (single sheet). Phase 4 full-state: `${baseKey}.${state}`.
  return `${def.baseKey}.${state}.${variant}`;
}

/** All 8 loài có baseKey trong manifest. */
export function allAnimalBaseKeys(): string[] {
  return Object.values(ANIMALS).map((a) => a.baseKey);
}

/** Sanity: 8 loài × 5 state = 40 sheet (variant color = roadmap expansion). */
export function expectedSheetCount(): number {
  return Object.keys(ANIMALS).length * ANIMAL_STATES.length;
}
