// IconManifest — map itemId/category → icon asset key (replaces emoji in ITEMS/data).
//
// Phase 1 contract (implementation-handoff-contract §Asset contract): the resolver NEVER
// returns a key that is absent from ASSET_MANIFEST. When no approved icon sheet exists for
// a category, it returns a typed `placeholder` descriptor and the caller renders an
// explicit documented fallback. A consumer may not catch an error and substitute a
// misleading `icon.default`-style key that does not exist.
import { ASSET_MANIFEST } from "./asset-manifest";

export type IconCategory = "food" | "fish" | "bug" | "tool" | "weapon" | "resource" | "seed";

const manifestKeys = new Set(ASSET_MANIFEST.map((e) => e.key));

/** Resolution result: either a real approved key or a documented placeholder descriptor. */
export type IconResolution =
  | { status: "approved"; key: string }
  | { status: "placeholder"; category: IconCategory; reason: string };

/** Reason used while Phase 1 manifest has no dedicated icon sheets yet. */
const PLACEHOLDER_REASON =
  "icon sheet chưa trong manifest (phase 1); render fallback hình học + label";

/** Per-item icon keys in ASSET_MANIFEST. Category sheets still optional. */
const ITEM_ICON_KEY: Record<string, string> = {
  hoe: "icon.hoe",
  watering_can: "icon.water",
  axe: "icon.axe",
  pickaxe: "icon.pickaxe",
  scythe: "icon.scythe",
  fishing_rod: "icon.rod",
  parsnip: "icon.parsnip",
  parsnip_seed: "icon.parsnip",
  cauliflower: "icon.cauliflower",
  cauliflower_seed: "icon.cauliflower",
  potato: "icon.potato",
  potato_seed: "icon.potato",
  carrot: "icon.carrot",
  carrot_seed: "icon.carrot",
  blueberry: "icon.blueberry",
  blueberry_seed: "icon.blueberry",
  tomato: "icon.tomato",
  tomato_seed: "icon.tomato",
  pumpkin: "icon.pumpkin",
  pumpkin_seed: "icon.pumpkin",
  corn: "icon.corn",
  corn_seed: "icon.corn",
  cabbage: "icon.cabbage",
  cabbage_seed: "icon.cabbage",
  strawberry: "icon.strawberry",
  strawberry_seed: "icon.strawberry",
  onion: "icon.onion",
  onion_seed: "icon.onion",
  wheat: "icon.wheat",
  egg: "icon.egg",
  milk: "icon.milk",
  fry_sunfish: "icon.fish.sunfish",
  fry_perch: "icon.fish.perch",
  fry_carp: "icon.fish.carp",
  // Wave 1 P1 — fish (Icons/Fish River+Sea, 12 unique icons).
  sunfish: "icon.fish.sunfish",
  perch: "icon.fish.perch",
  carp: "icon.fish.carp",
  chub: "icon.fish.chub",
  bass: "icon.fish.bass",
  pike: "icon.fish.pike",
  tiger_trout: "icon.fish.tiger-trout",
  sturgeon: "icon.fish.sturgeon",
  anchovy: "icon.fish.anchovy",
  sardine: "icon.fish.sardine",
  red_snapper: "icon.fish.red-snapper",
  tuna: "icon.fish.tuna",
  // Wave 2 P1 — dishes (Icons/Food Icons).
  parsnip_soup: "icon.food.parsnip-soup",
  boiled_egg: "icon.food.boiled-egg",
  baked_fish: "icon.food.baked-fish",
  pancakes: "icon.food.pancakes",
  veggie_mix: "icon.food.veggie-mix",
  fruit_salad: "icon.food.fruit-salad",
  omelet: "icon.food.omelet",
  fish_stew: "icon.food.fish-stew",
  sashimi: "icon.food.sashimi",
  pumpkin_soup: "icon.food.pumpkin-soup",
  fish_tacos: "icon.food.fish-tacos",
  stuffed_peppers: "icon.food.stuffed-peppers",
  casserole: "icon.food.casserole",
  complete_breakfast: "icon.food.complete-breakfast",
  bread: "icon.food.bread",
  // Craft salad — closest unique dish sheet (no dedicated salad PNG).
  salad: "icon.food.veggie-mix",
};

/** Idle cell on Farm RPG icon strips (32×16 = idle | selected). */
export const ICON_STRIP_FRAME = { x: 0, y: 0, w: 16, h: 16 } as const;

export interface ItemSprite {
  key: string;
  frame: { x: number; y: number; w: number; h: number };
}

/**
 * Craft/resource items that have no 16×16 icon strip — crop the world object
 * sheet the farm already uses (fence / crate / buckets / barrels / ore / hay).
 */
const ITEM_OBJECT_SPRITE: Record<string, ItemSprite> = {
  fence_item: { key: "obj.decor.fence-wood", frame: { x: 0, y: 0, w: 16, h: 32 } },
  shipping_box: { key: "obj.farm.shippingbox", frame: { x: 0, y: 16, w: 48, h: 16 } },
  sprinkler: { key: "obj.farm.waterbuckets", frame: { x: 0, y: 0, w: 16, h: 16 } },
  wood: { key: "obj.farm.barrels", frame: { x: 0, y: 0, w: 48, h: 48 } },
  stone: { key: "obj.cave.minerals", frame: { x: 0, y: 0, w: 16, h: 16 } },
  fiber: { key: "obj.farm.haybale", frame: { x: 0, y: 0, w: 32, h: 16 } },
};

/** Unique sheet crop for an item, or null → caller uses Lucide category fallback. */
export function resolveItemSprite(itemId: string): ItemSprite | null {
  const obj = ITEM_OBJECT_SPRITE[itemId];
  if (obj && manifestKeys.has(obj.key)) return obj;
  const mapped = ITEM_ICON_KEY[itemId];
  if (mapped && manifestKeys.has(mapped)) {
    return { key: mapped, frame: ICON_STRIP_FRAME };
  }
  return null;
}

/**
 * Resolve an item id (+ category) to an icon. Returns `{status:"approved", key}` only when
 * a real, manifest-backed key exists for the category; otherwise a `placeholder` result.
 * The returned key is guaranteed to be present in ASSET_MANIFEST.
 */
export function resolveIcon(itemId: string, category: IconCategory = "resource"): IconResolution {
  const mapped = ITEM_ICON_KEY[itemId];
  if (mapped && manifestKeys.has(mapped)) return { status: "approved", key: mapped };
  const cat = `icon.${category}`;
  if (manifestKeys.has(cat)) return { status: "approved", key: cat };
  return { status: "placeholder", category, reason: PLACEHOLDER_REASON };
}

/** Resolve a category-level icon. Same contract as {@link resolveIcon}. */
export function resolveCategoryIcon(category: IconCategory): IconResolution {
  const cat = `icon.${category}`;
  if (manifestKeys.has(cat)) return { status: "approved", key: cat };
  return { status: "placeholder", category, reason: PLACEHOLDER_REASON };
}

/** Check whether a key is present in the manifest. */
export function iconExists(key: string): boolean {
  return manifestKeys.has(key);
}
