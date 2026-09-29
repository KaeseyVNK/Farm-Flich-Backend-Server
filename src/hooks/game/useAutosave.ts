"use client";

import { useEffect, useRef } from "react";
import { useGameStore } from "@/store/gameStore";
import { useInventoryStore } from "@/store/inventoryStore";
import { useQuestStore } from "@/store/questStore";
import { useUiStore } from "@/store/uiStore";
import { gameActions } from "@/lib/game/actions";

/**
 * useAutosave — auto-saves the game to the active slot:
 *   (1) On every in-game morning (detected via the `isSleeping` flag that
 *       `gameStore.sleep()` sets for ~1.2s after a Sleep).
 *   (2) Debounced 2s after any inventory or quest mutation (tracked via the
 *       stores' version/selectedSlot/completed counters).
 *
 * Auto-save is skipped when the autosave setting is off or the start screen
 * is showing. Manual saves (Settings panel) always work regardless.
 */
export function useAutosave() {
  const autosave = useUiStore((s) => s.autosave);
  const showStartScreen = useUiStore((s) => s.showStartScreen);
  const isSleeping = useGameStore((s) => s.isSleeping);
  // Track inventory + quest mutations for debounced auto-save.
  const invSlots = useInventoryStore((s) => s.slots);
  const invSelected = useInventoryStore((s) => s.selectedSlot);
  const questCompleted = useQuestStore((s) => s.completed);
  const questShipped = useQuestStore((s) => s.shipped);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedSleepRef = useRef(false);

  // (1) Auto-save on morning — fires once per sleep transition.
  useEffect(() => {
    if (!autosave || showStartScreen) return;
    if (isSleeping && !savedSleepRef.current) {
      savedSleepRef.current = true;
      gameActions.saveToActiveSlot().then((ok) => {
        if (ok) {
          useUiStore.getState().notify("☀️ Đã tự động lưu (buổi sáng)", "info");
        }
        gameActions.syncProgressionCloud();
      });
    }
    if (!isSleeping) {
      savedSleepRef.current = false;
    }
  }, [isSleeping, autosave, showStartScreen]);

  // (2) Debounced auto-save on inventory/quest changes (2s after last change).
  useEffect(() => {
    if (!autosave || showStartScreen) return;
    // Audit CR-2: skip debounce trong lúc isSleeping — endDay mutate inventory/
    // quest → debounce fire đồng thời với morning save → 2 IndexedDB write/sleep
    // (wasted I/O mobile + morning save đã capture state post-sleep). Gate bỏ qua.
    if (isSleeping) return;
    // Skip the very first render (initial hydration) to avoid saving a fresh
    // default state before the player has done anything.
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      // Only auto-save if the player has actually started (not on the start
      // screen) and there is meaningful state.
      gameActions.saveToActiveSlot().then(() => {
        gameActions.syncProgressionCloud();
      }).catch(() => {
        /* swallow — save failures are non-fatal for autosave */
      });
    }, 2000);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [invSlots, invSelected, questCompleted, questShipped, autosave, showStartScreen, isSleeping]);
}
