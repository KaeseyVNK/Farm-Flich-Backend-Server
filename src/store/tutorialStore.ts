// W9 P1 — tutorialStore: bộ đếm probe + snapshot cho tutorial-catalog.
// Counters chỉ TĂNG — reset khi chơi mới (reset) và hydrate không nhận counters
// (save không lưu probe — chúng là telemetry phiên, không phải state game;
// người chơi đã qua bước X mà mất counter thì chỉ cần REPLAY hành động đó,
// vốn là mirror của những gì họ PHẢI làm lại — xem questStore migrate P2).
import { create } from "zustand";
import type { TutorialProbe } from "@/lib/game/tutorial/tutorial-catalog";
import { useGameStore } from "@/store/gameStore";
import { useProgressionStore } from "@/store/progressionStore";

/**
 * TutorialStore — bộ đếm probe + snapshot pure cho tutorial-catalog.
 * Counters chỉ TĂNG; reset khi chơi mới. Counter KHÔNG persist (telemetry phiên,
 * không phải state game — hydrate P2/P3 chỉ lưu tutorialStep/claimed).
 * tickSell bump itemsSold — t_first_order check bán thật (vendor / giao đơn).
 */

const zero: TutorialProbe = {
  plotsHoed: 0,
  cropsPlanted: 0,
  cropsWatered: 0,
  harvested: 0,
  itemsSold: 0,
  fishCaught: 0,
  fryStocked: 0,
  dishCooked: 0,
  dishEaten: 0,
  decorPlaced: 0,
  mountRidden: 0,
  visitorsOpened: 0,
  monstersDefeated: 0,
  raidEscaped: 0,
  festivalClaimed: 0,
  level: 1,
  day: 1,
};

export interface TutorialStore extends TutorialProbe {
  /** Snapshot probe hiện tại (level/day live từ gameStore — probe tách state). */
  probe: () => TutorialProbe;
  tickTill: () => void;
  tickPlant: () => void;
  tickWater: () => void;
  tickHarvest: () => void;
  tickSell: () => void;
  tickFish: () => void;
  tickFry: () => void;
  tickCook: () => void;
  tickEat: () => void;
  tickDecor: () => void;
  tickVisit: () => void;
  tickMount: () => void;
  tickMonsterDefeat: () => void;
  tickRaidEscape: () => void;
  tickFestival: () => void;
  reset: () => void;
}

/** Bump một counter (cap 999 — chống phình save nếu lỡ persist; probe min 0). */
const bump = (key: keyof TutorialProbe, n: number) => (v: TutorialProbe) => ({
  [key]: Math.min(999, v[key] + n),
});

const cap = (v: number): number => Math.max(0, Math.min(999, v));

export const useTutorialStore = create<TutorialStore>((set, get) => ({
  ...zero,
  probe: () => {
    const g = useGameStore.getState();
    const p = useProgressionStore.getState();
    return {
      ...get(),
      level: cap(p.level ?? 1),
      day: cap(g.day ?? 1),
    };
  },
  tickTill: () => set(bump("plotsHoed", 1)),
  tickPlant: () => set(bump("cropsPlanted", 1)),
  tickWater: () => set(bump("cropsWatered", 1)),
  tickHarvest: () => set(bump("harvested", 1)),
  tickSell: () => set(bump("itemsSold", 1)),
  tickFish: () => set(bump("fishCaught", 1)),
  tickFry: () => set(bump("fryStocked", 1)),
  tickCook: () => set(bump("dishCooked", 1)),
  tickEat: () => set(bump("dishEaten", 1)),
  tickDecor: () => set(bump("decorPlaced", 1)),
  tickVisit: () => set(bump("visitorsOpened", 1)),
  tickMount: () => set(bump("mountRidden", 1)),
  tickMonsterDefeat: () => set(bump("monstersDefeated", 1)),
  tickRaidEscape: () => set(bump("raidEscaped", 1)),
  tickFestival: () => set(bump("festivalClaimed", 1)),
  reset: () => set({ ...zero }),
}));