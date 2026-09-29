// Phase 2 hayday — bảng unlock nội dung theo level (implementation-handoff-contract).
// Pure module: không import store/Phaser; UI + farmStore.till + buySeed cùng đọc đây.
import { FARM_PLOTS } from "@/lib/game/farm-scenery-layout";

const SEED_UNLOCK: Record<string, number> = {
  // W5: kiếm mua ở shop (buyGood cùng gate này) — lvl 3.
  sword: 3,
  parsnip_seed: 1,
  potato_seed: 2,
  wheat: 3,
  cauliflower_seed: 5,
  cabbage_seed: 5,
  strawberry_seed: 5,
  onion_seed: 5,
};

export function seedUnlockLevel(itemId: string): number {
  return SEED_UNLOCK[itemId] ?? 99;
}

export function plotCount(level: number): number {
  if (level >= 4) return 16;
  if (level >= 3) return 12;
  if (level >= 2) return 9;
  return 6;
}

export function plotUnlockLevel(tx: number, ty: number): number | null {
  const p = FARM_PLOTS.find((x) => x.tx === tx && x.ty === ty);
  return p ? p.unlockLevel : null;
}

export function isPlotUnlocked(tx: number, ty: number, level: number): boolean {
  const need = plotUnlockLevel(tx, ty);
  if (need == null) return false;
  return level >= need;
}
