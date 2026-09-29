import { test, expect, type Page } from "@playwright/test";
import { startNewGame, shot } from "./helpers";

/**
 * E2E — Responsive UI (audit UX #mobile): TopHUD không tràn ngang trên mobile
 * (màn 375px), MobileTabBar hiện thay FeatureBar, energy badge hiển thị.
 *
 * Dùng viewport nhỏ 375×667 (iPhone SE-ish) — vừa đủ chặt để bắt overflow.
 */

test.describe("Responsive layout (mobile)", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("TopHUD không tràn + MobileTabBar + energy badge hiện", async ({ page }) => {
    await startNewGame(page);

    // TopHUD hiển thị — redesigned day indicator: SeasonDial/hud-stat render "Xuân · Ngày 1"
    // (vi) / "Spring · Day 1" (en); cũ "D1" đã mất sau visual redesign (TopHUD.tsx StatusCluster).
    await page.getByText(/(ngày|day)\s*1/i).first().waitFor({ state: "visible" });
    // Clock hiển thị (6:00 AM)
    await page.getByText(/6:00/i).waitFor({ state: "visible" });

    // Energy meter (bottom-right vitals) — locale: "Thể lực: x/y" (vi) / "Energy: x/y" (en).
    const energyBadge = page.getByTestId("hud-energy");
    await energyBadge.waitFor({ state: "visible" });
    await expect(energyBadge).toHaveAttribute(
      "aria-label",
      /(thể lực|energy|năng lượng):\s*\d+\/\d+/i,
    );

    // MobileTabBar hiện (thay FeatureBar) — 4 primary nav buttons (Bag/Plant/Map/More).
    await page.getByRole("navigation", { name: "Game features" }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Bag" }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "More" }).waitFor({ state: "visible" });
    // Skills lives in the More sheet now — open it and confirm Skills is reachable.
    await page.getByRole("button", { name: "More" }).click();
    await page.getByRole("dialog", { name: "More" }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Skill Trees" }).waitFor({ state: "visible" });
    await page.keyboard.press("Escape");

    // KHÔNG tràn ngang: header TopHUD không có scroll ngang
    const measure = await page.evaluate(() => {
      const hud = document.querySelector('[role="banner"]');
      if (!hud) return { sw: 0, cw: 0 };
      return { sw: hud.scrollWidth, cw: hud.clientWidth };
    });
    expect(measure.sw <= measure.cw + 1).toBe(true);

    await shot(page, "70-mobile-top-hud");
  });

  test("mobile mở panel qua MobileTabBar vẫn ổn", async ({ page }) => {
    await startNewGame(page);

    // Xóa Next.js dev overlay (nextjs-portal) chặn pointer events trên mobile viewport
    await page.evaluate(() => {
      document.querySelectorAll("nextjs-portal, [data-nextjs-dev-overlay]").forEach((el) => el.remove());
    });
    await page.waitForTimeout(200);

    // Mở Inventory qua nav button (Bag)
    await page.getByRole("button", { name: "Bag" }).click();
    await page.getByRole("dialog", { name: "Inventory & Tools" }).waitFor({ state: "visible" });
    await shot(page, "71-mobile-panel");
  });
});

test.describe("Responsive layout (desktop)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("TopHUD desktop hiện đầy đủ + FeatureBar", async ({ page }) => {
    await startNewGame(page);

    await page.getByTestId("hud-energy").waitFor({ state: "visible" });
    // Season full label — redesigned StatusCluster: kicker "… · Year 1"/"… · Năm 1" + value
    // "Spring · Day 1"/"Xuân · Ngày 1" (cũ "Spr · Y1" đã mất sau visual redesign).
    await page.getByText(/(year|năm)\s*1/i).first().waitFor({ state: "visible" });
    // FeatureBar (dock trái) thu gọn sau redesign — mở dock rồi xác nhận nút Settings.
    await page.getByRole("button", { name: "Mở menu nông trại" }).click();
    await page.getByRole("button", { name: "Settings" }).first().waitFor({ state: "visible" });
    await shot(page, "72-desktop-top-hud");
  });
});

// Phase 2 safe-zone (verification-and-rollout-matrix §Layout and responsive): at the narrow
// mobile + landscape sizes, the D-pad, Use button, hotbar and mobile nav must not overlap and
// nothing must cause horizontal page overflow.
function rectsOverlap(
  a: { x: number; y: number; width: number; height: number } | null,
  b: { x: number; y: number; width: number; height: number } | null,
): boolean {
  if (!a || !b) return false;
  return (
    a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
  );
}

async function assertSafeZone(page: Page) {
  await startNewGame(page);
  // Remove the Next.js dev overlay that can intercept pointer/overlap measurements.
  await page.evaluate(() => {
    document.querySelectorAll("nextjs-portal, [data-nextjs-dev-overlay]").forEach((el) => el.remove());
  });

  const dpad = await page.locator('[data-testid="touch-controls"]').boundingBox();
  const use = await page.getByRole("button", { name: "Interact / use tool" }).boundingBox();
  const hotbar = await page.locator('[data-testid="hotbar"]').boundingBox();
  const nav = await page.getByRole("navigation", { name: "Game features" }).boundingBox();
  const vitals = await page.locator('[data-testid="hud-vitals"]').boundingBox();

  // Nav vs the other three must never overlap.
  expect(rectsOverlap(dpad, nav), "D-pad ∩ nav").toBe(false);
  expect(rectsOverlap(use, nav), "Use ∩ nav").toBe(false);
  expect(rectsOverlap(hotbar, nav), "hotbar ∩ nav").toBe(false);
  expect(rectsOverlap(hotbar, dpad), "hotbar ∩ D-pad").toBe(false);
  expect(rectsOverlap(hotbar, vitals), "hotbar ∩ vitals").toBe(false);
  expect(rectsOverlap(nav, vitals), "nav ∩ vitals").toBe(false);

  // No horizontal page overflow.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "horizontal overflow").toBeLessThanOrEqual(0);
}

test.describe("Mobile safe-zone (no control collision)", () => {
  for (const [name, viewport] of [
    ["mobile 375", { width: 375, height: 667 }],
    ["narrow 320", { width: 320, height: 568 }],
    ["landscape 667×375", { width: 667, height: 375 }],
  ] as const) {
    test(`no overlap among D-pad/Use/hotbar/nav @ ${name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await assertSafeZone(page);
    });
  }
});

// Phase 6 — matrix §mobile-landscape (667×375 DPR2): retina landscape for shell/farm. DPR is
// fixed at test.use time (cannot be set per-page), so landscape DPR2 runs as its own case.
test.describe("Mobile safe-zone @ landscape DPR2", () => {
  test.use({ viewport: { width: 667, height: 375 }, deviceScaleFactor: 2 });

  test("no overlap among D-pad/Use/hotbar/nav + no overflow @ landscape DPR2", async ({ page }) => {
    await assertSafeZone(page);
  });
});
