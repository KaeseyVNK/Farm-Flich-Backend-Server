// Defense XP config (phase 3) — web UI upgrade cost + labels.
// ponytail: defense-XP *computation* (computeDefenseXp from raid events) sống trong
// raid-server/defense-xp.ts (server-authoritative). Web chỉ hiển thị cost/label.
// Sync 2 hằng số (DEFENSE_UPGRADE_COST_PER_LEVEL, DEFENSE_MAX_LEVEL) thủ công khi đổi —
// single source across web+server = roadmap.

export const DEFENSE_MAX_LEVEL = 3;
export const DEFENSE_UPGRADE_COST_PER_LEVEL = 50; // XP = level * 50

export type DefenseTarget = "dog" | "fence" | "trap";

/** Cost XP để lên level (level * 50). */
export function upgradeCost(level: number): number {
  return level * DEFENSE_UPGRADE_COST_PER_LEVEL;
}

export const DEFENSE_LABEL: Record<DefenseTarget, string> = {
  dog: "Chó tuần tra",
  fence: "Hàng rào",
  trap: "Bẫy",
};
