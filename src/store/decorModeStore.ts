// W3P4 — zustand bọc DecorMode SM: scene/overlay/test-bridge cùng đọc một state.
import { create } from "zustand";
import {
  initialDecorMode,
  nextDecorMode,
  type DecorModeEvent,
  type DecorModeState,
} from "@/lib/game/decor/decor-mode";

export interface DecorModeStore extends DecorModeState {
  dispatch: (e: DecorModeEvent) => void;
}

export const useDecorModeStore = create<DecorModeStore>((set) => ({
  ...initialDecorMode(),
  dispatch: (e) => set((s) => nextDecorMode(s, e)),
}));
