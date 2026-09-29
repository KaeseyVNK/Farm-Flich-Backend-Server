/**
 * Shield duration logic (concept §4/§12/§13, red-team).
 * - onlineAway: owner online nhưng đang ở ngoài → 30 min
 * - afterRaid: farm vừa bị trộm → 2h
 * - newPlayer: người chơi mới → 24h immunity
 */
export const SHIELD_MS = {
  onlineAway: 30 * 60 * 1000,
  afterRaid: 2 * 60 * 60 * 1000,
  newPlayer: 24 * 60 * 60 * 1000,
} as const;

export type ShieldReason = keyof typeof SHIELD_MS;

export function computeShieldUntil(reason: ShieldReason, now: Date = new Date()): Date {
  return new Date(now.getTime() + SHIELD_MS[reason]);
}
