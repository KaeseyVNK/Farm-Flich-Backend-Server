// Wave 5 P4 — Cozy death policy: ngất ở rừng sâu KHÔNG phải "chết".
// Không HP bar, không mất tiến trình — chỉ phạt vàng nhẹ + hồi energy về nhà.
// Pure logic tách riêng để unit test (farm-scene chỉ gọi).

export const COZY_DEATH = {
  /** Phạt vàng theo % tồi (floor — không làm âm). */
  goldLossPct: 0.05,
  /** Energy hồi sau ngất (% max). */
  respawnEnergyPct: 0.3,
  /** Tile hồi sức ở farm (trước cửa nhà). */
  respawnTile: { x: 12, y: 11 } as { x: number; y: number },
} as const;

export interface FaintPenalty {
  goldLoss: number;
  respawnEnergy: number;
}

/** Tính phạt ngất — tròn xuống, không âm, energy tối thiểu 1 (đứng dậy đi được). */
export function faintPenalty(gold: number, maxEnergy: number): FaintPenalty {
  return {
    goldLoss: Math.max(0, Math.floor(gold * COZY_DEATH.goldLossPct)),
    respawnEnergy: Math.max(1, Math.floor(maxEnergy * COZY_DEATH.respawnEnergyPct)),
  };
}
