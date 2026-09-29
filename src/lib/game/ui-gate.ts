// ui-gate — single source of truth cho "gameplay có bị chặn không".
//
// Trước đây mỗi layer (GameEngine legacy, FarmScene Phaser, Hotbar hotkeys,
// GameEngine touch) tự duplicate một danh sách overlay gate. Khi raid phase
// (lobby/active/ended) không được thêm vào, WASD vẫn di chuyển player ẩn sau
// raid backdrop full-screen, in-game clock vẫn advance trong lúc raid, phím số
// vẫn select slot xuyên raid.
//
// Mọi nơi đọc "có nên chặn input/tick?" phải dùng helper này để không sót 1
// trong 4 nơi khi thêm overlay/phase mới.
//
// Phase 2 (overlay-policy): the block decision is now delegated to the ONE pure
// resolver in overlay-policy.ts, so ui-gate and GameLayout's pause derivation can no
// longer diverge. GameLayout reuses getSurfacePolicy() for its pause/Escape logic.

import { useUiStore } from "@/store/uiStore";
import { useRaidStore } from "@/store/raidStore";
import { useDecorModeStore } from "@/store/decorModeStore";
import { resolveSurface, type OverlayInputs, type SurfacePolicy } from "@/lib/game/overlay-policy";

/**
 * Read only the required store slices into the resolver's input shape. raidPuzzleOpen is
 * local RaidView presentation state and is not persisted in the stores; for the gate it
 * defaults to false (raid-active blocks regardless of an open puzzle).
 */
export function readOverlayInputs(): OverlayInputs {
  const ui = useUiStore.getState();
  const raid = useRaidStore.getState();
  return {
    activePanel: ui.activePanel,
    dialogueNpc: ui.dialogueNpc,
    giftTarget: ui.giftTarget,
    showShop: ui.showShop,
    showCooking: ui.showCooking,
    decorMode: useDecorModeStore.getState().active,
    showStartScreen: ui.showStartScreen,
    raidPhase: raid.phase,
    raidPuzzleOpen: false,
  };
}

/** Resolve the full surface policy from current store state (shared by ui-gate + GameLayout). */
export function getSurfacePolicy(): SurfacePolicy {
  return resolveSurface(readOverlayInputs());
}

/** True khi bất kỳ overlay/phase nào chặn gameplay input + clock tick. */
export function isGameplayBlocked(): boolean {
  return getSurfacePolicy().blocksGameplay;
}
