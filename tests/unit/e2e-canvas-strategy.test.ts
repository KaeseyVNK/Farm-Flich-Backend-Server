import { describe, it, expect } from "vitest";

// Phase 9: E2E Phaser canvas strategy — CDP Runtime.evaluate pattern.
// Helper phaserEval wrap window.__game. Test pattern correctness (không cần Playwright runtime).
describe("E2E canvas strategy (decision #8 CDP eval)", () => {
  it("phaserEval helpers export đúng signature", async () => {
    const mod = await import("../../e2e/helpers/phaser-canvas-strategy");
    expect(typeof mod.phaserEval).toBe("function");
    expect(typeof mod.getActiveSceneKey).toBe("function");
    expect(typeof mod.getPlayerPos).toBe("function");
    expect(mod.GAME_GLOBAL).toBe("__game");
  });

  it("EXPOSE_HOOK wire window.__game trong scene create()", async () => {
    const mod = await import("../../e2e/helpers/phaser-canvas-strategy");
    expect(mod.EXPOSE_HOOK).toContain("window.__game");
    expect(mod.EXPOSE_HOOK).toContain("this.game");
  });

  it("FarmScene expose __game khi NEXT_PUBLIC_E2E=1 (source audit)", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(process.cwd(), "src/components/game/scenes/farm-scene.ts"),
      "utf8",
    );
    expect(src).toContain("__game");
    expect(src).toContain("NEXT_PUBLIC_E2E");
  });
});
