// Client-side raid constants (mirror mini-services/raid-server/src/constants.ts + trap.ts).
// Separate service → duplicate (red-team #19 drift pattern, audit acceptable).

export const TRAP_CAP_PER_FARM = 6;
export const TRAP_DEFAULT_DURABILITY = 3;
export const MAP_COLS = 30;
export const MAP_ROWS = 22;
export const MAP_SIZE = MAP_COLS * MAP_ROWS; // 660
/** Server tick rate (mirror mini-services/raid-server/src/constants.ts TICK_HZ).
 *  LockdownBanner dùng convert tick→second. Trước đây magic /10 — server đổi
 *  tick rate → countdown sai lệch. */
export const TICK_HZ = 10;

// W7d-P1: Reputation hiệu ứng (§14).
// SYNC-COMMENT: guard threshold duplicate ở mini-services/raid-server/src/constants.ts
// (GUARD_REP_VISION_BONUS_AT) — raid-server không import src/.
export const REPUTATION_EFFECTS = {
  /** farmer ≥ 50 → +5% giá bán (perk-effects sellPriceMultiplier). */
  FARMER_SELL_AT: 50,
  FARMER_SELL_BONUS: 0.05,
  /** thief ≥ 50 → mở mask tier 2 chợ đen (W7d-P2). */
  THIEF_MASK_TIER2_AT: 50,
  /** guard ≥ 50 → dog vision +1 tile (raid-server join.ts → RaidRoom guardBonus). */
  GUARD_VISION_AT: 50,
} as const;
