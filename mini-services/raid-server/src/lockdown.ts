/**
 * Lockdown (concept §6/§11, audit M11).
 * Owner quay về farm trong lúc bị raid → trigger lockdown → exit gate đóng dần.
 *
 * Tick-based (KHÔNG wall-clock) — đảm bảo determinism cho re-sim replay.
 * Phase 9: owner-presence auto-detect (Realtime subscribe server-side) + manual POST /lockdown.
 */

/** Gate đóng sau 200 tick = 20s @ 10Hz. */
export const LOCKDOWN_CLOSE_TICKS = 200;

/** Tính gateCloseTick từ tick hiện tại. */
export function triggerLockdown(nowTick = 0): { gateCloseTick: number } {
  return { gateCloseTick: nowTick + LOCKDOWN_CLOSE_TICKS };
}

/** Owner presence state (broadcast qua farm-status channel). */
export type OwnerPresence = "playing" | "away" | "offline";

/** Pure logic: transition có nên trigger auto-lockdown không? */
export function shouldTriggerAutoLockdown(args: {
  prev: OwnerPresence;
  next: OwnerPresence;
  sessionActive: boolean;
  lockdown: boolean;
}): boolean {
  const cameBack = (args.prev === "away" || args.prev === "offline") && args.next === "playing";
  return cameBack && args.sessionActive && !args.lockdown;
}
