import { test, expect } from "@playwright/test";
import {
  shot,
  authCookie,
  e2eUserWithSession,
  seedReplaySession,
  cleanupRaidTestData,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
} from "./helpers";

/**
 * E2E — Replay viewer (phase 9 F9.7): seed session resolved + events →
 * xem /replay/<sessionId> như thief (authz cho phép) → verify timeline.
 *
 * Cần Supabase service role (seed). Viewer = user e2e mới (thief của session).
 */

test.describe("Replay viewer", () => {
  test.skip(
    !SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY,
    "thiếu Supabase env — skip",
  );

  test("seed session → view replay timeline → events hiển thị", async ({ browser }) => {
    test.setTimeout(300_000); // seed Supabase thật (createUser + session + events) chậm khi chạy full suite
    // Cleanup session/farm cũ (tránh lobby tích lũy ở các spec khác)
    await cleanupRaidTestData();

    // Viewer user (thief) — tạo session trước
    const viewer = await e2eUserWithSession("replay-viewer");

    // Seed RaidSession + events với viewer là thief
    const { sessionId } = await seedReplaySession({ uid: viewer.uid });

    // Browser với cookie viewer
    const ctx = await browser.newContext();
    await ctx.addCookies([authCookie(viewer.accessToken, viewer.refreshToken)]);
    const page = await ctx.newPage();

    // Xem replay
    await page.goto(`/replay/${sessionId}`);
    await page.getByText("Replay Raid").waitFor({ state: "visible", timeout: 20_000 });
    await shot(page, "60-replay-header");

    // Timeline hiện + events (move/chestOpen/exit)
    await page.getByText("Timeline raid", { exact: true }).waitFor({ state: "visible" });
    await page.getByText("Mở rương", { exact: true }).waitFor({ state: "visible" });
    await page.getByText("Di chuyển", { exact: true }).first().waitFor({ state: "visible" });
    await shot(page, "61-replay-timeline");

    // Kết thúc: exit
    await page.getByText("Thoát", { exact: true }).first().waitFor({ state: "visible" });
    await shot(page, "62-replay-end");
    await ctx.close();
  });
});
