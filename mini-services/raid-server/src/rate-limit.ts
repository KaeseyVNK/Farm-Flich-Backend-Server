import { JOIN_RATE_MAX, JOIN_RATE_WINDOW_MS } from "./constants.js";

/**
 * Rate-limit join per user (audit M10). In-memory, pure — test được không cần DB.
 * Chống scan farm hàng loạt qua lobby/join.
 */
const joinAttempts = new Map<string, number[]>();

/** True nếu user còn lượt join trong window. KHÔNG gọi nếu đã reject. */
export function checkJoinRateLimit(thiefId: string): boolean {
  const now = Date.now();
  const wins = joinAttempts.get(thiefId) ?? [];
  const fresh = wins.filter((ts) => now - ts < JOIN_RATE_WINDOW_MS);
  if (fresh.length >= JOIN_RATE_MAX) {
    joinAttempts.set(thiefId, fresh);
    return false;
  }
  fresh.push(now);
  joinAttempts.set(thiefId, fresh);
  return true;
}

export function resetJoinRateLimit(thiefId: string): void {
  joinAttempts.delete(thiefId);
}
