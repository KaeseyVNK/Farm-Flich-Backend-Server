// overlay-policy — the ONE pure resolver for "what surface is on top, does it block
// gameplay, does it pause the clock, who owns Escape, what layer is it". Both
// `ui-gate.isGameplayBlocked()` and `GameLayout`'s pause/Escape derivation MUST consume this
// so the two no longer diverge (the audit found isGameplayBlocked included raid while the
// GameLayout pause effect did not).
//
// Contract: implementation-handoff-contract.md §ui-gate and pause contract. This module is
// PURE: no React, no Zustand, no `window`, no side effects. An adapter reads store slices
// into OverlayInputs; the resolver never touches the stores itself.

import type { PanelId } from "@/store/uiStore";
import type { RaidPhase } from "@/store/raidStore";

export type SurfaceId =
  | "none"
  | "start"
  | "panel"
  | "dialogue"
  | "gift"
  | "shop"
  | "cooking"
  | "decor-mode"
  | "raid-lobby"
  | "raid-active"
  | "raid-ended"
  | "raid-puzzle";

/** Escape ownership. A farm-surface value names the exact close action; "delegate-raid"
 *  means RaidView owns the inside-raid Escape sequence (puzzle → exit). */
export type EscapeOwner =
  | "none"
  | "close-panel"
  | "close-dialogue"
  | "close-gift"
  | "close-shop"
  | "close-cooking"
  | "exit-decor"
  | "delegate-raid";

/** Canonical layer — maps 1:1 to the --z-* z-index tokens in globals.css. */
export type SurfaceLayer = "canvas" | "hud" | "panel" | "toast" | "modal" | "mode";

export interface OverlayInputs {
  activePanel: PanelId;
  dialogueNpc: string | null;
  giftTarget: string | null;
  showShop: boolean;
  /** W2: modal nấu ăn (bếp nhà) — minigame rAF cần clock + input bị chặn. */
  showCooking: boolean;
  /** W3: chế độ trang trí — scene tự reroute phím; policy chỉ chặn shell keys + Escape. */
  decorMode: boolean;
  showStartScreen: boolean;
  raidPhase: RaidPhase;
  /** Local presentation input only; never persisted. Highest within the raid surface. */
  raidPuzzleOpen: boolean;
}

export interface SurfacePolicy {
  top: SurfaceId;
  blocksGameplay: boolean;
  pausesClock: boolean;
  escape: EscapeOwner;
  layer: SurfaceLayer;
}

const RAID_STATE: Record<Exclude<RaidPhase, "idle">, SurfaceId> = {
  lobby: "raid-lobby",
  active: "raid-active",
  ended: "raid-ended",
};

/**
 * Resolve the top surface and its policy. Required precedence (highest first):
 *   start → raid puzzle → raid state → shop → gift → dialogue → panel → none.
 * Pure: returns a fresh object, never mutates `input`.
 */
export function resolveSurface(input: OverlayInputs): SurfacePolicy {
  const raidActive = input.raidPhase !== "idle";

  // 1. Start screen — highest; blocking, but Escape never implicitly closes it.
  if (input.showStartScreen) {
    return { top: "start", blocksGameplay: true, pausesClock: true, escape: "none", layer: "mode" };
  }

  // 2. Raid puzzle — highest within raid (only meaningful when raid is actually active).
  if (raidActive && input.raidPuzzleOpen) {
    return { top: "raid-puzzle", blocksGameplay: true, pausesClock: true, escape: "delegate-raid", layer: "mode" };
  }

  // 3. Raid state (lobby/active/ended) — RaidView owns Escape; never close a hidden farm UI.
  if (raidActive) {
    return {
      top: RAID_STATE[input.raidPhase],
      blocksGameplay: true,
      pausesClock: true,
      escape: "delegate-raid",
      layer: "mode",
    };
  }

  // 4. Shop (modal) — farm-surface priority: shop → cooking → gift → dialogue → panel.
  if (input.showShop) {
    return { top: "shop", blocksGameplay: true, pausesClock: true, escape: "close-shop", layer: "modal" };
  }

  // 4b. W2 Cooking modal — same blocking contract as shop.
  if (input.showCooking) {
    return { top: "cooking", blocksGameplay: true, pausesClock: true, escape: "close-cooking", layer: "modal" };
  }

  // 4c. W3 Decor edit mode — scene reroutes input cho con trỏ; clock vẫn chạy
  // (đặt đồ là hoạt động trong game); shell hotkeys + Space bị chặn.
  if (input.decorMode) {
    return { top: "decor-mode", blocksGameplay: false, pausesClock: false, escape: "exit-decor", layer: "mode" };
  }

  // 5. Gift picker (modal).
  if (input.giftTarget) {
    return { top: "gift", blocksGameplay: true, pausesClock: true, escape: "close-gift", layer: "modal" };
  }

  // 6. Dialogue (modal).
  if (input.dialogueNpc) {
    return { top: "dialogue", blocksGameplay: true, pausesClock: true, escape: "close-dialogue", layer: "modal" };
  }

  // 7. Panel.
  if (input.activePanel) {
    return { top: "panel", blocksGameplay: true, pausesClock: true, escape: "close-panel", layer: "panel" };
  }

  // 8. None — farm/action-map owns input.
  return { top: "none", blocksGameplay: false, pausesClock: false, escape: "none", layer: "canvas" };
}
