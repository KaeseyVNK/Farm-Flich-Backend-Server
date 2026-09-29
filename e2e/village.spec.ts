import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * E2E phase 8 F8.9/F8.10 — 2 browser join /village → presence sync + chat broadcast.
 *
 * Yêu cầu:
 * - Dev server chạy: `npm run dev` (Next :3000) + raid-server không bắt buộc cho village.
 * - Supabase project thật + env (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).
 * - `npx playwright install chromium` (1 lần).
 *
 * Run: `npm run test:e2e`
 * Test tự skip nếu thiếu env. Tạo user e2e qua admin API (service role, email_confirm=true)
 * → sign-in bằng email/password → inject cookie `sb-<project-ref>-auth-token`
 * (chuẩn @supabase/ssr — web app dùng cookie này, KHÔNG phải `sb-access-token`
 * — cái đó chỉ raid-server WS dùng).
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Base64url encode (chuẩn Supabase storage key). */
function b64url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

test.describe("Village E2E (phase 8)", () => {
  test.skip(
    !SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY,
    "thiếu Supabase env (cần service role để tạo user e2e) — skip",
  );

  let sessionA: { accessToken: string; refreshToken: string } | null = null;
  let sessionB: { accessToken: string; refreshToken: string } | null = null;

  /**
   * Tạo user e2e qua admin API (service role) → sign-in bằng email/password.
   * Không dùng signInAnonymously: Supabase auth rate-limit anonymous rất nhanh
   * khi chạy nhiều lần (debug), admin create không bị chặn.
   */
  async function e2eSession() {
    const admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@gmail.com`;
    const password = "E2e-test-123!";
    const { error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { displayName: "e2e-user" },
    });
    if (createErr) throw createErr;

    const sb = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const session = data.session;
    if (!session) throw new Error("no session");
    return {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      uid: session.user!.id,
    };
  }

  /** Cookie auth-token chuẩn @supabase/ssr — prefix `base64-` + base64url JSON. */
  function authCookie(accessToken: string, refreshToken: string) {
    const ref = (SUPABASE_URL ?? "").replace("https://", "").split(".")[0];
    const value =
      "base64-" +
      b64url(
        JSON.stringify({
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          token_type: "bearer",
        }),
      );
    return { name: `sb-${ref}-auth-token`, value, domain: "localhost", path: "/" };
  }

  async function openPage(browser: import("@playwright/test").Browser, session: { accessToken: string; refreshToken: string }) {
    const ctx = await browser.newContext();
    await ctx.addCookies([authCookie(session.accessToken, session.refreshToken)]);
    const page = await ctx.newPage();
    return { ctx, page };
  }

  test.beforeAll(async () => {
    sessionA = await e2eSession();
    sessionB = await e2eSession();
  });

  test("2 browser join /village → presence sync (F8.9)", async ({ browser }) => {
    if (!sessionA || !sessionB) throw new Error("sessions missing");

    const { ctx: ctxA, page: pageA } = await openPage(browser, sessionA);
    const { ctx: ctxB, page: pageB } = await openPage(browser, sessionB);
    await pageA.goto("/village");
    await pageB.goto("/village");
    // Chờ presence sync — cả 2 thấy nhau (ít nhất 2 li: mình + người kia).
    await expect(pageA.locator("aside ul li")).toHaveCount(2, { timeout: 15_000 });
    await expect(pageB.locator("aside ul li")).toHaveCount(2, { timeout: 15_000 });
    await ctxA.close();
    await ctxB.close();
  });

  test("chat insert → hiển thị cả 2 client (F8.10)", async ({ browser }) => {
    if (!sessionA || !sessionB) throw new Error("sessions missing");

    const { ctx: ctxA, page: pageA } = await openPage(browser, sessionA);
    const { ctx: ctxB, page: pageB } = await openPage(browser, sessionB);
    await pageA.goto("/village");
    await pageB.goto("/village");

    // Đợi getUser async + presence track (self.userId set) — send() return sớm nếu chưa set.
    await pageA.waitForTimeout(3500);

    const msg = `e2e-${Date.now()}`;
    await pageA.fill("aside input", msg);
    await pageA.getByRole("button", { name: "Gửi" }).click();

    // Chờ message hiển thị trên cả 2
    await expect(pageA.locator("aside", { hasText: msg })).toBeVisible({ timeout: 15_000 });
    await expect(pageB.locator("aside", { hasText: msg })).toBeVisible({ timeout: 15_000 });
    await ctxA.close();
    await ctxB.close();
  });
});
