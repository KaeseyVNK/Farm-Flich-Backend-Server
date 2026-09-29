// Progression XP curve + level logic (phase 6). Pure functions (testable).
// XP curve: level N → xpToNext = N^2 * 100. Max level 10.
export const MAX_LEVEL = 10;

/** XP cần để lên từ level N sang N+1. */
export function xpToNext(level: number): number {
  if (level >= MAX_LEVEL) return 0;
  return level * level * 100;
}

export interface ProgressionState {
  level: number;
  xp: number; // XP đã tích lũy trong level hiện tại
  totalXp: number; // tổng XP mọi thời (cho anon-merge sum)
  skillPoints: number;
}

export function createProgression(): ProgressionState {
  return { level: 1, xp: 0, totalXp: 0, skillPoints: 0 };
}

/**
 * Add XP → có thể multi-level-up. Trả số level gained + state mới.
 * Pure: không mutate input.
 */
export function addXp(state: ProgressionState, amount: number): {
  state: ProgressionState;
  levelsGained: number;
} {
  let { level, xp, totalXp, skillPoints } = state;
  xp += amount;
  totalXp += amount;
  let levelsGained = 0;
  while (level < MAX_LEVEL && xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level++;
    skillPoints++;
    levelsGained++;
  }
  // Cap: max level → xp dồn về 0 (hoặc giữ — chọn 0 cho rõ ràng).
  if (level >= MAX_LEVEL) xp = 0;
  return { state: { level, xp, totalXp, skillPoints }, levelsGained };
}

/** Level từ totalXp (cho anon-merge khi chỉ có tổng XP). */
export function levelFromTotalXp(totalXp: number): number {
  let level = 1;
  let remaining = totalXp;
  while (level < MAX_LEVEL && remaining >= xpToNext(level)) {
    remaining -= xpToNext(level);
    level++;
  }
  return level;
}
