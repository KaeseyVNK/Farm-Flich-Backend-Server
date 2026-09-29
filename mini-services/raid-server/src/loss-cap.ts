// DUPLICATE từ src/lib/raid/loss-cap.ts (service độc lập — red-team #19 drift pattern).
// concept §13: per-raid 10%, per-day 25%. Ket excluded.
export const PER_RAID_CAP_PCT = 0.1;
export const PER_DAY_CAP_PCT = 0.25;

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
