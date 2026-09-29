import { create } from "zustand";
import type { AlertLevel, RaidSnapshot } from "@/lib/raid/types";
import { useTutorialStore } from "@/store/tutorialStore";

/**
 * RaidUiEvent — discriminated client presentation event mapped from server messages that
 * today are silently dropped by ws-client (alert-level standalone, puzzle-result, error).
 * Presentation only: never mutates inventory, never finishes a raid, never changes server
 * truth. `receivedAt` is bounded display timing; it is never sent back nor treated as game
 * time. Cleared on reset/dismiss so a previous raid's alert/error cannot leak into a new one.
 */
export type RaidUiEvent =
  | { kind: "alert"; level: AlertLevel; score: number; reason: string; receivedAt: number }
  | { kind: "puzzle-result"; chestId: string; ok: boolean; loot?: { itemId: string; qty: number }[]; receivedAt: number }
  | { kind: "error"; code: string; message: string; receivedAt: number };

/**
 * raidStore — mirror server snapshot (server-authoritative, KHÔNG client simulate).
 * ws-client push snapshot → applySnapshot. UI subscribe store.
 */

export type RaidPhase = "idle" | "lobby" | "active" | "ended";

export interface RaidEndState {
  reason: "exit" | "caught" | "timeout";
  keptLoot: { itemId: string; qty: number }[];
  maskDurabilityLoss: number;
}

export interface RaidStore {
  phase: RaidPhase;
  snapshot: RaidSnapshot | null;
  prevSnapshot: RaidSnapshot | null;
  snapshotTs: number;
  prevSnapshotTs: number;
  endState: RaidEndState | null;
  farmName: string;
  loot: number;
  /** Tick-based gate close deadline (phase 9 — KHÔNG wall-clock). */
  lockdownGateCloseTick: number | null;
  /** Latest standalone server message surfaced for display (alert/puzzle-result/error). */
  lastEvent: RaidUiEvent | null;

  setPhase: (p: RaidPhase) => void;
  setLobby: (farmName: string) => void;
  applySnapshot: (s: RaidSnapshot) => void;
  setEnd: (e: RaidEndState) => void;
  setLockdown: (gateCloseTick: number) => void;
  pushEvent: (e: RaidUiEvent) => void;
  dismissEvent: () => void;
  reset: () => void;
}

export const useRaidStore = create<RaidStore>((set) => ({
  phase: "idle",
  snapshot: null,
  prevSnapshot: null,
  snapshotTs: 0,
  prevSnapshotTs: 0,
  endState: null,
  farmName: "",
  loot: 0,
  lockdownGateCloseTick: null,
  lastEvent: null,

  setPhase: (p) => set({ phase: p }),
  setLobby: (farmName) => set({ phase: "lobby", farmName, snapshot: null, endState: null }),
  applySnapshot: (s) =>
    set((st) => {
      // Terminal state guard: snapshot muộn đến SAU raid-end (race tick/finalize)
      // không được ghi đè phase "ended" → active, sẽ làm RaidSummary unmount.
      if (st.phase === "ended") return {};
      return {
        phase: "active",
        snapshot: s,
        prevSnapshot: st.snapshot,
        snapshotTs: Date.now(),
        prevSnapshotTs: st.snapshotTs || Date.now(),
      };
    }),
  setEnd: (e) => {
    set({ phase: "ended", endState: e });
    // W9 t_raid_first probe: chỉ thoát THÀNH CÔNG (exit) mới tính — caught/timeout không.
    if (e.reason === "exit") useTutorialStore.getState().tickRaidEscape();
  },
  setLockdown: (gateCloseTick) => set({ lockdownGateCloseTick: gateCloseTick }),
  pushEvent: (e) => set({ lastEvent: e }),
  dismissEvent: () => set({ lastEvent: null }),
  reset: () =>
    set({
      phase: "idle",
      snapshot: null,
      prevSnapshot: null,
      snapshotTs: 0,
      prevSnapshotTs: 0,
      endState: null,
      farmName: "",
      loot: 0,
      lockdownGateCloseTick: null,
      lastEvent: null,
    }),
}));

/** Alert text + color cue phi-motion (red-team #22 — KHÔNG chỉ pulse). */
export const ALERT_TEXT: Record<AlertLevel, string> = {
  stealth: "Đang ẩn — chưa ai phát hiện",
  caution: "Cảnh báo — chủ farm bắt đầu nghi ngờ",
  alarm: "Báo động! Thoát ngay",
};
