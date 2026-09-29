// Wave 2 P1 — catalog món nấu (kitchen station), data-driven pattern fish-catalog.
// Pure module: không import store/Phaser. CookingModal + cook action + shop cùng đọc đây.
// KHÔNG đụng RECIPES (craft bench bag-only) — bếp nấu là station riêng, input bag∪silo.
import { getItem } from "@/lib/game/data";

export type BuffId = "speed" | "xp";

export interface RecipeInput {
  itemId: string;
  qty: number;
}

export interface CookRecipeDef {
  /** id recipe — prefix ck_ để tránh trùng craft r_. */
  id: string;
  /** itemId món tạo ra (ITEMS type food). */
  outputItemId: string;
  name: string;
  tier: 1 | 2 | 3;
  /** Tier 1 = nấu tức thời; 2/3 = minigame canh thời gian (rounds vòng). */
  rounds: number;
  /** Độ rộng vùng ngon của minigame (0..1) — nhỏ hơn = khó hơn. */
  zoneWidth: number;
  unlockLevel: number;
  inputs: RecipeInput[];
  /** Energy món (đồng bộ ITEMS.energy — single source ở ITEMS, đây là bản đọc cho UI sắp xếp). */
  energy: number;
  buff?: BuffId;
  cookXp: number;
}

/** Số nguyên liệu sẵn có (caller gộp bag ∪ silo trước khi truyền). */
export type IngredientCount = Record<string, number>;

export const KITCHEN_RECIPES: readonly CookRecipeDef[] = [
  // ── Tier 1 — tức thời, mở cửa đầu game ────────────────────────────────────
  { id: "ck_parsnip_soup", outputItemId: "parsnip_soup", name: "Canh Củ Từ", tier: 1, rounds: 0, zoneWidth: 0, unlockLevel: 1,
    inputs: [{ itemId: "parsnip", qty: 2 }], energy: 60, cookXp: 4 },
  { id: "ck_boiled_egg", outputItemId: "boiled_egg", name: "Trứng Luộc", tier: 1, rounds: 0, zoneWidth: 0, unlockLevel: 1,
    inputs: [{ itemId: "egg", qty: 1 }], energy: 45, cookXp: 4 },
  { id: "ck_baked_fish", outputItemId: "baked_fish", name: "Cá Nướng", tier: 1, rounds: 0, zoneWidth: 0, unlockLevel: 2,
    inputs: [{ itemId: "sunfish", qty: 1 }, { itemId: "wheat", qty: 1 }], energy: 75, cookXp: 5 },
  // ── Tier 2 — minigame 1 vòng ──────────────────────────────────────────────
  { id: "ck_pancakes", outputItemId: "pancakes", name: "Bánh Pancake", tier: 2, rounds: 1, zoneWidth: 0.3, unlockLevel: 2,
    inputs: [{ itemId: "wheat", qty: 2 }, { itemId: "egg", qty: 1 }], energy: 85, buff: "speed", cookXp: 8 },
  { id: "ck_veggie_mix", outputItemId: "veggie_mix", name: "Rau Củ Trộn", tier: 2, rounds: 1, zoneWidth: 0.3, unlockLevel: 3,
    inputs: [{ itemId: "parsnip", qty: 1 }, { itemId: "potato", qty: 1 }, { itemId: "onion", qty: 1 }], energy: 70, buff: "speed", cookXp: 8 },
  { id: "ck_fruit_salad", outputItemId: "fruit_salad", name: "Salad Trái Cây", tier: 2, rounds: 1, zoneWidth: 0.3, unlockLevel: 3,
    inputs: [{ itemId: "strawberry", qty: 2 }], energy: 65, buff: "xp", cookXp: 8 },
  { id: "ck_omelet", outputItemId: "omelet", name: "Trứng Chiên", tier: 2, rounds: 1, zoneWidth: 0.28, unlockLevel: 4,
    inputs: [{ itemId: "egg", qty: 2 }, { itemId: "milk", qty: 1 }], energy: 90, cookXp: 9 },
  { id: "ck_fish_stew", outputItemId: "fish_stew", name: "Cá Hầm Khoai Tây", tier: 2, rounds: 1, zoneWidth: 0.28, unlockLevel: 4,
    inputs: [{ itemId: "perch", qty: 1 }, { itemId: "potato", qty: 1 }], energy: 95, cookXp: 9 },
  { id: "ck_sashimi", outputItemId: "sashimi", name: "Sashimi Cá Ngừ", tier: 2, rounds: 1, zoneWidth: 0.25, unlockLevel: 5,
    inputs: [{ itemId: "tuna", qty: 1 }], energy: 110, cookXp: 10 },
  // ── Tier 3 — minigame 2 vòng, vùng hẹp ────────────────────────────────────
  { id: "ck_pumpkin_soup", outputItemId: "pumpkin_soup", name: "Súp Bí Đỏ", tier: 3, rounds: 2, zoneWidth: 0.22, unlockLevel: 5,
    inputs: [{ itemId: "pumpkin", qty: 1 }, { itemId: "milk", qty: 1 }], energy: 120, cookXp: 14 },
  { id: "ck_fish_tacos", outputItemId: "fish_tacos", name: "Taco Cá Mòi", tier: 3, rounds: 2, zoneWidth: 0.22, unlockLevel: 5,
    inputs: [{ itemId: "sardine", qty: 2 }, { itemId: "wheat", qty: 1 }], energy: 130, buff: "xp", cookXp: 14 },
  { id: "ck_stuffed_peppers", outputItemId: "stuffed_peppers", name: "Ớt Nhồi", tier: 3, rounds: 2, zoneWidth: 0.22, unlockLevel: 5,
    inputs: [{ itemId: "onion", qty: 2 }, { itemId: "cabbage", qty: 1 }], energy: 140, cookXp: 14 },
  { id: "ck_casserole", outputItemId: "casserole", name: "Món Hầm Rau Củ", tier: 3, rounds: 2, zoneWidth: 0.2, unlockLevel: 5,
    inputs: [{ itemId: "potato", qty: 2 }, { itemId: "milk", qty: 1 }, { itemId: "egg", qty: 1 }], energy: 150, buff: "speed", cookXp: 15 },
  { id: "ck_complete_breakfast", outputItemId: "complete_breakfast", name: "Bữa Sáng Đầy Đủ", tier: 3, rounds: 2, zoneWidth: 0.2, unlockLevel: 5,
    inputs: [{ itemId: "egg", qty: 2 }, { itemId: "milk", qty: 2 }], energy: 180, buff: "xp", cookXp: 15 },
  // ── W5: nguyên liệu rừng sâu (§7 loot hiếm feed nấu ăn) ────────────────────
  { id: "ck_jelly_salad", outputItemId: "jelly_salad", name: "Salad Thạch", tier: 2, rounds: 1, zoneWidth: 0.3, unlockLevel: 3,
    inputs: [{ itemId: "slime_jelly", qty: 2 }], energy: 80, cookXp: 9 },
  { id: "ck_mushroom_risotto", outputItemId: "mushroom_risotto", name: "Cơm Nấm Kem", tier: 3, rounds: 2, zoneWidth: 0.22, unlockLevel: 4,
    inputs: [{ itemId: "glow_mushroom", qty: 2 }, { itemId: "wheat", qty: 1 }], energy: 120, cookXp: 13 },
  { id: "ck_forest_herb_tea", outputItemId: "forest_herb_tea", name: "Trà Thảo Mộc", tier: 2, rounds: 1, zoneWidth: 0.28, unlockLevel: 4,
    inputs: [{ itemId: "forest_herb", qty: 1 }], energy: 50, buff: "xp", cookXp: 9 },
  { id: "ck_sprout_wrap", outputItemId: "sprout_wrap", name: "Bánh Lá Mầm", tier: 2, rounds: 1, zoneWidth: 0.28, unlockLevel: 3,
    inputs: [{ itemId: "sprout_leaf", qty: 2 }, { itemId: "parsnip", qty: 1 }], energy: 100, cookXp: 10 },
];

/** Món mở được ở level hiện tại (thứ tự catalog). */
export function recipesForLevel(level: number): CookRecipeDef[] {
  return KITCHEN_RECIPES.filter((r) => r.unlockLevel <= level);
}

/** Recipe lạ → 99 (pattern seedUnlockLevel/fishUnlockLevel). */
export function recipeUnlockLevel(id: string): number {
  return KITCHEN_RECIPES.find((r) => r.id === id)?.unlockLevel ?? 99;
}

export interface MissingInput {
  itemId: string;
  need: number;
  have: number;
}

/** Nguyên liệu thiếu (đủ → []). avail = bag ∪ silo gộp bởi caller. */
export function missingInputs(recipe: CookRecipeDef, avail: IngredientCount): MissingInput[] {
  const out: MissingInput[] = [];
  for (const ing of recipe.inputs) {
    const have = Math.max(0, Math.floor(avail[ing.itemId] ?? 0));
    if (have < ing.qty) out.push({ itemId: ing.itemId, need: ing.qty, have });
  }
  return out;
}

/** Buff của món (khi ĂN) — undefined nếu món thường. */
export function buffForDish(outputItemId: string): BuffId | undefined {
  return KITCHEN_RECIPES.find((r) => r.outputItemId === outputItemId)?.buff;
}

/** Tổng giá bán nguyên liệu (theo ITEMS.sellPrice) — dùng test lợi nhuận + hiển thị. */
export function totalInputCost(recipe: CookRecipeDef): number {
  return recipe.inputs.reduce((sum, ing) => sum + (getItem(ing.itemId)?.sellPrice ?? 0) * ing.qty, 0);
}
