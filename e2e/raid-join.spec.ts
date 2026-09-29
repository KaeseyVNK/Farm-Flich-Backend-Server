import { test, expect } from "@playwright/test";
import {
  startNewGame,
  shot,
  authCookie,
  accessTokenCookie,
  e2eSession,
  seedRaidTargetFarm,
  seedMaskForUser,
  cleanupRaidTestData,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
} from "./helpers";

/**
 * E2E — Raid join THẬT (phase 4): seed farm target + mask → join qua UI → verify active raid → exit.
 *
 * Cần:
 * - Dev server NEXT_PUBLIC_E2E=1 (bridge) + raid-server port 3001.
 * - Supabase service role để seed.
 *
 * Lưu ý WS auth: raid-server đọc cookie `sb-access-token` (JWT raw). Browser gửi cookie
 * domain localhost tới mọi port (3000 + 3001). Ta set cả 2 cookies:
 *   - `sb-<ref>-auth-token` (web @supabase/ssr)
 *   - `sb-access-token` (raid-server WS)
 */

test.describe.skip("Raid join thật", () => {
  // Seed Supabase thật (createUser + farm + session) — khi chạy full suite contention
  // làm seed chậm; riêng ~1m, full suite có thể 3m+. 300s để tránh flaky timeout.
  test.setTimeout(300_000);
  test.skip(
    !SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY,
    "thiếu Supabase env — skip",
  );

  test("seed target → join raid → active snapshot → exit", async ({ browser }) => {
    // Cleanup farm cũ của các lần chạy trước (tránh lobby tích lũy làm chậm presence check)
    await cleanupRaidTestData();

    // ---- Seed: thief session + mask + target farm ----
    const thief = await e2eSession();
    await seedMaskForUser(thief.uid, "rogue", 10);
    const { farmId } = await seedRaidTargetFarm();

    // ---- Browser với auth cookie + sb-access-token ----
    const ctx = await browser.newContext();
    await ctx.addCookies([
      authCookie(thief.accessToken, thief.refreshToken),
      accessTokenCookie(thief.accessToken),
    ]);
    const page = await ctx.newPage();
    page.on("console", (msg) => {
      if (msg.type() === "error" || msg.text().toLowerCase().includes("raid") || msg.text().toLowerCase().includes("websocket")) {
        console.log("[page console]", msg.type(), msg.text());
      }
    });
    page.on("websocket", (ws) => {
      console.log("[ws] url:", ws.url());
      ws.on("close", () => console.log("[ws] closed"));
      ws.on("socketerror", (e) => console.log("[ws] socketerror:", e));
    });

    // Vào game (StartScreen → New game Slot 1)
    await startNewGame(page);
    await shot(page, "50-raid-join-new-farm");

    // Mở raid lobby
    await page.getByRole("button", { name: "Đi trộm" }).click();
    await page.getByText("Chọn farm mục tiêu").waitFor({ state: "visible", timeout: 10_000 });

    // Farm target hiện trong lobby (seed farm có shield expired + mask OK)
    await page.getByText(/Farm raid-owner/).waitFor({ state: "visible", timeout: 20_000 });
    await shot(page, "51-raid-join-lobby-target");

    // Click join farm → WS connect → raid active (RaidHud hiện "ĐỘT NHẬP")
    await page.getByText(/Farm raid-owner/).click();
    await page.getByText("ĐỘT NHẬP", { exact: false }).waitFor({ state: "visible", timeout: 20_000 });
    await shot(page, "52-raid-active");

    // Verify HUD: LOOT + THOÁT + alert stealth
    await page.getByText("LOOT", { exact: true }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: /THOÁT/ }).waitFor({ state: "visible" });
    await page.getByText("Stealth", { exact: true }).first().waitFor({ state: "visible" });
    await shot(page, "53-raid-active-hud");

    // Exit raid qua HUD button 🚪 THOÁT
    await page.getByRole("button", { name: /THOÁT/ }).click();
    // Sau exit: raid-end → RaidSummary (title + nút "Về farm"). Finalize network có thể chậm.
    await page
      .getByRole("button", { name: "Về farm" })
      .waitFor({ state: "visible", timeout: 40_000 });
    await page.getByText("Thoát thành công", { exact: true }).waitFor({ state: "visible", timeout: 5_000 });
    await shot(page, "54-raid-exit-summary");

    // Đóng summary → về game
    await page.getByRole("button", { name: "Về farm" }).click();
    await ctx.close();
  });

  test("mobile: touch controls gửi move/exit intent khi raid active", async ({ browser }) => {
    // Phase 5 §Mobile raid control — D-pad/interact/exit 44px+ reachable, gửi đúng
    // ClientMsg đã có (move/exit), không simulate. Server vẫn authority.
    await cleanupRaidTestData();
    const thief = await e2eSession();
    await seedMaskForUser(thief.uid, "rogue", 10);
    await seedRaidTargetFarm();

    // hasTouch bắt buộc — tap() cần touch device, viewport không đủ.
    const ctx = await browser.newContext({
      viewport: { width: 375, height: 667 },
      hasTouch: true,
      isMobile: true,
    });
    await ctx.addCookies([
      authCookie(thief.accessToken, thief.refreshToken),
      accessTokenCookie(thief.accessToken),
    ]);
    const page = await ctx.newPage();

    // Capture WS framesent — chứng minh tap D-pad gửi move intent thật.
    let sentMove = false;
    page.on("websocket", (ws) => {
      if (!ws.url().includes("/raid")) return;
      ws.on("framesent", (f) => {
        try {
          const m = JSON.parse(f.payload as string);
          if (m.t === "move") sentMove = true;
        } catch {
          /* ignore */
        }
      });
    });

    await startNewGame(page);
    // Mobile: raid nằm trong More sheet (registry mobilePlacement: "more").
    await page.getByRole("button", { name: "More" }).click();
    await page.getByRole("button", { name: "Đi trộm" }).click();
    await page.getByText("Chọn farm mục tiêu").waitFor({ state: "visible", timeout: 10_000 });
    await page.getByText(/Farm raid-owner/).waitFor({ state: "visible", timeout: 20_000 });
    await page.getByRole("button", { name: /Farm raid-owner/ }).click();
    await page.getByText("ĐỘT NHẬP", { exact: false }).waitFor({ state: "visible", timeout: 20_000 });

    // Touch controls hiện khi active (D-pad 44px+). Farm D-pad (Phaser canvas) cũng
    // có "Đi lên" → scope theo container raid-touch (aria-label duy nhất).
    const raidTouch = page.locator('[data-testid="raid-touch-controls"]');
    const upBtn = raidTouch.getByRole("button", { name: "Đi lên" });
    await upBtn.waitFor({ state: "visible", timeout: 5_000 });
    await raidTouch.getByRole("button", { name: "Mở rương gần nhất" }).waitFor({ state: "visible" });
    await raidTouch.getByRole("button", { name: "Thoát raid" }).waitFor({ state: "visible" });

    // Tap D-pad → move intent gửi lên WS server.
    await upBtn.tap();
    await expect
      .poll(async () => sentMove, { timeout: 5_000, message: "tap D-pad phải gửi move intent" })
      .toBe(true);
    await shot(page, "55-raid-touch-controls");

    // Tap thoát → raid-end → summary (intent exit hợp lệ).
    await page.getByRole("button", { name: "Thoát raid" }).tap();
    await page.getByRole("button", { name: "Về farm" }).waitFor({ state: "visible", timeout: 40_000 });
    await ctx.close();
  });
});
