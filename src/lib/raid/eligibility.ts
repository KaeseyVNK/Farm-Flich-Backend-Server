/**
 * Raid eligibility (audit M5, red-team #15).
 * "Vắng mặt" = away hoặc offline. playing = owner đang ở farm (GameCanvas mounted) → chặn raid.
 */

export type FarmStatus = "away" | "playing" | "offline";

/**
 * Farm có raid được không: status away/offline VÀ shield hết hạn.
 * Lobby + join check đều dùng hàm này.
 */
export function isFarmRaidable(
  status: FarmStatus,
  shieldUntil: Date | null,
  now: Date,
): boolean {
  if (status === "playing") return false;
  if (shieldUntil && shieldUntil.getTime() > now.getTime()) return false;
  return true;
}
