"use client";

import { useEffect, useMemo } from "react";
import { FeatureBar } from "./FeatureBar";
import { TopHUD } from "./TopHUD";
import { HudVitals } from "./HudVitals";
import { HudQuest } from "./HudQuest";
import { Hotbar } from "./Hotbar";
import { ContextPanel } from "./ContextPanel";
import { Notifications } from "./Notifications";
import { GameCanvas } from "@/components/game/GameCanvas";
import { TouchControls } from "./TouchControls";
import { MobileTabBar } from "./MobileTabBar";
import { DialogueModal } from "@/components/overlays/DialogueModal";
import { GiftPickerModal } from "@/components/overlays/GiftPickerModal";
import { ShopModal } from "@/components/overlays/ShopModal";
import { CookingModal } from "@/components/overlays/CookingModal";
import { DecorOverlay } from "@/components/overlays/DecorOverlay";
import { useDecorModeStore } from "@/store/decorModeStore";
import { StartScreen } from "@/components/overlays/StartScreen";
import { NewDayToast } from "@/components/overlays/NewDayToast";
import { LevelUpToast } from "@/components/overlays/LevelUpToast";
import { FishingOverlay } from "@/components/overlays/FishingOverlay";
import { useUiStore, type PanelId } from "@/store/uiStore";
import { useGameStore } from "@/store/gameStore";
import { useInventoryStore } from "@/store/inventoryStore";
import { useAutosave } from "@/hooks/game/useAutosave";
import { useSeasonalMusic } from "@/hooks/game/useSeasonalMusic";
import { migrateLegacySave } from "@/lib/game/save";
import { useAnonAuth } from "@/hooks/use-anon-auth";
import { useReputationHydrate } from "@/hooks/use-reputation-hydrate";
import { useOwnerRaidNotify } from "@/hooks/use-owner-raid-notify";
import { installGameTestBridge } from "@/lib/game/test-bridge";
import { resolveSurface } from "@/lib/game/overlay-policy";
import { useRaidStore } from "@/store/raidStore";

// Note: KHÔNG map S → skills — S thuộc WASD (MoveDown) trong game canvas.
// Skills mở được qua FeatureBar/MobileTabBar. (review #1)
const KEY_TO_PANEL: Record<string, NonNullable<PanelId>> = {
  i: "inventory",
  p: "seeds",
  c: "crafting",
  m: "map",
  r: "relationships",
  l: "calendar",
  h: "help",
};

export function GameLayout() {
  const togglePanel = useUiStore((s) => s.togglePanel);
  const closePanel = useUiStore((s) => s.closePanel);
  const activePanel = useUiStore((s) => s.activePanel);
  const dialogueNpc = useUiStore((s) => s.dialogueNpc);
  const closeDialogue = useUiStore((s) => s.closeDialogue);
  const giftTarget = useUiStore((s) => s.giftTarget);
  const closeGiftPicker = useUiStore((s) => s.closeGiftPicker);
  const showShop = useUiStore((s) => s.showShop);
  const setShowShop = useUiStore((s) => s.setShowShop);
  const showCooking = useUiStore((s) => s.showCooking);
  const setShowCooking = useUiStore((s) => s.setShowCooking);
  const decorModeOn = useDecorModeStore((s) => s.active);
  const showStartScreen = useUiStore((s) => s.showStartScreen);
  const raidPhase = useRaidStore((s) => s.phase);
  const season = useGameStore((s) => s.season);

  // Phase 2 overlay-policy: ONE resolver drives pause + Escape + hotkey gating, so the gate
  // (ui-gate, includes raid) and this layout no longer diverge. raidPuzzleOpen is local
  // RaidView state (not in stores); for shell-level decisions it is false — RaidView owns the
  // inside-raid Escape/puzzle sequence regardless. The ONLY behavior change vs. the old
  // hand-rolled lists is the documented fix: raid now pauses the farm clock (contract: raid
  // lobby/active/ended → pausesClock yes). Space/hotkey gating is derived from `top` to stay
  // behavior-compatible on farm surfaces (raid excluded, matching prior behavior).
  const surface = useMemo(
    () =>
      resolveSurface({
        activePanel,
        dialogueNpc,
        giftTarget,
        showShop,
        showCooking,
        decorMode: decorModeOn,
        showStartScreen,
        raidPhase,
        raidPuzzleOpen: false,
      }),
    [activePanel, dialogueNpc, giftTarget, showShop, showCooking, decorModeOn, showStartScreen, raidPhase],
  );
  // Space may activate focused buttons when a farm overlay/start is up (Space is reserved for
  // game interact otherwise). Raid excluded — RaidView owns its own Space handling.
  const spaceOverlayOpen = ["start", "panel", "dialogue", "gift", "shop", "cooking", "decor-mode"].includes(surface.top);
  // Gameplay/panel hotkeys are blocked while a modal or the start screen is up. A bare panel
  // does NOT block panel-switching hotkeys (you can switch panels); raid excludes shell keys.
  const blocksShellHotkeys = ["start", "shop", "cooking", "decor-mode", "gift", "dialogue"].includes(surface.top);

  // Auto-save: on morning + debounced on inventory/quest changes.
  useAutosave();

  // Anonymous auth: tự signInAnonymously nếu chưa có session (Masked Farm).
  useAnonAuth();
  // W7d-P1: kéo reputation server (farmer/thief/guard) về cache — hiệu ứng +5% giá bán v.v.
  useReputationHydrate();

  // E2E test bridge (dev-only, NEXT_PUBLIC_E2E=1).
  useEffect(() => {
    installGameTestBridge();
  }, []);

  // Owner raid notify: Realtime RaidSession INSERT → toast + lockdown trigger.
  const showStartScreen0 = useUiStore((s) => s.showStartScreen);
  useOwnerRaidNotify(!showStartScreen0);

  // Seasonal background music (procedural WebAudio).
  useSeasonalMusic();

  // One-time migration of the legacy localStorage single-save to slot1.
  useEffect(() => {
    migrateLegacySave();
  }, []);

  // Keyboard a11y: prevent Space from activating focused UI buttons khi KHÔNG có
  // overlay nào mở (Space reserved cho game interact). Khi modal/panel mở, Space
  // hoạt động bình thường trên button (WAI-ARIA). Enter luôn activates buttons.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Spacebar") {
        if (spaceOverlayOpen) return; // audit H4: cho Space hoạt động trong overlay
        const tag = (e.target as HTMLElement)?.tagName;
        const role = (e.target as HTMLElement)?.getAttribute("role");
        if (tag === "BUTTON" || tag === "A" || tag === "SUMMARY" || role === "button" || role === "tab") {
          e.preventDefault();
        }
      }
    };
    window.addEventListener("keydown", handler, true); // capture phase
    return () => window.removeEventListener("keydown", handler, true);
  }, [spaceOverlayOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const k = e.key.toLowerCase();
      if (k === "escape") {
        // Close the TOP surface only, in contract priority order. Raid/start delegate
        // elsewhere (RaidView owns inside-raid Escape; start never closes on implicit Escape).
        switch (surface.escape) {
          case "close-shop":
            setShowShop(false);
            return;
          case "close-cooking":
            setShowCooking(false);
            return;
          case "exit-decor":
            useDecorModeStore.getState().dispatch({ type: "exit" });
            return;
          case "close-gift":
            closeGiftPicker();
            return;
          case "close-dialogue":
            closeDialogue();
            return;
          case "close-panel":
            closePanel();
            return;
          case "none":
          case "delegate-raid":
          default:
            return;
        }
      }
      // Ignore gameplay/panel hotkeys while a modal overlay is open
      // (bao gồm StartScreen — review #4: S/B/G không được xuyên qua title screen)
      if (blocksShellHotkeys) return;
      // G = general store
      if (k === "g") {
        e.preventDefault();
        setShowShop(true);
        return;
      }
      // Q = cycle to next tool. (Tab từng dùng chung nhánh nhưng leak: Tab trong
      // panel có focus trên BUTTON vẫn trigger cycle do guard chỉ chặn INPUT/TEXTAREA.
      // Q đã đủ; Tab giữ focus semantics chuẩn — di chuyển focus trong panel/modal.)
      if (k === "q") {
        e.preventDefault();
        const inv = useInventoryStore.getState();
        const toolIds = ["hoe", "watering_can", "axe", "pickaxe", "scythe"];
        // Chỉ cycle qua tools CÓ trong inventory (audit #8). Trước đây luôn lấy
        // tool kế theo thứ tự — nếu tool đó đã bị bán/không có, findIndex -1 →
        // selectSlot(-1) clamp về 0 → chọn nhầm non-tool. Loc: cur không có
        // (stale "hand") → bắt đầu từ tool đầu có trong inventory.
        const owned = toolIds.filter((id) => inv.slots.some((s) => s?.itemId === id));
        if (owned.length === 0) return;
        const cur = inv._equippedTool;
        let idx = owned.indexOf(cur);
        if (idx === -1) idx = owned.length - 1; // stale → cycle từ tool cuối (sẽ về đầu)
        const next = owned[(idx + 1) % owned.length];
        const slotIdx = inv.slots.findIndex((s) => s?.itemId === next);
        if (slotIdx >= 0) inv.selectSlot(slotIdx);
        return;
      }
      if (KEY_TO_PANEL[k]) {
        e.preventDefault();
        togglePanel(KEY_TO_PANEL[k]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    surface,
    blocksShellHotkeys,
    togglePanel,
    closePanel,
    closeDialogue,
    closeGiftPicker,
    setShowShop,
  ]);

  // WebGL context-loss recovery (spike NOTES #12): Phaser 4 fires `contextlost`
  // on game.events → PhaserGame dispatch `hh-contextlost`. Nghe để notify + keep
  // paused (Phaser tự pause render); khi canvas khôi phục (`webglcontextrestored`
  // native — browser fire trên canvas), unpause + notify để người chơi tiếp tục.
  // Không dựa vào Phaser `contextrestored` event (API v4 chưa xác nhận ổn định).
  const setPaused = useGameStore((s) => s.setPaused);
  useEffect(() => {
    // Phase 2: pause derives from the ONE overlay policy. This converges with ui-gate
    // (which always included raid) — raid lobby/active/ended now pauses the farm clock too,
    // matching the handoff-contract pause table.
    setPaused(surface.pausesClock);
  }, [surface.pausesClock, setPaused]);

  // WebGL context-loss recovery (spike NOTES #12): Phaser 4 fires `contextlost`
  // on game.events → PhaserGame dispatch `hh-contextlost`. Nghe để notify + keep
  // paused (Phaser tự pause render); khi canvas khôi phục (`webglcontextrestored`
  // native — browser fire trên canvas), unpause + notify để người chơi tiếp tục.
  useEffect(() => {
    const onContextLost = () => {
      useUiStore.getState().notify("Đồ họa bị gián đoạn — đang chờ khôi phục…", "warn");
    };
    const onContextRestored = () => {
      useUiStore.getState().notify("Đồ họa đã khôi phục!", "success");
    };
    window.addEventListener("hh-contextlost", onContextLost);
    // Native WebGL restore — fire trên <canvas> (Phaser scale-managed canvas).
    window.addEventListener("webglcontextrestored", onContextRestored);
    return () => {
      window.removeEventListener("hh-contextlost", onContextLost);
      window.removeEventListener("webglcontextrestored", onContextRestored);
    };
  }, []);

  return (
    <div className="farm-shell flex h-dvh w-screen flex-col overflow-hidden" data-season={season}>
      {/* Fullscreen world. FeatureBar floats above the playfield as a compact utility dock. */}
      <div className="relative min-h-0 flex-1">
        <FeatureBar />

        {/* Viewport area */}
        <main className="farm-viewport relative h-full min-w-0" aria-label="Nông trại Masked Farm">
          {/* Game canvas fills entire viewport (HUD floats on top) */}
          <div className="absolute inset-0">
            <GameCanvas />
          </div>

          {/* A quiet edge treatment keeps the pixel canvas framed without covering the world. */}
          <div className="farm-canvas-frame pointer-events-none absolute inset-0 z-[var(--z-world-hint)]" aria-hidden />

          {/* Farm RPG 4-corner HUD: menu stack (FeatureBar), clock/gold, hotbar, vitals.
              Quest pin sits under the left dock so the meadow stays the hero. */}
          {raidPhase === "idle" ? (
            <div className="pointer-events-none absolute left-4 top-4 z-[var(--z-hud)] md:top-[11.5rem]">
              <HudQuest />
            </div>
          ) : null}

          <div className="pointer-events-none absolute right-4 top-4 z-[var(--z-hud)]">
            <TopHUD />
          </div>

          {/* Hotbar overlay (bottom center) — leave a right gutter for vitals; mobile sits
              above MobileTabBar and below the D-pad (bottom-36). */}
          <div className="pointer-events-none absolute bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] left-1/2 z-[var(--z-hud)] -translate-x-[calc(50%+2rem)] md:bottom-6 md:translate-x-[-50%]">
            <Hotbar />
          </div>

          <div className="pointer-events-none absolute bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] right-4 z-[var(--z-hud)] md:bottom-6">
            <HudVitals />
          </div>

          {/* Mobile touch controls (D-pad + action button) — hidden on desktop + khi raid
              overlay active (raid có RaidTouchControls riêng, không farm input leak). */}
          {raidPhase === "idle" && <TouchControls />}

          {/* Mobile bottom tab bar — replaces the left FeatureBar on small screens */}
          <MobileTabBar />

          {/* Contextual panel (slides from left) */}
          <ContextPanel />

          {/* Notifications */}
          <Notifications />

          {/* Overlays */}
          {/* key={dialogueNpc}: remount khi đổi NPC → state (justTalked/choice)
              tự reset, không cần effect setState (react-hooks/set-state-in-effect) */}
          <DialogueModal key={dialogueNpc ?? "none"} />
          <GiftPickerModal />
          <ShopModal />
          <CookingModal /> {/* W2P4 — bếp kitchenpot trong nhà */}
          <DecorOverlay /> {/* W3P4 — hint + nút chế độ trang trí */}
          <NewDayToast />
          <StartScreen />
          <LevelUpToast />
          <FishingOverlay /> {/* W1P6 cache-bust: turbopack stale chunk guard */}
        </main>
      </div>
    </div>
  );
}
