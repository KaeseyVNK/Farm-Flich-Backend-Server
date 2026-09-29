import { test, expect } from "@playwright/test";
import { shot } from "./helpers";

/**
 * E2E — Social smoke (phase 6-8): /market, /market/my, /masks, /friends.
 * UI smoke — KHÔNG seed, KHÔNG mutate dữ liệu production.
 *
 * Các page này cần auth user (server actions requireUserId).
 * Dùng e2e user qua cookie sb-<ref>-auth-token (helper authCookie).
 * Anon không có User row → server action throw → page hiện msg lỗi.
 * Với cookie auth user: page render đúng + action mới chạy được.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Re-export auth helpers from helpers.ts (authCookie, e2eSession)
import { authCookie, e2eSession } from "./helpers";

test.describe("Social pages smoke", () => {
  test.skip(
    !SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY,
    "thiếu Supabase env — skip",
  );

  test("market page — browse + form render", async ({ browser }) => {
    const session = await e2eSession();
    const ctx = await browser.newContext();
    await ctx.addCookies([authCookie(session.accessToken, session.refreshToken)]);
    const page = await ctx.newPage();

    await page.goto("/market");
    await page.getByText("Chợ", { exact: true }).waitFor({ state: "visible", timeout: 15_000 });
    // Đăng bán form hiện
    await page.getByText("Đăng bán").waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Đăng", exact: true }).waitFor({ state: "visible" });
    // Listing grid render (có thể rỗng) — không assert dữ liệu
    await page.getByText("Tin đăng của tôi").waitFor({ state: "visible" });
    await shot(page, "40-market");
    await ctx.close();
  });

  test("market/my page — my listings render", async ({ browser }) => {
    const session = await e2eSession();
    const ctx = await browser.newContext();
    await ctx.addCookies([authCookie(session.accessToken, session.refreshToken)]);
    const page = await ctx.newPage();

    await page.goto("/market/my");
    await page.getByText("Tin đăng của tôi").waitFor({ state: "visible", timeout: 15_000 });
    // Chờ render xong: hoặc empty state hoặc listing rows
    await page
      .getByText("Chưa có tin đăng.", { exact: false })
      .waitFor({ state: "visible", timeout: 5_000 })
      .catch(() => {});
    await shot(page, "41-market-my");
    await ctx.close();
  });

  test("masks page — catalog render", async ({ browser }) => {
    const session = await e2eSession();
    const ctx = await browser.newContext();
    await ctx.addCookies([authCookie(session.accessToken, session.refreshToken)]);
    const page = await ctx.newPage();

    await page.goto("/masks");
    await page.getByText("Mặt nạ", { exact: true }).waitFor({ state: "visible", timeout: 15_000 });
    // Ít nhất 1 mask trong catalog hiện
    const maskCards = page.locator("main > div > div");
    const count = await maskCards.count();
    expect(count).toBeGreaterThan(0);
    await shot(page, "42-masks");
    await ctx.close();
  });

  test("friends page — list + form render", async ({ browser }) => {
    const session = await e2eSession();
    const ctx = await browser.newContext();
    await ctx.addCookies([
      authCookie(session.accessToken, session.refreshToken),
      // Ghim locale vi — Accept-Language en-US mặc định render " Friends".
      { name: "hh-locale", value: "vi", domain: "localhost", path: "/" },
    ]);
    const page = await ctx.newPage();

    await page.goto("/friends");
    await page.getByText("Bạn bè", { exact: true }).waitFor({ state: "visible", timeout: 15_000 });
    await page.getByPlaceholder("User ID để kết bạn").waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Kết bạn", exact: true }).waitFor({ state: "visible" });
    // List friends render (empty OK)
    await page.getByText("Danh sách", { exact: false }).waitFor({ state: "visible" });
    await shot(page, "43-friends");
    await ctx.close();
  });
});
