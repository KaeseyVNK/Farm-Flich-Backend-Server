/**
 * W8 — Scoring 4 hoạt động festival (pure, §14). Đơn vị điểm chuẩn hoá 0-300
 * so với thang thưởng bronze 30 / silver 100 / gold 200 (festival-catalog).
 */

import { decorById } from "@/lib/game/decor/decor-catalog";
import type { PlacedDecor } from "@/lib/game/decor/decor-placement";
import { FISH, type FishRarity } from "@/lib/game/fish-catalog";
import { KITCHEN_RECIPES } from "@/lib/game/cooking/recipe-catalog";

// ===== Decor contest =====

const TIER_WEIGHT: Record<string, number> = {
  basic: 2,
  nice: 5,
  fancy: 9,
  // Event decor hiếm (không mua được) — điểm cao nhất.
  event: 12,
};

/** Σ(tier weight) + likes×3 — likes từ server (W4), local 0. */
export function decorScore(placed: PlacedDecor[], likes: number): number {
  let sum = 0;
  for (const d of placed) {
    const def = decorById(d.defId);
    if (!def) continue; // def lạ/đã xoá — bỏ, không crash
    sum += TIER_WEIGHT[def.tier] ?? 0;
  }
  return sum + Math.max(0, likes) * 3;
}

// ===== Fishing derby =====

export const DERBY_POINTS: Record<FishRarity, number> = {
  common: 10,
  medium: 25,
  rare: 60,
};

/** Σ điểm cá theo rarity (tra catalog — catchLog chỉ cần fishId). */
export function derbyScore(catchLog: { fishId: string }[]): number {
  let sum = 0;
  for (const c of catchLog) {
    const rarity = FISH.find((f) => f.id === c.fishId)?.rarity ?? "common";
    sum += DERBY_POINTS[rarity];
  }
  return sum;
}

// ===== Cook-off =====

export const COOKOFF_MAX_DISHES = 3;

/** Σ(tier×20 + buff?15) trên tối đa 3 món nộp (món không phải recipe → 0). */
export function cookoffScore(dishItemIds: string[]): number {
  const dishes = dishItemIds.slice(0, COOKOFF_MAX_DISHES);
  let sum = 0;
  for (const id of dishes) {
    const r = KITCHEN_RECIPES.find((rec) => rec.outputItemId === id);
    if (!r) continue; // không phải món nấu — không điểm
    sum += r.tier * 20 + (r.buff ? 15 : 0);
  }
  return sum;
}

// ===== Puzzle booth =====

/** Token = số lượt giải × độ khó (1-3) — đổi thưởng tại booth. */
export function puzzleTokenEarned(solved: number, tier: 1 | 2 | 3): number {
  return Math.max(0, solved) * tier;
}

/**
 * Điểm hoạt động puzzle (review W8 MEDIUM balance): 10đ/lượt — bronze 3 lượt,
 * silver 10, gold 20 (~7 phút chơi). Trước đây 2đ/lượt cần 100 lượt cho gold
 * (không khả thi trong 1 ngày lễ).
 */
export const PUZZLE_SCORE_PER_SOLVE = 10;
export function puzzleScore(solved: number): number {
  return Math.max(0, solved) * PUZZLE_SCORE_PER_SOLVE;
}
