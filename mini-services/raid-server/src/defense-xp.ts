import type { RaidEventRow } from "./replay-types.js";

/**
 * Defense XP scoring (concept §12, red-team #18 anti-self-farm).
 * Owner nhận Defense XP scaled theo severity raid. Chặn self-farm: đồng minh vào loot nhẹ rồi thoát.
 *
 * Audit H5 REVERSED (context-changed): trap giờ là feature thật (phase 1) → trapSprung count XP.
 * Owner rewarded khi trap hiệu quả (raider dẫm).
 */
export const DEFENSE_XP_THRESHOLD_INTERACTIONS = 2;
export const DEFENSE_XP_BASE = 10;
export const DEFENSE_XP_ALARM_BONUS = 5;
export const DEFENSE_XP_TRAP_BONUS = 2;
export const DEFENSE_XP_CAUGHT_LOOT_DIVISOR = 10;
export const DEFENSE_XP_CAP_PER_RAID = 50;
export const DEFENSE_XP_CAP_PER_DAY = 100;

/** Event chứng tỏ raider tham gia thật (không system/dog). trapSprung included (reverse H5). */
const RAIDER_ACTION_TYPES = new Set([
  "move",
  "chestOpen",
  "puzzleFail",
  "puzzleSolve",
  "bite",
  "trapSprung",
]);

export interface DefenseXpModifiers {
  reachedAlarm?: boolean; // alert score ≥ alarm threshold trong raid
  caught?: boolean; // raider bị bắt (reason=caught)
  lootValue?: number; // tổng value loot raider mang (nếu caught → owner bonus)
}

/**
 * Tính Defense XP amount cho owner. Pure — caller truyền events + modifiers.
 * Return int clamped [0, CAP_PER_RAID]. 0 nếu raid không thật (< threshold actions).
 */
export function computeDefenseXp(
  events: RaidEventRow[],
  ownerId: string,
  mods: DefenseXpModifiers = {},
  threshold: number = DEFENSE_XP_THRESHOLD_INTERACTIONS,
): number {
  const raiderActions = events.filter(
    (e) =>
      e.actorId !== ownerId &&
      e.actorId !== "system" &&
      e.actorId !== "dog" &&
      RAIDER_ACTION_TYPES.has(e.type),
  );
  if (raiderActions.length < threshold) return 0;

  let xp = DEFENSE_XP_BASE;
  if (mods.reachedAlarm) xp += DEFENSE_XP_ALARM_BONUS;
  if (mods.caught) {
    xp += Math.floor((mods.lootValue ?? 0) / DEFENSE_XP_CAUGHT_LOOT_DIVISOR);
  }
  const trapSprungs = events.filter(
    (e) => e.type === "trapSprung" && e.actorId !== ownerId,
  ).length;
  xp += trapSprungs * DEFENSE_XP_TRAP_BONUS;

  return Math.min(xp, DEFENSE_XP_CAP_PER_RAID);
}

/** Backward compat wrapper — true nếu XP > 0. */
export function shouldGrantDefenseXP(
  events: RaidEventRow[],
  ownerId: string,
  threshold: number = DEFENSE_XP_THRESHOLD_INTERACTIONS,
): boolean {
  return computeDefenseXp(events, ownerId, {}, threshold) > 0;
}
