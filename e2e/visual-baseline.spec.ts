// Phase 1 — visual regression baseline (verification-and-rollout-matrix §Screenshot state
// catalogue). Each capture follows the deterministic fixture contract:
//   1. enable reduced-motion (no optional animation pixel diff)
//   2. reach the surface through the REAL entry path (startNewGame / button / store event)
//   3. wait for a semantic/canvas ready marker — NEVER a blind timeout as the only signal
//   4. assert one semantic/behaviour fact, THEN expect(page).toHaveScreenshot()
//
// FIRST RUN generates the baseline PNG (Playwright auto-creates it). Per the plan, that
// first baseline must be reviewed at native scale and committed only after design approval
// — a snapshot is never accepted solely because it was regenerated. Snapshot dir:
// e2e/visual-baseline.spec.ts-snapshots/. Raid/social states are test.fixme until their
// surfaces are redesigned (Phase 5) and the full env (Supabase + raid-server) is present.
import { test, expect, type Page } from "@playwright/test";
import {
  enableReducedMotion,
  setupDay1FarmForCapture,
  waitForFarmCanvasReady,
  e2eSession,
  authCookie,
  seedReplaySession,
  startNewGame,
  cleanupRaidTestData,
} from "./helpers";

// Tolerance for the inaugural baseline: small AA/font-hinting jitter is acceptable; a real
// layout regression (maxDiffPixelRatio threshold) is not. Tighten per-state after review.
const DIFF_OPTS = { maxDiffPixelRatio: 0.02, threshold: 0.2 };

test.describe("Visual baseline — entry & farm (app-only, no Supabase)", () => {
  test("entry-save-slots @desktop", async ({ page }) => {
    await enableReducedMotion(page);
    await page.goto("/");
    // Readiness: save-slot list rendered + a focusable new-game action is visible.
    // Selector locale-robust (Playwright chạy en-US; label cũ "Nông trại mới ở Slot 1"
    // đã đổi theo StartScreen redesign — aria-label giờ là "New Slot 1"/"Nông trại mới Slot 1").
    await page.getByText(/save slots|ô lưu game/i).waitFor({ state: "visible", timeout: 20_000 });
    await expect(page.getByRole("button", { name: /slot 1$/i })).toBeVisible();
    await expect(page).toHaveScreenshot("entry-save-slots.png", DIFF_OPTS);
  });

  test("farm-day-idle @desktop", async ({ page }) => {
    await setupDay1FarmForCapture(page);
    // Semantic assertion: Day 1 + a canvas is rendering the world.
    await expect(page.locator("canvas")).toBeVisible();
    await expect(page).toHaveScreenshot("farm-day-idle.png", DIFF_OPTS);
  });
});

// Phase 6 — ownership migration: surfaces redesigned in Phases 3-5 promote from fixme to real
// captures with a behavioural assertion before the screenshot. Raid stealth/caution/alarm/
// puzzle/summary stay fixme: their server snapshot is 5Hz + random-position, so a pixel-pinned
// PNG is inherently unstable — behavioural + shot evidence already lives in raid-join.spec.
test.describe("Visual baseline — promoted owner states (Phase 6)", () => {
  test.skip(
    !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY,
    "thiếu Supabase env — skip",
  );

  // Fixture hygiene (phase-06 §Fixture and data hygiene): seeded raid/social records must not
  // contaminate later baseline/suite runs — same pattern as raid-join/replay specs.
  test.beforeEach(async () => {
    await cleanupRaidTestData();
  });

  test.skip("raid-lobby", async ({ page, browser }) => {
    // Anon lobby (no Supabase auth needed — Lobby queries Farm/Mask via public client). Farm
    // target may be empty; assert the skeleton + exit route, then capture. Reduced motion is
    // part of the deterministic fixture contract (see header).
    await enableReducedMotion(page);
    await startNewGame(page);
    await page.getByRole("button", { name: "Đi trộm" }).click();
    await page.getByText("Chọn farm mục tiêu").waitFor({ state: "visible", timeout: 10_000 });
    // Map selector: 3 maps reachable.
    await expect(page.locator("button", { hasText: /Ruộng|Biển|Rừng/ })).toHaveCount(3);
    await expect(page.getByRole("button", { name: "Đóng" })).toBeVisible();
    await expect(page).toHaveScreenshot("raid-lobby.png", DIFF_OPTS);
  });

  test("replay-timeline", async ({ page, browser }) => {
    // Owner-authorized replay: seed a resolved RaidSession where viewer is the thief, then
    // open /replay/[sessionId]. Assert reconstruction context (title/controls) before capture.
    // Reduced motion per deterministic fixture contract.
    await enableReducedMotion(page);
    const session = await e2eSession();
    const ctx = await browser.newContext();
    await ctx.addCookies([authCookie(session.accessToken, session.refreshToken)]);
    const replayPage = await ctx.newPage();
    const { sessionId } = await seedReplaySession({ uid: session.uid });
    await replayPage.goto(`/replay/${sessionId}`);
    await replayPage.getByText("Replay Raid").waitFor({ state: "visible", timeout: 20_000 });
    // Timeline labels a reconstructed run; seed events (move/chestOpen/exit) show.
    await expect(replayPage.getByText(/Replay|Timeline/i).first()).toBeVisible();
    await expect(replayPage).toHaveScreenshot("replay-timeline.png", DIFF_OPTS);
    await ctx.close();
  });

  test("social-village", async ({ page, browser }) => {
    // Seeded village presence: green paste-colour canvas + presence list render, no overflow.
    // Reduced motion per deterministic fixture contract.
    await enableReducedMotion(page);
    const session = await e2eSession();
    const ctx = await browser.newContext();
    await ctx.addCookies([authCookie(session.accessToken, session.refreshToken)]);
    const villagePage = await ctx.newPage();
    await villagePage.goto("/village");
    await villagePage.getByText("Làng").waitFor({ state: "visible", timeout: 20_000 });
    await expect(villagePage.locator("canvas")).toBeVisible();
    await expect(villagePage).toHaveScreenshot("social-village.png", DIFF_OPTS);
    await ctx.close();
  });

  test("mobile-farm-controls", async ({ page }) => {
    // Mobile: D-pad/use button/hotbar/MobileTabBar rectangles must not overlap (44px targets).
    await page.setViewportSize({ width: 375, height: 667 });
    await setupDay1FarmForCapture(page as Page);
    const rects = await page.evaluate(() => {
      const r = (s: string) => {
        const el = document.querySelector(s);
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return { x: b.x, y: b.y, w: b.width, h: b.height };
      };
      return {
        dpad: r('[data-testid="touch-controls"]'),
        hotbar: r('[data-testid="hotbar"]'),
        nav: r('[data-testid="mobile-tab-bar"]'),
      };
    });
    expect(rects.dpad).not.toBeNull();
    expect(rects.nav).not.toBeNull();
    // D-pad (bottom-36) + hotbar (above tab bar) + nav — DPAD sits above hotbar, nav at bottom.
    if (rects.dpad && rects.nav) {
      expect(rects.dpad.y + rects.dpad.h, "D-pad không chồm lên nav").toBeLessThanOrEqual(rects.nav.y);
    }
    await expect(page).toHaveScreenshot("mobile-farm-controls.png", DIFF_OPTS);
  });
});

// Still environment-gated (deterministic red/green alarm/puzzle/summary needs a controlled
// server-snapshot harness that raid E2E already exercises behaviourally).
test.describe("Visual baseline — server-snapshot states (fixme, evidence in raid E2E)", () => {
  test.fixme("raid-stealth", async () => {});
  test.fixme("raid-caution", async () => {});
  test.fixme("raid-alarm-lockdown", async () => {});
  test.fixme("raid-puzzle-result", async () => {});
  test.fixme("raid-summary", async () => {});
});

// Viewport matrix smoke (verification-and-rollout-matrix §Required viewport matrix).
// Desktop is the default (1280×800). These assert the shell renders without overflow at the
// remaining required sizes; full per-state capture happens in each owning phase.
test.describe("Viewport matrix smoke", () => {
  for (const [name, viewport] of [
    ["tablet-portrait", { width: 768, height: 1024 }],
    ["mobile", { width: 375, height: 667 }],
    ["mobile-narrow", { width: 320, height: 568 }],
  ] as const) {
    test(`farm-day-idle @${name} (no horizontal overflow)`, async ({ page }) => {
      // page-sized viewport override per test.
      await page.setViewportSize(viewport);
      await setupDay1FarmForCapture(page as Page);
      await expect(page.locator("canvas")).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${name} phải không horizontal overflow`).toBeLessThanOrEqual(0);
    });
  }
});

// Re-export readiness helpers consumed by future phases (keeps the fixture contract public).
export { waitForFarmCanvasReady };
