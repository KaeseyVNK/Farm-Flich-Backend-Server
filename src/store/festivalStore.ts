// W8 (review fix) — festival daily-session state: điểm cook-off + lượt puzzle.
// Trước đây nằm trong useState FestivalPanel → đóng panel là MẤT điểm trong khi
// món đã consume (review HIGH). Store keyed theo ngày lễ: đổi ngày (endDay) tự
// reset — KHÔNG persist vào save (giống catchLog-clear pattern: festival là
// session trong ngày, không mang qua ngày mới).
import { create } from "zustand";
import { COOKOFF_MAX_DISHES } from "@/lib/game/festival/festival-scoring";

interface FestivalDayState {
  /** Key ngày hiện tại `${year}_${season}_${day}` — đổi key tự reset. */
  dayKey: string;
  /** Tổng món đã nộp cook-off hôm nay (cap COOKOFF_MAX_DISHES). */
  cookoffDishes: number;
  /** Điểm cook-off cộng dồn (mỗi món tier×20 + buff 15). */
  cookoffScore: number;
  /** Số lượt giải đúng puzzle booth hôm nay. */
  puzzleSolved: number;

  /** Nộp 1 món (+score) — false nếu vượt cap 3 món/ngày (review HIGH cap bypass). */
  submitCookoffDish: (score: number) => boolean;
  solvePuzzle: () => void;
  /** Đổi ngày — mọi code gọi với key hiện tại; key khác → reset session. */
  syncDay: (year: number, season: string, day: number) => void;
  reset: () => void;
}

const keyOf = (year: number, season: string, day: number) => `${year}_${season}_${day}`;

export const useFestivalStore = create<FestivalDayState>((set, get) => ({
  dayKey: "",
  cookoffDishes: 0,
  cookoffScore: 0,
  puzzleSolved: 0,

  submitCookoffDish: (score) => {
    const s = get();
    if (s.cookoffDishes >= COOKOFF_MAX_DISHES) return false;
    set({
      cookoffDishes: s.cookoffDishes + 1,
      cookoffScore: s.cookoffScore + score,
    });
    return true;
  },

  solvePuzzle: () => set((s) => ({ puzzleSolved: s.puzzleSolved + 1 })),

  syncDay: (year, season, day) => {
    const key = keyOf(year, season, day);
    if (get().dayKey === key) return;
    set({ dayKey: key, cookoffDishes: 0, cookoffScore: 0, puzzleSolved: 0 });
  },

  reset: () => set({ dayKey: "", cookoffDishes: 0, cookoffScore: 0, puzzleSolved: 0 }),
}));
