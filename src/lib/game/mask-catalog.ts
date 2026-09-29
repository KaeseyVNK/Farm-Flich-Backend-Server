// Mask catalog (phase 4). 4 mask recipe. Seeded app-side — sync raid-server mask-effects.ts.
export interface MaskRecipeDef {
  maskId: "rogue" | "phantom" | "bandit" | "scout" | "rogue2" | "phantom2" | "bandit2" | "scout2";
  tier: number;
  ingredients: Record<string, number>;
  goldCost: number;
  durabilityCap: number;
  label: string;
  desc: string;
  /** W7d-P2: tier 2 chỉ mua ở chợ đen Jack (không craft) — gate thief rep ≥ 50. */
  blackMarket?: boolean;
}

export const MASK_CATALOG: MaskRecipeDef[] = [
  {
    maskId: "rogue",
    tier: 1,
    ingredients: { wood: 10 },
    goldCost: 100,
    durabilityCap: 10,
    label: "Rogue — Tốc độ",
    desc: "Giảm hiệu ứng làm chậm của gấu (tốc độ ×1.2).",
  },
  {
    maskId: "phantom",
    tier: 1,
    // Fiber (cắt cỏ) + sap (nhựa cây) — vật liệu nông trại có từ ngày 1.
    // Trước đây { cloth, gem }: cloth không có path thu thập nào (chưa có trong
    // ITEMS/loot), gem chỉ rớt từ raid chest → mask craft chicken-egg (cần mask
    // để raid, cần raid để craft mask). 3/4 mask uncraftable.
    ingredients: { fiber: 10, sap: 3 },
    goldCost: 200,
    durabilityCap: 10,
    label: "Phantom — Ẩn thân",
    desc: "Cảnh báo của chó giảm nhanh hơn.",
  },
  {
    maskId: "bandit",
    tier: 1,
    ingredients: { stone: 12 },
    goldCost: 200,
    durabilityCap: 10,
    label: "Bandit — Loot",
    desc: "Trần loot trộm được +10%.",
  },
  {
    maskId: "scout",
    tier: 1,
    ingredients: { wood: 5, fiber: 8 },
    goldCost: 150,
    durabilityCap: 10,
    label: "Scout — Lẩn tránh",
    desc: "Tầm nhìn của chó ×0.75.",
  },
];

// W7d-P2 — tier 2 chợ đen (§14): hiệu ứng tier 1 ×1.15 (sync raid-server mask-effects.ts),
// durability 20, giá gold lớn. KHÔNG craft — mua qua buyBlackMaskAction (thief rep ≥ 50).
export const BLACK_MARKET_MASKS: MaskRecipeDef[] = [
  {
    maskId: "rogue2",
    tier: 2,
    ingredients: {},
    // W9P4 economy pass: 800 → 1200 (cân với bicycle 1500 — power +15% đắt hơn cosmetic).
    goldCost: 1200,
    durabilityCap: 20,
    label: "Rogue II — Tốc độ",
    desc: "Giảm hiệu ứng gấu mạnh hơn (tốc độ ×1.38).",
    blackMarket: true,
  },
  {
    maskId: "phantom2",
    tier: 2,
    ingredients: {},
    goldCost: 1000,
    durabilityCap: 20,
    label: "Phantom II — Ẩn thân",
    desc: "Cảnh báo giảm nhanh ×1.73.",
    blackMarket: true,
  },
  {
    maskId: "bandit2",
    tier: 2,
    ingredients: {},
    goldCost: 1000,
    durabilityCap: 20,
    label: "Bandit II — Loot",
    desc: "Trần loot trộm +11.5%.",
    blackMarket: true,
  },
  {
    maskId: "scout2",
    tier: 2,
    ingredients: {},
    goldCost: 900,
    durabilityCap: 20,
    label: "Scout II — Lẩn tránh",
    desc: "Tầm nhìn chó ×0.86.",
    blackMarket: true,
  },
];

export function findRecipe(maskId: string): MaskRecipeDef | undefined {
  return [...MASK_CATALOG, ...BLACK_MARKET_MASKS].find((m) => m.maskId === maskId);
}
