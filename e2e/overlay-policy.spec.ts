// Phase 2 E2E — overlay-policy proof (verification-and-rollout-matrix §Overlay and input).
// Proves the migrated GameLayout pause/Escape derivation (now driven by resolveSurface)
// still freezes the farm clock + player while a blocking surface is open, closes only the
// top surface on Escape, and resumes afterwards. This is the regression net for the
// highest-risk change in the plan.
//
// Clock assertions are tolerance-based: setPaused engages on the next render cycle, so a
// sub-tick race window is expected (and unchanged by the migration). We distinguish "frozen"
// (advance < EPSILON_FROZEN) from "running" (advance > EPSILON_RUNNING).
//
// Raid-block is covered at the unit level (ui-gate.test.ts asserts raid lobby/active/ended
// → blocked; overlay-policy.test.ts asserts raid pausesClock) and via the dedicated raid
// E2E specs, so it is not duplicated here.
import { test, expect, type Page } from "@playwright/test";
import { startNewGame, readGameState } from "./helpers";
import { getPlayerPos } from "./helpers/phaser-canvas-strategy";

const EPSILON_FROZEN = 0.1; // game-minutes; pause must keep advance well under this
const EPSILON_RUNNING = 0.3; // game-minutes advanced over the running window

test.describe("Overlay policy — block / Escape / resume", () => {
  test.beforeEach(async ({ page }) => {
    await startNewGame(page);
  });

  /** Press WASD; return true if the player moved. */
  async function attemptedMove(page: Page): Promise<boolean> {
    const before = await getPlayerPos(page);
    await page.keyboard.press("w");
    await page.keyboard.press("d");
    await page.waitForTimeout(250);
    const after = await getPlayerPos(page);
    return before.x !== after.x || before.y !== after.y;
  }

  test("inventory panel freezes clock + player; Escape closes; clock resumes", async ({ page }) => {
    await page.keyboard.press("i");
    await page.getByRole("dialog", { name: "Inventory & Tools" }).waitFor({ state: "visible" });

    // While open: clock nearly frozen and WASD does not move the player.
    const frozenStart = (await readGameState(page)).game.timeMinutes as number;
    await page.waitForTimeout(900);
    const frozenEnd = (await readGameState(page)).game.timeMinutes as number;
    expect(frozenEnd - frozenStart, "clock frozen while panel open").toBeLessThan(EPSILON_FROZEN);
    expect(await attemptedMove(page), "player must not move while panel open").toBe(false);

    // Escape closes ONLY this surface.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Inventory & Tools" })).toBeHidden();

    // After close: clock advances meaningfully again.
    const resumeStart = (await readGameState(page)).game.timeMinutes as number;
    await page.waitForTimeout(900);
    const resumeEnd = (await readGameState(page)).game.timeMinutes as number;
    expect(resumeEnd - resumeStart, "clock resumes after close").toBeGreaterThan(EPSILON_RUNNING);
  });

  test("shop freezes clock + player; Escape closes", async ({ page }) => {
    await page.keyboard.press("g");
    await page.getByRole("dialog", { name: "Shop" }).waitFor({ state: "visible" });

    const frozenStart = (await readGameState(page)).game.timeMinutes as number;
    await page.waitForTimeout(900);
    const frozenEnd = (await readGameState(page)).game.timeMinutes as number;
    expect(frozenEnd - frozenStart, "clock frozen while shop open").toBeLessThan(EPSILON_FROZEN);
    expect(await attemptedMove(page), "player must not move while shop open").toBe(false);

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Shop" })).toBeHidden();
  });

  test("Escape closes only the top surface (policy precedence: shop > panel)", async ({ page }) => {
    await page.keyboard.press("i");
    await page.getByRole("dialog", { name: "Inventory & Tools" }).waitFor({ state: "visible" });
    await page.keyboard.press("g");
    await page.getByRole("dialog", { name: "Shop" }).waitFor({ state: "visible" });

    // First Escape closes the shop (top modal); the panel beneath stays open.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Shop" })).toBeHidden();
    await expect(page.getByRole("dialog", { name: "Inventory & Tools" })).toBeVisible();

    // Second Escape closes the panel.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Inventory & Tools" })).toBeHidden();
  });
});
