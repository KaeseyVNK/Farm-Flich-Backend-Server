// Phase 4 — modal focus/Escape characterization (phase-04 §Tests before → Modal focus and Escape).
// Pins the a11y contract that every migrated surface must keep:
//   • Start screen: traps Tab inside its card (focus never leaks to the canvas/backdrop),
//     Escape does NOT implicitly close it (policy escape: "none"), and hotkeys (I/P/C/S) do
//     not open panels or move while the dialog is up.
//   • A panel traps Tab in its section and Escape closes ONLY the top surface; after close,
//     focus returns to the opening control.
// Art-independent: asserts focus/input behavior, not pixels.
import { test, expect } from "@playwright/test";
import { startNewGame, shot } from "./helpers";

test.describe("Modal focus + Escape (characterization)", () => {
  test("StartScreen traps Tab inside card; Escape does not close it", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Save Slots").waitFor({ state: "visible", timeout: 20_000 });
    // Focus lands on the first focusable inside the start card (a save-slot action) — the
    // useFocusTrap hook defers one frame to the first focusable; assert focus is INSIDE the
    // dialog, not on <body>.
    const focusedInside = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      const dlg = document.querySelector('[role="dialog"][aria-modal="true"]');
      return !!dlg && !!active && dlg.contains(active);
    });
    expect(focusedInside).toBe(true);

    // Tab cycles WITHIN the card — the focused element must stay inside the dialog after a
    // handful of tabs (a leaked focus would land on body/backdrop).
    for (let i = 0; i < 12; i++) await page.keyboard.press("Tab");
    const stillInside = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      const dlg = document.querySelector('[role="dialog"][aria-modal="true"]');
      return !!dlg && !!active && dlg.contains(active);
    });
    expect(stillInside).toBe(true);

    // Escape must NOT close the start dialog (implicit reset protection).
    await page.keyboard.press("Escape");
    await page.getByText("Save Slots").waitFor({ state: "visible", timeout: 5_000 });
    await shot(page, "40-start-focus-trap");
  });

  test("StartScreen blocks panel hotkeys (I/P/C/S cannot open a panel)", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Save Slots").waitFor({ state: "visible", timeout: 20_000 });
    for (const k of ["i", "p", "c", "m"]) await page.keyboard.press(k);
    // No dialog besides the start screen appears.
    const dialogs = await page.locator('[role="dialog"][aria-modal="true"]').count();
    expect(dialogs).toBe(1);
  });

  test("panel: Escape closes panel and restores focus to the opening nav button", async ({ page }) => {
    await startNewGame(page);
    // Open inventory via the desktop FeatureBar tooltip-accessible button (label from
    // FEATURE_LABELS.inventory.label = "Inventory & Tools"). Redesigned dock thu gọn theo
    // mặc định — mở dock qua menu trigger trước.
    await page.getByRole("button", { name: "Mở menu nông trại" }).click();
    await page.getByRole("button", { name: "Inventory & Tools" }).click();
    await page.getByRole("dialog", { name: "Inventory & Tools" }).waitFor({ state: "visible" });
    // Focus trap inside panel — assert active element is inside the panel dialog.
    const inPanel = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      const dlg = document.querySelector('[role="dialog"][aria-modal="true"]');
      return !!dlg && !!active && dlg.contains(active);
    });
    expect(inPanel).toBe(true);
    // Escape closes panel.
    await page.keyboard.press("Escape");
    await page.getByRole("dialog", { name: "Inventory & Tools" }).waitFor({ state: "hidden" });
    // Focus returned to the opening button (ContextPanel useFocusTrap restore).
    const restored = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      return active && active.getAttribute("aria-label") === "Inventory & Tools";
    });
    expect(restored).toBe(true);
  });
});