/**
 * Daily raid-count cap logic (audit H6, concept §13 "giới hạn số vụ đột nhập").
 * Phase 2: field + helper. Phase 4: join check. Phase 6: bump count.
 */

import { raidCapBonus } from "@/lib/game/progression/perk-effects";

export const DAILY_RAID_CAP = 3; // vụ/farm/ngày
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Cap hiệu lực = base + perk bonus (combat rank 4 = Raid Cap +1).
 * Client-side gate + display. Server raid-server vẫn dùng DAILY_RAID_CAP hardcoded
 * (raid-server chưa biết perk allocations) — perk cho phép player VÀO thêm lượt ở
 * client UI; server reject nếu vượt (ceiling: wire perk vào join.ts khi sync perk).
 */
export function effectiveRaidCap(): number {
  return DAILY_RAID_CAP + raidCapBonus();
}

/**
 * Reset dailyRaidCount nếu dailyRaidResetAt null hoặc qua 24h.
 * Pure — Server Action / raid-server gọi rồi persist.
 */
export function resetDailyRaidCountIfStale(
  farm: { dailyRaidCount: number; dailyRaidResetAt: Date | null },
  now: Date,
): { dailyRaidCount: number; dailyRaidResetAt: Date } {
  const reset = farm.dailyRaidResetAt;
  if (!reset || now.getTime() - reset.getTime() >= DAY_MS) {
    return { dailyRaidCount: 0, dailyRaidResetAt: now };
  }
  return { dailyRaidCount: farm.dailyRaidCount, dailyRaidResetAt: reset };
}

/** Join gate: còn lượt raid hôm nay không (default cap = base + perk). */
export function canRaidToday(dailyRaidCount: number, cap: number = effectiveRaidCap()): boolean {
  return dailyRaidCount < cap;
}
