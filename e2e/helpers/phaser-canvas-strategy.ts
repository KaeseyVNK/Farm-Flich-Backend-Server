// E2E Phaser canvas strategy (validate decision #8 — CDP Runtime.evaluate).
// Phaser render vào <canvas> không có DOM selectors. DOM overlay React HUD đủ cho HUD selectors;
// canvas state probe = CDP Runtime.evaluate qua page.evaluate(() => window.__game.scene...).
import type { Page } from "@playwright/test";

/** Singleton game ref expose ở dev/test: window.__game = Phaser.Game instance. */
export const GAME_GLOBAL = "__game" as const;

/** Eval expression trong Phaser scene context. */
export async function phaserEval<T>(page: Page, expr: string): Promise<T> {
  const wrapped = `(function() {
    const game = window.${GAME_GLOBAL};
    if (!game) throw new Error('window.${GAME_GLOBAL} not exposed (dev/test only)');
    ${expr}
  })()`;
  return page.evaluate(wrapped) as Promise<T>;
}

/** Query active scene. */
export async function getActiveSceneKey(page: Page): Promise<string> {
  return phaserEval<string>(
    page,
    `return game.scene.keys[Object.keys(game.scene.keys).find(k => game.scene.isActive(k))];`,
  );
}

/** Query player position (farm scene). */
export async function getPlayerPos(page: Page): Promise<{ x: number; y: number }> {
  return phaserEval<{ x: number; y: number }>(
    page,
    `const s = game.scene.getScene('FarmScene'); return { x: s.player?.x ?? 0, y: s.player?.y ?? 0 };`,
  );
}

/**
 * Wire window.__game expose — FarmScene / BootScene phải set trong create():
 *   if (typeof window !== 'undefined') (window as any).__game = this.game;
 * Dev/test-only hook; production strip qua NEXT_PUBLIC_E2E flag.
 */
export const EXPOSE_HOOK = `window.${GAME_GLOBAL} = this.game; // E2E CDP eval (dev/test only)`;
