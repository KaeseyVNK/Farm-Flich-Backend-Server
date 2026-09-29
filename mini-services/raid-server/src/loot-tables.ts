import { mulberry32, hashStr } from "./rng.js";

/**
 * Loot tables (phase 2). Server-only — client KHÔNG bao giờ thấy table.
 * Weighted roll per chest kind. Safe chest có thể chứa ket (0% steal — concept §7,
 * ket excluded khỏi steal pool trong finalize, giữ loss-cap exclude).
 */
export type ChestKind = "wood" | "iron" | "safe";

export interface LootEntry {
  itemId: string;
  weight: number;
  qtyMin: number;
  qtyMax: number;
}

export const LOOT_TABLES: Record<ChestKind, LootEntry[]> = {
  wood: [
    { itemId: "wood", weight: 60, qtyMin: 3, qtyMax: 6 },
    { itemId: "stone", weight: 30, qtyMin: 1, qtyMax: 3 },
    { itemId: "coin_pouch", weight: 10, qtyMin: 1, qtyMax: 2 },
  ],
  iron: [
    { itemId: "iron", weight: 50, qtyMin: 2, qtyMax: 5 },
    { itemId: "gold_ore", weight: 30, qtyMin: 1, qtyMax: 3 },
    { itemId: "gem", weight: 20, qtyMin: 1, qtyMax: 2 },
  ],
  safe: [
    { itemId: "gold_bar", weight: 40, qtyMin: 1, qtyMax: 3 },
    { itemId: "gem", weight: 35, qtyMin: 2, qtyMax: 4 },
// ket — 0% steal (concept §7): finalize exclude itemId bắt đầu "ket_".
// ket_ruby cố ý: kẻ trộm roll thấy "rương an toàn" nhưng KHÔNG bao giờ lấy được —
// item không tồn tại trong ITEMS client (luôn bị skip → roll dồn về gold_bar/gem).
{ itemId: "ket_ruby", weight: 25, qtyMin: 1, qtyMax: 1 },
  ],
};

/** Items ket — excluded khỏi steal pool (concept §7, 0% steal). */
export function isKetItem(itemId: string): boolean {
  return itemId.startsWith("ket_");
}

/** Weighted roll 1 loot entry. */
export function rollLoot(kind: ChestKind, rng: () => number): { itemId: string; qty: number } {
  const table = LOOT_TABLES[kind];
  const total = table.reduce((s, e) => s + e.weight, 0);
  let r = rng() * total;
  let picked = table[0];
  for (const e of table) {
    r -= e.weight;
    if (r <= 0) {
      picked = e;
      break;
    }
  }
  const qty = picked.qtyMin + Math.floor(rng() * (picked.qtyMax - picked.qtyMin + 1));
  return { itemId: picked.itemId, qty };
}

/** Roll deterministic từ seed (cho replay consistency). */
export function rollLootSeeded(kind: ChestKind, seed: string, chestId: string): { itemId: string; qty: number } {
  return rollLoot(kind, mulberry32(hashStr(seed + ":loot:" + chestId)));
}
