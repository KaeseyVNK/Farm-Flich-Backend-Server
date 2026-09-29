"use client";
// PhaserGame — React wrapper mount Phaser 4 vào container. ADR-002 + locale re-mount fix.
// Singleton game ref NGOÀI React state (locale re-mount /vi↔/en không destroy game).
// Dev: destroy on unmount / scene-build bump so FarmScene HMR actually reloads.
import { useEffect, useRef } from "react";
import type Phaser from "phaser";
import { buildGameConfig } from "@/lib/game/phaser/game-config";
import { PHASER_SCENE_BUILD } from "@/lib/game/phaser/scene-build";
// Scenes lazy-required inside useEffect — static imports pull `phaser` into the
// SSR module graph, and Phaser 4 module evaluation references `window` (SSR crash).

// Module-scoped singleton — survives React re-render/re-mount trên locale switch.
let gameSingleton: Phaser.Game | null = null;
let gameParent: HTMLElement | null = null;
let loadedSceneBuild = -1;

function destroyGame(): void {
  if (!gameSingleton) return;
  gameSingleton.destroy(true);
  gameSingleton = null;
  gameParent = null;
  loadedSceneBuild = -1;
}

export function PhaserGame() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const staleScene = loadedSceneBuild !== PHASER_SCENE_BUILD;
    const alive = gameSingleton && !(gameSingleton as { destroyed?: boolean }).destroyed;
    if (alive && staleScene) {
      destroyGame();
    } else if (alive) {
      gameParent = container;
      const canvas = gameSingleton!.canvas as HTMLCanvasElement & { style: CSSStyleDeclaration };
      if (canvas) container.appendChild(canvas);
      return;
    }

    const config = buildGameConfig(container);

    // Lazy require Phaser + scenes (browser-only; SSR safe — none of these may be
    // imported statically since Phaser 4 module evaluation references `window`).
    let game: Phaser.Game | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const PhaserMod = require("phaser");
      const PhaserCtor = PhaserMod.Phaser ?? PhaserMod.default ?? PhaserMod;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const BootScene = require("./scenes/boot-scene").BootScene;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const FarmScene = require("./scenes/farm-scene").FarmScene;
      // Scenes add runtime (tránh import cycle trong config).
      // KHÔNG dùng config.scene = [BootScene, FarmScene]: Phaser 4.2.1 bootQueue
      // add mọi scene qua _pending với placeholder key "default" mà KHÔNG đọc
      // instance sys.settings.key → mọi scene thành "default", getScene("FarmScene")
      // null, FarmScene không render. Add tường minh theo key sau khi game boot.
      game = new PhaserCtor.Game(config) as Phaser.Game;
      const sceneManager = game.scene as unknown as {
        add: (key: string, sceneConfig: unknown, autoStart?: boolean) => unknown;
      };
      // BootScene autoStart=true → bootQueue chạy BootScene trước, nó start FarmScene.
      sceneManager.add("BootScene", BootScene, true);
      sceneManager.add("FarmScene", FarmScene);
    } catch (err) {
      // ErrorBoundary sẽ catch render error; đây catch runtime init fail.
      console.error("[PhaserGame] init failed", err);
      return;
    }

    gameSingleton = game;
    gameParent = container;
    loadedSceneBuild = PHASER_SCENE_BUILD;
    if (typeof window !== "undefined") {
      (window as unknown as { __PHASER_GAME__?: unknown }).__PHASER_GAME__ = game;
    }

    // WebGL context-loss recovery (spike NOTES #12): pause + notify.
    game.events.on("contextlost", () => {
      console.warn("[PhaserGame] WebGL context lost — pausing");
      window.dispatchEvent(new CustomEvent("hh-contextlost"));
    });

    return () => {
      if (process.env.NODE_ENV !== "production") {
        destroyGame();
        return;
      }
      // Phân biệt locale re-mount vs route-away (destroy):
      // - Locale switch (/vi↔/en): React unmount component cũ rồi mount lại NGAY.
      //   useEffect mới chạy (re-parent canvas vào container mới) trước khi timeout
      //   fire → gameParent đã đổi → singleton sống (giữ player pos).
      // - Route away (/play → /market): không có mount lại. Timeout fire, gameParent
      //   vẫn = container cũ (đã remove khỏi DOM) → destroy singleton.
      const oldParent = container;
      setTimeout(() => {
        if (gameParent === oldParent && gameSingleton) {
          destroyGame();
        }
      }, 0);
    };
  }, [PHASER_SCENE_BUILD]);

  return <div ref={containerRef} className="h-full w-full" style={{ touchAction: "none" }} />;
}
