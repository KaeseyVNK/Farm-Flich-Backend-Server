import { create } from "zustand";
import {
  SEASONS,
  DAYS_PER_SEASON,
  DAY_START_HOUR,
  DAY_END_HOUR,
  MAX_ENERGY,
  type Season,
} from "@/lib/game/constants";
import type { BuffState } from "@/lib/game/buff";

export interface GameState {
  day: number; // 1..28
  season: Season;
  seasonIndex: number; // 0..3
  year: number;
  timeMinutes: number; // minutes since midnight (0..1439)
  gold: number;
  energy: number;
  maxEnergy: number;
  paused: boolean;
  lastTickAt: number | null;
  // derived
  isSleeping: boolean;
  newDayToast: string | null;
  needsSleep: boolean; // set true when day should end (2am collapse); engine consumes
  collapsed: boolean; // true if last sleep was a 2am collapse (penalty applied)
  totalEarned: number; // lifetime gold earned (for quests/stats)
  toolsUsed: number; // lifetime tool-use count (for mining-level quest)
  buffs: BuffState; // W2: speed/xp — hết hạn theo absMinute(day, timeMinutes)
  /** W8: cá bắt hôm nay (fishId[]) — điểm fishing derby, endDay clear. */
  catchLog: string[];
}

export interface GameActions {
  setPaused: (p: boolean) => void;
  tick: (deltaMs: number) => void; // advance in-game time
  sleep: (collapsed: boolean) => void; // end day (advances calendar); collapsed applies penalty
  clearNeedsSleep: () => void;
  addGold: (amount: number) => void;
  logCatch: (fishId: string) => void;
  clearCatchLog: () => void;
  spendGold: (amount: number) => boolean;
  addEnergy: (amount: number) => void;
  spendEnergy: (amount: number) => boolean;
  setEnergy: (v: number) => void;
  resetEnergy: () => void;
  recordToolUse: () => void;
  setNewDayToast: (s: string | null) => void;
  setBuffs: (b: BuffState) => void;
  hydrate: (partial: Partial<GameState>) => void;
}

export type GameStore = GameState & GameActions;

function fmtTime(min: number): { h: number; m: number; label: string; display: string } {
  let h = Math.floor(min / 60) % 24;
  const m = Math.floor(min % 60);
  const label = h >= 12 && h < 24 ? "PM" : "AM";
  let displayH = h % 12;
  if (displayH === 0) displayH = 12;
  return {
    h,
    m,
    label,
    display: `${displayH}:${m.toString().padStart(2, "0")} ${label}`,
  };
}

export const useGameStore = create<GameStore>((set, get) => ({
  day: 1,
  season: "Spring",
  seasonIndex: 0,
  year: 1,
  timeMinutes: DAY_START_HOUR * 60,
  gold: 500,
  energy: MAX_ENERGY,
  maxEnergy: MAX_ENERGY,
  paused: false,
  lastTickAt: null,
  isSleeping: false,
  newDayToast: null,
  needsSleep: false,
  collapsed: false,
  totalEarned: 0,
  toolsUsed: 0,
  buffs: {},
  catchLog: [],

  setPaused: (p) => set({ paused: p }),

  tick: (deltaMs) => {
    const s = get();
    if (s.paused || s.needsSleep) return;
    // 1 in-game minute = ~0.7 real seconds  =>  ~1.4286 min per real second.
    // A full day (6 AM -> 2 AM = 20 hours = 1200 min) takes ~840 real seconds (~14 min).
    const minutesToAdd = (deltaMs / 1000) * (1 / 0.7);
    let next = s.timeMinutes + minutesToAdd;
    if (next >= DAY_END_HOUR * 60) {
      set({ timeMinutes: DAY_END_HOUR * 60, needsSleep: true });
      return;
    }
    set({ timeMinutes: next, lastTickAt: Date.now() });
  },

  sleep: (collapsed) => {
    const s = get();
    let day = s.day + 1;
    let seasonIndex = s.seasonIndex;
    let season = s.season;
    let year = s.year;
    if (day > DAYS_PER_SEASON) {
      day = 1;
      seasonIndex = (seasonIndex + 1) % 4;
      season = SEASONS[seasonIndex];
      if (seasonIndex === 0) year += 1;
    }
    // Collapse penalty: lose 10% of current gold (Stardew-style) and wake with less energy.
    let gold = s.gold;
    if (collapsed) {
      const penalty = Math.floor(gold * 0.1);
      gold = Math.max(0, gold - penalty);
    }
    set({
      day,
      season,
      seasonIndex,
      year,
      timeMinutes: DAY_START_HOUR * 60,
      energy: collapsed ? Math.floor(s.maxEnergy * 0.6) : s.maxEnergy,
      isSleeping: true,
      needsSleep: false,
      collapsed,
      gold,
      newDayToast: collapsed
        ? `You collapsed! Day ${day} of ${season} (lost some gold)`
        : `Day ${day} of ${season}, Year ${year}`,
    });
    setTimeout(() => set({ isSleeping: false }), 1200);
  },

  clearNeedsSleep: () => set({ needsSleep: false }),

  addGold: (amount) =>
    set((s) => ({
      gold: Math.max(0, s.gold + amount),
      totalEarned: amount > 0 ? s.totalEarned + amount : s.totalEarned,
    })),
  spendGold: (amount) => {
    const s = get();
    if (s.gold < amount) return false;
    set({ gold: s.gold - amount });
    return true;
  },
  addEnergy: (amount) =>
    set((s) => ({ energy: Math.min(s.maxEnergy, Math.max(0, s.energy + amount)) })),
  spendEnergy: (amount) => {
    const s = get();
    if (s.energy < amount) return false;
    set({ energy: s.energy - amount });
    return true;
  },
  setEnergy: (v) => set({ energy: Math.max(0, v) }),
  resetEnergy: () => set({ energy: MAX_ENERGY }),
  recordToolUse: () => set((s) => ({ toolsUsed: s.toolsUsed + 1 })),
  setNewDayToast: (s) => set({ newDayToast: s }),
  setBuffs: (b) => set({ buffs: b }),
  /** W8 derby: log cá bắt trong ngày (cap 500 — chống phình save). */
  logCatch: (fishId) =>
    set((s) => (s.catchLog.length >= 500 ? s : { catchLog: [...s.catchLog, fishId] })),
  clearCatchLog: () => set({ catchLog: [] }),
  hydrate: (partial) =>
    set((s) => {
      // Trust-boundary: clamp numeric — save corrupt/hand-edit inject NaN/"abc"
      // → tick() string-concat time, addGold(NaN) poison math, UI NaN:NaN.
      const num = (v: unknown, fallback: number) =>
        typeof v === "number" && Number.isFinite(v) ? v : fallback;
      // W2 buffs: chỉ khi partial có mang buffs mới override (sanitize số dương).
      const buffsOut: BuffState | undefined =
        partial.buffs === undefined
          ? undefined
          : (() => {
              const b = partial.buffs as Partial<Record<"speedUntilAbs" | "xpUntilAbs", unknown>>;
              const out: BuffState = {};
              for (const k of ["speedUntilAbs", "xpUntilAbs"] as const) {
                const v = b[k];
                if (typeof v === "number" && Number.isFinite(v) && v > 0) out[k] = v;
              }
              return out;
            })();
      return {
        ...s,
        ...partial,
        day: Math.max(1, num(partial.day, s.day)),
        seasonIndex: Math.max(0, Math.min(3, num(partial.seasonIndex, s.seasonIndex))),
        year: Math.max(1, num(partial.year, s.year)),
        timeMinutes: Math.max(0, Math.min(DAY_END_HOUR * 60, num(partial.timeMinutes, s.timeMinutes))),
        gold: Math.max(0, num(partial.gold, s.gold)),
        energy: Math.max(0, num(partial.energy, s.energy)),
        toolsUsed: Math.max(0, num(partial.toolsUsed, s.toolsUsed)),
        totalEarned: Math.max(0, num(partial.totalEarned, s.totalEarned)),
        // maxEnergy undefined/0/NaN (save cũ/lệch) → NaN propagate qua sleep/spendEnergy.
        // Guard: fallback MAX_ENERGY nếu partial không hợp lệ.
        maxEnergy:
          typeof partial.maxEnergy === "number" && partial.maxEnergy > 0
            ? partial.maxEnergy
            : s.maxEnergy,
        ...(buffsOut !== undefined ? { buffs: buffsOut } : {}),
      };
    }),
}));

// Helper selectors
export function formatGameTime(min: number): string {
  return fmtTime(min).display;
}

export function timePhase(min: number): "Morning" | "Afternoon" | "Evening" | "Night" {
  const h = Math.floor(min / 60) % 24;
  if (h >= 6 && h < 12) return "Morning";
  if (h >= 12 && h < 17) return "Afternoon";
  if (h >= 17 && h < 20) return "Evening";
  return "Night";
}
