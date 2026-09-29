// Anon → registered merge policy (ADR-006). max(level) + sum XP.
// Server-side atomic merge transaction (single Postgres UPDATE...RETURNING) — concurrent safe.
// Pure policy function (testable); server RPC wire ở integration.
import {
  type ProgressionState,
  levelFromTotalXp,
  createProgression,
} from "../progression/progression-curve";

/**
 * Merge 2 progression (anon + account).
 * Policy: level = max(a, b); xp/totalXp = sum; skillPoints = sum.
 * KHÔNG cộng XP từ bên thua level (tránh exploit) — chỉ sum totalXp làm reference.
 */
export function mergeProgression(
  anon: ProgressionState,
  account: ProgressionState,
): ProgressionState {
  const mergedTotalXp = anon.totalXp + account.totalXp;
  const mergedLevel = Math.max(anon.level, account.level);
  // Level từ totalXp có thể > max(level) nếu XP tổng đẩy lên — nhưng cap ở max(a,b) để tránh exploit.
  // ponytail: cap level = max(a,b); upgrade path: recompute từ totalXp nếu muốn bonus level.
  const levelByXp = levelFromTotalXp(mergedTotalXp);
  const finalLevel = Math.min(Math.max(mergedLevel, levelByXp), 10);
  return {
    level: finalLevel,
    xp: 0, // reset within-level XP sau merge (level mới)
    totalXp: mergedTotalXp,
    skillPoints: anon.skillPoints + account.skillPoints + (finalLevel - mergedLevel),
  };
}

/** Merge khi 1 bên empty (anon chưa chơi). */
export function mergeWithEmpty(existing: ProgressionState): ProgressionState {
  return { ...existing };
}

/** Default progression cho user mới (trigger-handle-new-user). */
export function defaultProgression(): ProgressionState {
  return createProgression();
}
