import { test, expect } from "@playwright/test";
import { startNewGame, shot } from "./helpers";

/**
 * E2E — Raid lobby UI (phase 4 F4.x): KHÔNG join thật (tránh seed/rate-limit).
 * Mở qua FeatureBar "Đi trộm" (🎭) → verify:
 * - Lobby overlay hiện (title, map selector, mask gate)
 * - Chọn map đổi highlight
 * - Đóng lobby (✕ / Escape) trở về game
 *
 * Lobby query Farm + Mask qua supabase client (không RLS) → anon OK.
 * Farm target có thể rỗng nếu không có dữ liệu — test verify UI skeleton
 * (title/map/gate), không cần farm rows.
 */

test.describe.skip("Raid lobby UI", () => {
  test("mở lobby → map selector + mask gate → đóng", async ({ page }) => {
    await startNewGame(page);

    // Mở raid lobby qua FeatureBar (aria-label "Đi trộm")
    await page.getByRole("button", { name: "Đi trộm" }).click();
    await page.getByText("Chọn farm mục tiêu").waitFor({ state: "visible", timeout: 10_000 });
    await shot(page, "30-raid-lobby");

    // Map selector — 3 map buttons hiện
    const mapButtons = page.locator("button", { hasText: /Ruộng|Biển|Rừng/ });
    await expect(mapButtons).toHaveCount(3);

    // Mặc định "Ruộng" active (class có var(--mystic))
    await expect(
      page.locator("button", { hasText: "Ruộng" }).first(),
    ).toHaveClass(/mystic/);

    // Chọn "Biển" → highlight đổi
    await page.locator("button", { hasText: "Biển" }).first().click();
    await expect(page.locator("button", { hasText: "Biển" }).first()).toHaveClass(/mystic/);
    await shot(page, "31-raid-lobby-map-selected");

    // Mask gate: hoặc "Cần mặt nạ" (nếu anon chưa có mask) hoặc farm list rỗng
    // — cả 2 đều là trạng thái hợp lệ. Đợi hết loading.
    const loading = page.getByText("Đang tải…");
    if (await loading.isVisible().catch(() => false)) {
      await page.waitForFunction(() => {
        return !document.body.innerText.includes("Đang tải…");
      }, undefined, { timeout: 15_000 });
    }
    // Sau loading: gate text hoặc empty farm state
    const maskGate = page.getByText("Cần mặt nạ", { exact: false });
    const emptyFarm = page.getByText("Không có farm mục tiêu", { exact: false });
    const anyState = maskGate.or(emptyFarm);
    await anyState.first().waitFor({ state: "visible", timeout: 15_000 });
    await shot(page, "32-raid-lobby-state");

    // Đóng lobby — close button (aria-label "Đóng")
    await page.getByRole("button", { name: "Đóng" }).click();
    await page.getByText("Chọn farm mục tiêu").waitFor({ state: "hidden", timeout: 10_000 });
    await shot(page, "33-raid-lobby-closed");
  });
});
