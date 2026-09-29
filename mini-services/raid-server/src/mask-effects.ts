/**
 * Mask effects (concept §6, phase 4). 4 mask tier cơ bản.
 * Modifier applied tại RaidRoom init (server-side, KHÔNG trust client maskId — F4.5).
 *
 * - rogue: speed ×1.2 (bear slow window ngắn lại).
 * - phantom: alertDecayRate ×1.5 (alert giảm nhanh hơn — sneaky).
 * - bandit: stealable cap +10% (loot bonus).
 * - scout: dogVisionRange ×0.75 (raider khó bị dog thấy).
 */
export type MaskId =
  | "rogue"
  | "phantom"
  | "bandit"
  | "scout"
  // W7d-P2 tier 2 — chợ đen Jack (thief rep ≥ 50), hiệu ứng tier 1 ×1.15.
  | "rogue2"
  | "phantom2"
  | "bandit2"
  | "scout2";

export interface MaskEffect {
  speedMult: number; // bear slow window divisor
  alertDecayMult: number; // alert decay rate multiplier
  lootCapBonus: number; // +stealable cap %
  dogVisionMult: number; // dog vision range multiplier
}

export const DEFAULT_MASK_EFFECT: MaskEffect = {
  speedMult: 1,
  alertDecayMult: 1,
  lootCapBonus: 0,
  dogVisionMult: 1,
};

export const MASK_EFFECTS: Record<MaskId, MaskEffect> = {
  rogue: { speedMult: 1.2, alertDecayMult: 1, lootCapBonus: 0, dogVisionMult: 1 },
  phantom: { speedMult: 1, alertDecayMult: 1.5, lootCapBonus: 0, dogVisionMult: 1 },
  bandit: { speedMult: 1, alertDecayMult: 1, lootCapBonus: 0.1, dogVisionMult: 1 },
  scout: { speedMult: 1, alertDecayMult: 1, lootCapBonus: 0, dogVisionMult: 0.75 },
  // W7d-P2 tier 2 (chợ đen): tier 1 ×1.15 CHÍNH XÁC (không làm tròn — test đối chiếu).
  // Durability 20 set lúc craft (client catalog).
  rogue2: { speedMult: 1.38, alertDecayMult: 1, lootCapBonus: 0, dogVisionMult: 1 },
  phantom2: { speedMult: 1, alertDecayMult: 1.725, lootCapBonus: 0, dogVisionMult: 1 },
  bandit2: { speedMult: 1, alertDecayMult: 1, lootCapBonus: 0.115, dogVisionMult: 1 },
  scout2: { speedMult: 1, alertDecayMult: 1, lootCapBonus: 0, dogVisionMult: 0.8625 },
};

/** Lấy effect cho maskId. Unknown → default (no bonus). */
export function getMaskEffect(maskId: string): MaskEffect {
  return MASK_EFFECTS[maskId as MaskId] ?? DEFAULT_MASK_EFFECT;
}
