// Wave 2 P3 — hệ buff thuần (speed/xp), thời điểm tuyệt đối day*1440+timeMinutes
// để hết hạn đúng qua ranh giới ngày (buff cấp sát 26:00 không sống thêm ngày mới).
// gameStore giữ BuffState; awardXp (progression) + movement (farm-scene) nhân theo.
import type { BuffId } from "@/lib/game/cooking/recipe-catalog";
import type { KineticsConfig } from "@/lib/game/phaser/movement-kinetics";

export interface BuffState {
  /** Hết hạn tăng tốc (phút tuyệt đối). */
  speedUntilAbs?: number;
  /** Hết hạn x2 XP (phút tuyệt đối). */
  xpUntilAbs?: number;
}

/** TUNE tập trung — human gate chỉnh tại đây. */
export const BUFF_TUNE = {
  speedMult: 1.2,
  xpMult: 1.2,
  /** Thời lượng buff speed mặc định (phút in-game) — ~84s real. */
  speedMinutes: 120,
};

export function absMinute(day: number, timeMinutes: number): number {
  return day * 1440 + timeMinutes;
}

/** Áp buff mới — giữ mốc hết hạn MUỘN nhất khi chồng lấn. */
export function applyBuff(s: BuffState, id: BuffId, day: number, timeMinutes: number, durMinutes: number): BuffState {
  const until = absMinute(day, timeMinutes) + durMinutes;
  const key = id === "speed" ? "speedUntilAbs" : "xpUntilAbs";
  const cur = s[key];
  return { ...s, [key]: cur !== undefined && cur > until ? cur : until };
}

export function activeBuffs(s: BuffState, day: number, timeMinutes: number): { speed: boolean; xp: boolean } {
  const now = absMinute(day, timeMinutes);
  return {
    speed: (s.speedUntilAbs ?? -1) > now,
    xp: (s.xpUntilAbs ?? -1) > now,
  };
}

export function speedMultiplier(s: BuffState, day: number, timeMinutes: number): number {
  return activeBuffs(s, day, timeMinutes).speed ? BUFF_TUNE.speedMult : 1;
}

export function xpMultiplier(s: BuffState, day: number, timeMinutes: number): number {
  return activeBuffs(s, day, timeMinutes).xp ? BUFF_TUNE.xpMult : 1;
}

export function clearBuffs(): BuffState {
  return {};
}

/** Nhân tốc độ đi/chạy cho mount-buff — accel/braking giữ nguyên (cảm giác không trượt). */
export function scaleKinetics(cfg: KineticsConfig, mult: number): KineticsConfig {
  return { ...cfg, walkSpeed: cfg.walkSpeed * mult, runSpeed: cfg.runSpeed * mult };
}
