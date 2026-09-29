import { test, expect } from "@playwright/test";
import { startNewGame, readGameState, waitForGameState } from "./helpers";

/**
 * E2E — Verify in-game clock ADVANCES in the Phaser default path (code-review C1).
 *
 * C1 bug: FarmScene.update() only moved the player/camera and never called
 * gameStore.tick() — so in the default (Phaser) render path the clock stayed
 * frozen at 6:00 AM forever and the day never ended. This test:
 *   1. Reads timeMinutes — asserts it's near the morning start.
 *   2. Drives real tick() (same fn the scene update calls each frame).
 *   3. Asserts timeMinutes increased (clock advances).
 *   4. Ticks past 2am — FarmScene consumes needsSleep → endDay runs AUTOMATICALLY,
 *      advancing to Day 2 (the C1 behavior, not a manual endDay call).
 */
test.describe("In-game time progression (Phaser default path)", () => {
  test("clock advances via tick + auto-collapse triggers endDay", async ({ page }) => {
    await startNewGame(page);

    let st = await readGameState(page);
    expect(st.game.day).toBe(1);
    // 6:00 AM = 360 min (đã advance vài frame do FarmScene tick chạy khi boot).
    expect(st.game.timeMinutes).toBeGreaterThanOrEqual(360);
    expect(st.game.timeMinutes).toBeLessThan(370);
    const startMin = st.game.timeMinutes as number;

    // ---- Real tick(1000ms) = ~1.43 in-game minutes (same fn scene uses) ----
    await page.evaluate(() => {
      (window as unknown as {
        __gameTest: { actions: { tick: (ms: number) => void } };
      }).__gameTest.actions.tick(1000);
    });
    st = await readGameState(page);
    expect(st.game.timeMinutes).toBeGreaterThan(startMin);

    // ---- Tick far past day-end (2am = 120*60=1200 min) → needsSleep → FarmScene
    // consume → endDay(collapsed=true) → Day 2. Chờ auto-advance (không gọi endDay tay). ----
    await page.evaluate(() => {
      (window as unknown as {
        __gameTest: { actions: { tick: (ms: number) => void } };
      }).__gameTest.actions.tick(60 * 60 * 1000); // 1 real hour
    });
    // FarmScene loop thấy needsSleep → endDay(true) tự động. Đợi day 2.
    await waitForGameState(page, "g.day === 2", 15_000);
    st = await readGameState(page);
    // 6:00 AM ngày 2 (đã advance vài frame — assert khoảng, không exact float).
    expect(st.game.timeMinutes).toBeGreaterThanOrEqual(360);
    expect(st.game.timeMinutes).toBeLessThan(370);
    expect(st.game.collapsed).toBe(true); // 2am collapse penalty applied
  });
});
