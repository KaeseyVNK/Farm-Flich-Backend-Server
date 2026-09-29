/**
 * Visit rate-limit (phase 5 F5.7) — 10 lần/phút per user.
 * In-memory Map, pure — unit test không cần DB.
 */

const VISIT_RATE_MAX = 10;
const VISIT_RATE_WINDOW_MS = 60_000;
const visitTimestamps = new Map<string, number[]>();

/** True nếu còn lượt visit trong window 60s. */
export function checkVisitRateLimit(userId: string): boolean {
  const now = Date.now();
  const wins = visitTimestamps.get(userId) ?? [];
  const fresh = wins.filter((ts) => now - ts < VISIT_RATE_WINDOW_MS);
  if (fresh.length >= VISIT_RATE_MAX) {
    visitTimestamps.set(userId, fresh);
    return false;
  }
  fresh.push(now);
  visitTimestamps.set(userId, fresh);
  return true;
}

export function resetVisitRateLimit(userId: string): void {
  visitTimestamps.delete(userId);
}
