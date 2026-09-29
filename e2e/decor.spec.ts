// Wave 3 P5 — e2e trang trí end-to-end.
// 1) Mua: mở panel Trang trí qua FeatureBar dock → tab Mua → mua Hàng Rào Gỗ
//    (80g, lv1) → gold trừ đúng, kho hiện món.
// 2) Sắp đặt: Đặt từ kho → decor mode overlay + cursor → dịch cursor (D) →
//    Space đặt (placedDecor 1, còn 1 → mode ở lại) → X nhặt (placedDecor 0,
//    owned trả 1) → Esc thoát.
import { test, expect, type Page } from "@playwright/test";
import { startNewGame, readGameState, shot } from "./helpers";

async function gold(page: Page): Promise<number> {
  const st = await readGameState(page);
  return (st.game as { gold: number }).gold;
}

async function placedCount(page: Page): Promise<number> {
  const st = await readGameState(page);
  const farm = st.farm as { placedDecor: unknown[] };
  return farm.placedDecor.length;
}

async function ownedCount(page: Page, defId: string): Promise<number> {
  const st = await readGameState(page);
  const farm = st.farm as { decorOwned: Record<string, number> };
  return farm.decorOwned[defId] ?? 0;
}

async function teleport(page: Page, x: number, y: number): Promise<void> {
  await page.evaluate(
    ([tx, ty]) => {
      (window as unknown as {
        __gameTest: { actions: { teleport: (a: number, b: number) => void } };
      }).__gameTest.actions.teleport(tx, ty);
    },
    [x, y],
  );
}

async function openDecorPanel(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Mở menu nông trại" }).click();
  await page.getByRole("button", { name: "Trang trí" }).click();
  // dock menu expanded đè góc trái panel — thu lại trước khi click trong panel
  await page.getByRole("button", { name: "Đóng menu nông trại" }).click();
  await expect(page.getByTestId("decor-tab-shop")).toBeVisible({ timeout: 8000 });
}

test.describe("decor (W3)", () => {
  test("mua decor qua panel — trừ vàng, vào kho", async ({ page }) => {
    await startNewGame(page);
    await openDecorPanel(page);
    const shopTab = page.getByTestId("decor-tab-shop");
    await shopTab.click();
    await shot(page, "54-decor-shop");
    const g0 = await gold(page);
    await page.getByTestId("decor-buy-fence_wood").click();
    await expect.poll(() => ownedCount(page, "fence_wood"), { timeout: 6000 }).toBe(1);
    expect(await gold(page)).toBe(g0 - 80);
    // kho tab hiện món
    await page.getByTestId("decor-tab-owned").click();
    await expect(page.getByTestId("decor-place-fence_wood")).toBeVisible();
    await shot(page, "55-decor-owned");
  });

  test("đặt + nhặt decor qua decor mode", async ({ page }) => {
    await startNewGame(page);
    // mua 2 hàng rào (đặt 1 còn 1 → mode KHÔNG tự thoát, test nhặt tiếp)
    await openDecorPanel(page);
    await page.getByTestId("decor-tab-shop").click();
    await page.getByTestId("decor-buy-fence_wood").click();
    await page.getByTestId("decor-buy-fence_wood").click();
    await expect.poll(() => ownedCount(page, "fence_wood"), { timeout: 6000 }).toBe(2);
    // vào kho → Đặt → decor mode bật tại tile người chơi. Player spawn gần nhà
    // (tile quanh đó là path/scenery — không đặt được) → teleport ra đồng trống.
    await teleport(page, 30, 30);
    await page.getByTestId("decor-tab-owned").click();
    await page.getByTestId("decor-place-fence_wood").click();
    const overlay = page.getByTestId("decor-overlay");
    await expect(overlay).toBeVisible({ timeout: 8000 });
    // dịch cursor 1 tile phải + 1 tile lên (tránh đặt đè chân player)
    await page.keyboard.press("d");
    await page.keyboard.press("w");
    await shot(page, "56-decor-mode-cursor");
    await page.keyboard.press("Space");
    await expect.poll(() => placedCount(page), { timeout: 6000 }).toBe(1);
    // còn 1 → mode ở lại; cursor vẫn ở tile vừa đặt → X nhặt trả kho
    await expect(overlay).toBeVisible();
    await page.keyboard.press("x");
    await expect.poll(() => placedCount(page), { timeout: 6000 }).toBe(0);
    await expect.poll(() => ownedCount(page, "fence_wood"), { timeout: 6000 }).toBe(2);
    await shot(page, "57-decor-picked");
    await page.keyboard.press("Escape");
    await expect(overlay).not.toBeVisible({ timeout: 4000 });
  });
});
