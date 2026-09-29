// Wave 1 P4 — FishingOverlay mirror state. Scene (authority) đẩy snapshot vào
// đây (throttle trong scene); overlay đọc + set holding/cancel ngược lại.
import { create } from "zustand";
import type { FishingSession } from "@/lib/game/fishing/fishing-sm";

export interface FishingUiState {
  /** Session câu cá đang chạy (không tính idle/terminal). */
  active: boolean;
  phase: "casting" | "wait" | "bite" | "reel" | "caught" | "escaped";
  /** Nhãn vùng nước (ao/hồ/biển) hiển thị hint. */
  waterLabel: string;
  /** Snapshot reel cho thanh bar (0..1) — null khi không trong reel. */
  reel: { barPos: number; fishPos: number; progress: number } | null;
  /** Người chơi đang giữ (Space/pointer) — scene đọc mỗi frame. */
  holding: boolean;
  /** Overlay yêu cầu hủy — scene xử lý rồi reset. */
  cancelRequested: boolean;

  setFromSession: (s: FishingSession) => void;
  setHolding: (b: boolean) => void;
  requestCancel: () => void;
  reset: () => void;
}

const WATER_LABEL: Record<string, string> = { pond: "ao", lake: "hồ", sea: "biển" };

export const useFishingStore = create<FishingUiState>((set) => ({
  active: false,
  phase: "casting",
  waterLabel: "",
  reel: null,
  holding: false,
  cancelRequested: false,

  setFromSession: (s) => {
    if (s.phase === "idle") {
      set({ active: false, reel: null });
      return;
    }
    if (s.phase === "casting" || s.phase === "wait" || s.phase === "bite" || s.phase === "reel") {
      set({
        active: true,
        phase: s.phase,
        reel: s.reel
          ? { barPos: s.reel.barPos, fishPos: s.reel.fishPos, progress: s.reel.progress }
          : null,
      });
      return;
    }
    // caught/escaped — giữ active thêm nhịp cho flash kết quả, scene sẽ reset.
    set({ active: true, phase: s.phase, reel: null });
  },

  setHolding: (b) => set({ holding: b }),
  requestCancel: () => set({ cancelRequested: true }),
  reset: () =>
    set({ active: false, phase: "casting", waterLabel: "", reel: null, holding: false, cancelRequested: false }),
}));

/** Label vùng nước theo waterType — export cho scene set 1 lần lúc cast. */
export function setFishingWaterLabel(waterType: string): void {
  useFishingStore.setState({ waterLabel: WATER_LABEL[waterType] ?? "" });
}
