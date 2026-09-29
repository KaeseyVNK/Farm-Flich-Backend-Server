// Phase 6 E2E — performance evidence (matrix §Performance and leak checks, phase-06 §7).
// Phase 1 shipped no hard ms budget, so per matrix guidance we do NOT invent one here: we
// record the current measures and assert the LEAK / health invariants that would signal a
// sustained regression — no duplicate canvas, no resource re-fetch growth under panel churn,
// and panel open latency that does not balloon across repeated opens. Boot latency is logged
// (diagnostic), not pinned to an arbitrary number.
//
// Raid 5Hz interpolation + exit/reset cleanup are covered by raid-join.spec (socket closes
// once, no duplicate finish). Season swap re-render is exercised by the farm route remount
// test in renderer-resilience.spec.ts.
import { test, expect } from "@playwright/test";
import { startNewGame, readGameState } from "./helpers";
import { waitForFarmCanvasReady } from "./helpers";

test.describe("Performance health (no sustained regression)", () => {
  test("farm boot completes and single canvas — no duplicate engine", async ({ page }) => {
    const t0 = Date.now();
    await startNewGame(page);
    await waitForFarmCanvasReady(page);
    const bootMs = Date.now() - t0;

    // Single canvas (one Phaser game), not stacked duplicates after boot.
    const canvasCount = await page.locator("canvas").count();
    expect(canvasCount, "exactly one game canvas").toBe(1);

    console.log(`[perf] farm boot → canvas ready: ${bootMs}ms`);
  });

  test("panel churn: open/close 5× does not balloon latency or leak resources", async ({ page }) => {
    await startNewGame(page);
    await waitForFarmCanvasReady(page);

    const resourceBefore = await page.evaluate(() => performance.getEntriesByType("resource").length);

    const openClose = async (): Promise<number> => {
      const t0 = Date.now();
      await page.keyboard.press("i");
      await page.getByRole("dialog", { name: "Inventory & Tools" }).waitFor({ state: "visible" });
      await page.keyboard.press("Escape");
      await page.getByRole("dialog", { name: "Inventory & Tools" }).waitFor({ state: "hidden" });
      return Date.now() - t0;
    };

    const samples: number[] = [];
    for (let i = 0; i < 5; i++) samples.push(await openClose());
    samples.sort((a, b) => a - b);
    const median = samples[2]; // 5 samples → middle
    console.log(`[perf] panel open+close ×5: ${samples.join("ms, ")}ms → median ${median}ms`);

    // The last open must not be dramatically slower than the first (a ballooning loop would
    // indicate a subscription/RAF/listener leak inside the panel lifecycle).
    expect(samples[4], "5th open not 3× slower than 1st").toBeLessThan(samples[0] * 3 + 50);

    // No resource re-fetch (asset load) grew from panel churn — panels must not lazy-fetch.
    // Phaser may load ≤ a few resources on first open (textures); a LOOP that refetches on
    // every close would blow past a small fixed allowance.
    const resourceAfter = await page.evaluate(() => performance.getEntriesByType("resource").length);
    expect(resourceAfter, "panel churn adds no resource fetches").toBeLessThanOrEqual(resourceBefore + 5);

    // Engine still alive + single canvas after churn.
    const canvasCount = await page.locator("canvas").count();
    expect(canvasCount, "still exactly one canvas").toBe(1);
    const st = await readGameState(page);
    expect(typeof st.game.timeMinutes).toBe("number");
  });
});