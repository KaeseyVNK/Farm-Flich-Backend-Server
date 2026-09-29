import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SaveSlot } from "@/lib/game/save";
import { useTutorialStore } from "@/store/tutorialStore";

export type PanelId =
  | "inventory"
  | "seeds"
  | "crafting"
  | "map"
  | "relationships"
  | "visitors"
  | "calendar"
  | "shop"
  | "decor"
  | "help"
  | "settings"
  | "skills"
  | "blackmarket"
  | "bounty"
  | "festival"
  | null;

export interface Notification {
  id: number;
  text: string;
  kind: "info" | "success" | "warn" | "error";
}

export interface UiState {
  activePanel: PanelId;
  openPanel: (p: PanelId) => void;
  closePanel: () => void;
  togglePanel: (p: NonNullable<PanelId>) => void;

  // floating toast notifications
  notifications: Notification[];
  notify: (text: string, kind?: Notification["kind"]) => void;
  dismiss: (id: number) => void;

  // modal state for gift giving / dialogue
  dialogueNpc: string | null;
  openDialogue: (npcId: string) => void;
  closeDialogue: () => void;

  giftTarget: string | null;
  openGiftPicker: (npcId: string) => void;
  closeGiftPicker: () => void;

  // game over / new day overlay
  showStartScreen: boolean;
  setShowStartScreen: (b: boolean) => void;

  // shop modal
  showShop: boolean;
  setShowShop: (b: boolean) => void;

  // W2 — cooking modal (bếp kitchenpot trong nhà)
  showCooking: boolean;
  setShowCooking: (b: boolean) => void;

  // save/load settings
  activeSlot: SaveSlot;
  setActiveSlot: (s: SaveSlot) => void;
  autosave: boolean;
  setAutosave: (b: boolean) => void;
  lastSavedAt: number | null;
  setLastSavedAt: (t: number | null) => void;

  // audio settings
  sfxVolume: number; // 0..1
  setSfxVolume: (v: number) => void;
  musicVolume: number; // 0..1
  setMusicVolume: (v: number) => void;
  ambientVolume: number; // 0..1
  setAmbientVolume: (v: number) => void;
  muted: boolean;
  setMuted: (b: boolean) => void;
}

let notifId = 1;

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      activePanel: null,
      openPanel: (p) => set({ activePanel: p }),
      closePanel: () => set({ activePanel: null }),
      togglePanel: (p) => {
        const cur = get().activePanel;
        set({ activePanel: cur === p ? null : p });
        // W9P5: mở panel Khách Thăm = đã "ghé thăm" (probe tutorial t_visit).
        if (cur !== p && p === "visitors") useTutorialStore.getState().tickVisit();
      },

      notifications: [],
      notify: (text, kind = "info") => {
        const id = notifId++;
        // Cap 10 — render chỉ hiện 3 (slice) nhưng store tích lũy vô hạn khi spam
        // (till/plant/water macro 50×). Cắt đuôi tránh mảng phình.
        set((s) => ({ notifications: [...s.notifications, { id, text, kind }].slice(-10) }));
        setTimeout(() => get().dismiss(id), 3500);
      },
      dismiss: (id) => set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),

      dialogueNpc: null,
      openDialogue: (npcId) => set({ dialogueNpc: npcId }),
      closeDialogue: () => set({ dialogueNpc: null }),

      giftTarget: null,
      openGiftPicker: (npcId) => set({ giftTarget: npcId }),
      closeGiftPicker: () => set({ giftTarget: null }),

      showStartScreen: true,
      setShowStartScreen: (b) => set({ showStartScreen: b }),

      showShop: false,
      setShowShop: (b) => set({ showShop: b }),

      showCooking: false,
      setShowCooking: (b) => set({ showCooking: b }),

      activeSlot: "slot1",
      setActiveSlot: (s) => set({ activeSlot: s }),
      autosave: true,
      setAutosave: (b) => set({ autosave: b }),
      lastSavedAt: null,
      setLastSavedAt: (t) => set({ lastSavedAt: t }),

      sfxVolume: 0.5,
      setSfxVolume: (v) => set({ sfxVolume: Math.max(0, Math.min(1, v)), muted: false }),
      musicVolume: 0.3,
      setMusicVolume: (v) => set({ musicVolume: Math.max(0, Math.min(1, v)), muted: false }),
      ambientVolume: 0.4,
      setAmbientVolume: (v) => set({ ambientVolume: Math.max(0, Math.min(1, v)), muted: false }),
      muted: false,
      setMuted: (b) => set({ muted: b }),
    }),
    {
      name: "hh-ui-prefs",
      // Chỉ persist prefs (audio + autosave flag). KHÔNG persist modal/transient
      // state (showShop, showStartScreen, notifications) — persist showStartScreen
      // = true sẽ khóa game ở start screen mỗi reload.
      partialize: (s) => ({
        sfxVolume: s.sfxVolume,
        musicVolume: s.musicVolume,
        ambientVolume: s.ambientVolume,
        muted: s.muted,
        autosave: s.autosave,
      }),
    },
  ),
);
