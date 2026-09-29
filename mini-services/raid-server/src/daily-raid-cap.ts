import { DAILY_RAID_CAP } from "./constants.js";

/**
 * Daily raid cap với reset window (24h).
 *
 * Trước đây join gate chỉ so `dailyRaidCount >= DAILY_RAID_CAP` (raw field),
 * nhưng reset chỉ xảy ra trong finalize RPC khi CÓ raid mới. Farm bị raid đủ
 * cap 1 ngày rồi không bị raid lại → count giữ cap + resetAt cũ → join reject
 * farm mãi (stuck unraidable) dù đã qua 24h.
 *
 * Logic này giống hệt RPC (migration finalize): qua 24h kể từ resetAt → count
 * hiệu dụng = 0. Giữ 1 nguồn sự thật cho cả join gate + RPC.
 */

/** 24h tính theo milliseconds (khớp interval trong finalize RPC). */
export const DAILY_RESET_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Đếm số raid đã dùng trong window hiện tại (0..DAILY_RAID_CAP).
 * resetAt null → chưa reset bao giờ → count hiệu dụng = raw count.
 * resetAt cũ hơn 24h so với now → window mới → 0.
 */
export function effectiveDailyRaidCount(
  rawCount: number | null | undefined,
  resetAt: Date | string | null | undefined,
  nowMs: number,
): number {
  if (rawCount == null) return 0;
  const reset = resetAt ? new Date(resetAt).getTime() : 0;
  if (reset > 0 && nowMs - reset > DAILY_RESET_WINDOW_MS) return 0;
  return rawCount;
}

/** Cap check — đã dùng hết slot raid trong window chưa. */
export function canRaidFarm(
  rawCount: number | null | undefined,
  resetAt: Date | string | null | undefined,
  nowMs: number,
): boolean {
  return effectiveDailyRaidCount(rawCount, resetAt, nowMs) < DAILY_RAID_CAP;
}
