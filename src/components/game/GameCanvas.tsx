"use client";

import { useEffect, useRef } from "react";
import { GameEngine } from "./GameEngine";
import { PhaserGame } from "./PhaserGame";
import { PhaserErrorBoundary } from "./PhaserErrorBoundary";

// ?sprite=off → procedural Canvas 2D fallback (textures-legacy.ts fork, đông lạnh).
// Default → Phaser 4 engine. ADR-013 rollback.
function useSpriteOff(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("sprite") === "off";
}

export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const spriteOff = useSpriteOff();

  useEffect(() => {
    if (spriteOff) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const engine = new GameEngine(canvas);
      engineRef.current = engine;
      engine.start();
      const ro = new ResizeObserver(() => engine.resize());
      ro.observe(canvas);
      return () => {
        ro.disconnect();
        engine.stop();
        engineRef.current = null;
      };
    }
    // Phaser path: PhaserGame tự mount trong render.
  }, [spriteOff]);

  if (spriteOff) {
    return (
      <canvas
        ref={canvasRef}
        className="pixelated block h-full w-full"
        style={{ width: "100%", height: "100%", touchAction: "none" }}
        aria-label="Vùng chơi nông trại"
      />
    );
  }

  return (
    <PhaserErrorBoundary>
      <PhaserGame />
    </PhaserErrorBoundary>
  );
}
