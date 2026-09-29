/**
 * Loss cap logic (concept §13, red-team #8).
 * Per-raid: 10% pool/category. Per-day: 25% pool/category.
 * Ket (safe) — không bao giờ bị trộm (concept §7), excluded khỏi pool.
 */

export const PER_RAID_CAP_PCT = 0.10;
export const PER_DAY_CAP_PCT = 0.25;

/** Items ket — 0% steal (concept §7). Server copy trong
 * mini-services/raid-server/src/loot-tables.ts là nơi THỰC THI (steal pool).
 * Client dùng cho hiển thị/controller (vd HUD "không thể trộm" badge) — sync-comment. */
export function isKetItem(itemId: string): boolean {
  return itemId.startsWith("ket_");
}

/**
 * Số lượng tối đa trộm được ngay lúc này.
 * = min(per-raid cap, phần còn lại của per-day cap).
 * Server finalize dùng hàm này trước khi deduct atomic.
 */
export function computeStealableNow(
  poolSize: number,
  alreadyLostToday: number,
  perRaidPct: number = PER_RAID_CAP_PCT,
  perDayPct: number = PER_DAY_CAP_PCT,
): number {
  const perRaid = Math.floor(poolSize * perRaidPct);
  const perDayRemaining = Math.max(0, Math.floor(poolSize * perDayPct) - alreadyLostToday);
  return Math.max(0, Math.min(perRaid, perDayRemaining));
}
