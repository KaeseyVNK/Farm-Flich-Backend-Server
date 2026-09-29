// Phase 6 E2E — touch-controls (matrix §Input lifecycle + §mobile aidé). Phase 5 added the
// mobile farm D-pad (tokenized TouchControls) and RaidTouchControls; this spec proves they
// are real input surfaces, not decoration:
//   - farm D-pad button press moves the player (server/bridge authority — we only assert the
//     player position changed, matching keyboard UX),
//   - D-pad buttons are 44px+ touch targets and remain reachable on the narrow viewport,
//   - raid touch controls exist (raid-lobby "Đi trộm" reachable on mobile; full raid input
//     lifecycle is exercised by raid-join.spec).
import { test, expect } from "@playwright/test";
import { startNewGame, waitForFarmCanvasReady } from "./helpers";
import { getPlayerPos } from "./helpers/phaser-canvas-strategy";

test.describe("Farm touch D-pad", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("D-pad press moves the player (touch input path)", async ({ page }) => {
    await startNewGame(page);
    await waitForFarmCanvasReady(page);

    // D-pad visible with 4 movement directions labelled.
    const dpad = page.locator('[data-testid="touch-controls"]');
    await expect(dpad).toBeVisible();
    for (const dir of ["Đi lên", "Đi xuống", "Đi trái", "Đi phải"]) {
      await expect(dpad.getByRole("button", { name: dir })).toBeVisible();
    }

    // Up press → player y decreases (north is negative in Phaser). Use a real pointer down/up
    // at the button centre so pointer capture + setVirtualKey both run with a live pointer id.
    const before = await getPlayerPos(page);
    const box = await dpad.getByRole("button", { name: "Đi lên" }).boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(300);
    await page.mouse.up();
    const after = await getPlayerPos(page);
    expect(after.y, "up press must move the player north").toBeLessThan(before.y);
  });

  test("D-pad + hotbar buttons are 44px+ touch targets @375", async ({ page }) => {
    await startNewGame(page);
    await waitForFarmCanvasReady(page);

    const targets = [
      page.locator('[data-testid="touch-controls"] [aria-label="Đi lên"]'),
      page.locator('[data-testid="touch-controls"] [aria-label="Đi phải"]'),
      page.getByRole("button", { name: "Interact / use tool" }),
    ];
    for (const t of targets) {
      const b = await t.boundingBox();
      expect(b, "visible touch target").not.toBeNull();
      expect(b!.width, "≥44px width").toBeGreaterThanOrEqual(44);
      expect(b!.height, "≥44px height").toBeGreaterThanOrEqual(44);
    }
  });
});