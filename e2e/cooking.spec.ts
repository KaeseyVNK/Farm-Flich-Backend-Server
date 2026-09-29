// Wave 2 P5 — e2e nấu ăn end-to-end.
// 1) Tier1 + bếp: vào nhà, interact bếp mở modal, nấu Canh Củ Từ (parsnip×2
//    từ giveItem→silo), món vào túi; ăn món thường KHÔNG buff.
// 2) Ăn món buff (Fruit Salad giveItem) → HUD chip xp hiện.
// 3) Minigame tier2: nấu Pancake — đọc marker từ DOM, canh vào vùng xanh rồi
//    tap → result hiện, món ≥1 (perfect ×2 / sloppy vẫn 1).
import { test, expect, type Page } from "@playwright/test";
import { startNewGame, readGameState, shot } from "./helpers";

async function giveItem(page: Page, itemId: string, qty: number): Promise<void> {
  await page.evaluate(
    ([id, n]) => {
      (window as unknown as {
        __gameTest: { actions: { giveItem: (a: string, b: number) => number } };
      }).__gameTest.actions.giveItem(String(id), Number(n));
    },
    [itemId, qty],
  );
}

async function teleport(page: Page, x: number, y: number): Promise<void> {
  await page.evaluate(
    ([tx, ty]) => {
      (window as unknown as { __gameTest: { actions: { teleport: (a: number, b: number) => void } } }).__gameTest.actions.teleport(tx, ty);
    },
    [x, y],
  );
}

async function bagCount(page: Page, itemId: string): Promise<number> {
  const st = await readGameState(page);
  const slots = (st.inv as { slots: ({ itemId: string; qty: number } | null)[] }).slots;
  return slots.reduce((n, s) => (s && s.itemId === itemId ? n + s.qty : n), 0);
}

/** Vào nhà qua cửa (teleport không đổi zone — phải bước lên warp tile). */
async function enterHouse(page: Page): Promise<void> {
  await teleport(page, 12, 11); // dưới cửa nhà farm (12,10) — relayout 185505d
  await page.keyboard.down("w");
  await page.waitForTimeout(700);
  await page.keyboard.up("w");
  await page.waitForFunction(
    () =>
      (window as unknown as { __gameTest: { state: { world: () => { zone: string } } } })
        .__gameTest.state.world().zone === "house",
    { timeout: 10000 },
  );
}

/** Giữ phím hướng một nhịp để quay mặt (pattern W1 aquaculture). */
async function faceUp(page: Page): Promise<void> {
  await page.keyboard.down("w");
  await page.waitForTimeout(150);
  await page.keyboard.up("w");
}

test.describe("cooking (W2)", () => {
  test("tier1 — bếp mở modal, nấu Canh Củ Từ, ăn món thường không buff", async ({ page }) => {
    await startNewGame(page);
    await giveItem(page, "parsnip", 4); // vào túi (5 slot trống)
    await enterHouse(page);
    await teleport(page, 12, 5); // trong nhà, dưới bếp kitchenpot (12,4)
    await faceUp(page);
    await page.keyboard.down("Space");
    await page.waitForTimeout(200);
    await page.keyboard.up("Space");
    const modal = page.getByTestId("cooking-modal");
    await expect(modal).toBeVisible({ timeout: 8000 });
    await shot(page, "50-cooking-modal");
    // nấu tier1 — parsnip 4/2 đủ
    const btn = page.getByTestId("cook-ck_parsnip_soup");
    await expect(btn).toBeEnabled();
    await btn.click();
    await expect.poll(() => bagCount(page, "parsnip_soup"), { timeout: 6000 }).toBe(1);
    // đóng modal, bước khỏi bếp rồi ăn món (hướng XUỐNG sàn trống — không phải bàn/bếp)
    await page.getByTestId("cooking-close").click();
    await teleport(page, 6, 7);
    await page.keyboard.down("s");
    await page.waitForTimeout(150);
    await page.keyboard.up("s");
    const before = await bagCount(page, "parsnip_soup");
    // chọn slot chứa món rồi Space
    const st = await readGameState(page);
    const slots = (st.inv as { slots: ({ itemId: string; qty: number } | null)[] }).slots;
    const idx = slots.findIndex((s) => s && s.itemId === "parsnip_soup");
    expect(idx).toBeGreaterThanOrEqual(0);
    await page.keyboard.press(String(idx + 1));
    await page.keyboard.down("Space");
    await page.waitForTimeout(200);
    await page.keyboard.up("Space");
    await expect.poll(() => bagCount(page, "parsnip_soup"), { timeout: 6000 }).toBe(before - 1);
    // món thường không buff — chip không hiện
    await expect(page.getByTestId("hud-buff-speed")).toHaveCount(0);
    await expect(page.getByTestId("hud-buff-xp")).toHaveCount(0);
  });

  test("ăn món buff — Fruit Salad → HUD chip XP hiện", async ({ page }) => {
    await startNewGame(page);
    await giveItem(page, "fruit_salad", 1);
    await teleport(page, 12, 13); // gần spawn, facing tile (12,14) không pond/well (relayout)
    const st = await readGameState(page);
    const slots = (st.inv as { slots: ({ itemId: string; qty: number } | null)[] }).slots;
    const idx = slots.findIndex((s) => s && s.itemId === "fruit_salad");
    expect(idx).toBeGreaterThanOrEqual(0);
    await page.keyboard.press(String(idx + 1));
    await page.keyboard.down("Space");
    await page.waitForTimeout(200);
    await page.keyboard.up("Space");
    const chip = page.getByTestId("hud-buff-xp");
    await expect(chip).toBeVisible({ timeout: 6000 });
    await shot(page, "51-cooking-xp-buff-chip");
  });

  test("minigame tier2 — Pancake: canh marker vào vùng xanh, tap, món ra", async ({ page }) => {
    await startNewGame(page);
    // Pancake mở cấp 2 — addXp đủ lên lv2 (lv1→2 = 100 XP)
    await page.evaluate(() => {
      (window as unknown as { __gameTest: { actions: { addXp: (n: number) => void } } })
        .__gameTest.actions.addXp(150);
    });
    await giveItem(page, "wheat", 2);
    await giveItem(page, "egg", 1);
    await enterHouse(page);
    await teleport(page, 12, 5);
    await faceUp(page);
    await page.keyboard.down("Space");
    await page.waitForTimeout(200);
    await page.keyboard.up("Space");
    await expect(page.getByTestId("cooking-modal")).toBeVisible({ timeout: 8000 });
    await page.getByTestId("cook-ck_pancakes").click();
    const bar = page.getByTestId("cooking-bar");
    await expect(bar).toBeVisible({ timeout: 6000 });
    await shot(page, "52-cooking-minigame");
    // Poll marker (style left %) tới khi nằm trong vùng xanh (zone left/width
    // đọc từ div con đầu tiên) → tap. Retry tối đa 12s; miss cũng OK (sloppy vẫn ra món).
    const deadline = Date.now() + 12000;
    let tapped = false;
    while (Date.now() < deadline && !tapped) {
      const pos = await page.evaluate(() => {
        const bar = document.querySelector("[data-testid=cooking-bar]");
        const zone = bar?.firstElementChild as HTMLElement | undefined;
        const marker = document.querySelector("[data-testid=cooking-bar-marker]") as HTMLElement | undefined;
        if (!bar || !zone || !marker) return null;
        const left = (m: string) => parseFloat(m.replace(/[^0-9.]/g, "").slice(0, 6));
        const zoneL = zone.style.left;
        const zoneW = zone.style.width;
        const markL = marker.style.left;
        if (!zoneL || !zoneW || !markL) return null;
        return {
          zoneStart: parseFloat(zoneL) / 100,
          zoneWidth: parseFloat(zoneW) / 100,
          marker: left(markL) / 100,
        };
      });
      if (pos) {
        const center = pos.zoneStart + pos.zoneWidth / 2;
        if (Math.abs(pos.marker - center) <= pos.zoneWidth / 2) {
          await page.getByTestId("cooking-tap").click();
          tapped = true;
        }
      }
      if (!tapped) await page.waitForTimeout(60);
    }
    expect(tapped).toBe(true); // 12s luôn có lúc marker đi qua vùng
    await expect(page.getByTestId("cooking-result")).toBeVisible({ timeout: 4000 });
    await shot(page, "53-cooking-result");
    await expect.poll(() => bagCount(page, "pancakes"), { timeout: 6000 }).toBeGreaterThanOrEqual(1);
  });
});
