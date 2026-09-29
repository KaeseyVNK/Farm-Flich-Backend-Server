// Wave 6 P5 — e2e mount end-to-end.
// 1) Shop UI thật: addGold + addXp (e2e) → tab Thú cưỡi → mua xe đạp → "Đã có".
// 2) M toggle → mounted, HUD chip; tốc: hold D 1.2s đi xa hơn đi bộ.
// 3) Warp vào house → auto-dismount. Test riêng: cầm cuốc Space → dismount.
// Evaluate bodies self-contained — KHÔNG closure module fn (không serialize).
import { test, expect, type Page } from "@playwright/test";
import { startNewGame, shot } from "./helpers";

interface Bridge {
  actions: {
    teleport: (x: number, y: number) => void;
    addGold: (amount: number) => void;
    addXp: (amount: number) => void;
    giveMount: (mountId: string) => boolean;
  };
  state: {
    mounts: () => { owned: string[]; active: string | null; mounted: boolean };
    inv: () => { slots: ({ itemId: string; qty: number } | null)[] };
  };
  engine: () => { getPlayerTile?: () => { x: number; y: number } };
}

/** Tile x của player (tile granularity — đủ phân biệt tốc 1.25×). */
async function playerTileX(page: Page): Promise<number> {
  return page.evaluate(() => {
    const w = window as unknown as { __gameTest: Bridge };
    return w.__gameTest.engine().getPlayerTile?.().x ?? -1;
  });
}

async function mountState(page: Page) {
  return page.evaluate(() => {
    const w = window as unknown as { __gameTest: Bridge };
    return w.__gameTest.state.mounts();
  });
}

/** Giữ D đúng durationMs rồi trả tile x. */
async function runRight(page: Page, durationMs: number): Promise<number> {
  await page.keyboard.down("d");
  await page.waitForTimeout(durationMs);
  await page.keyboard.up("d");
  await page.waitForTimeout(250);
  return playerTileX(page);
}

/** Chọn slot trống đầu (không cầm tool — canMount gate holdingTool). */
async function selectEmptySlot(page: Page): Promise<void> {
  const idx = await page.evaluate(() => {
    const w = window as unknown as { __gameTest: Bridge };
    return w.__gameTest.state.inv().slots.findIndex((s) => s === null);
  });
  expect(idx).toBeGreaterThanOrEqual(0);
  const key = idx < 9 ? String(idx + 1) : idx === 9 ? "0" : idx === 10 ? "-" : "=";
  await page.keyboard.press(key);
}

async function openShop(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Mở menu nông trại" }).click();
  await page.getByRole("button", { name: "Cửa hàng" }).click();
  await expect(page.getByTestId("shop-mounts").or(page.getByRole("button", { name: "Mua hạt giống" }))).toBeVisible({
    timeout: 8000,
  });
}

test.describe("mount (W6)", () => {
  test("shop mua xe → M lên → nhanh hơn → vào nhà tự xuống", async ({ page }) => {
    test.setTimeout(120_000);
    await startNewGame(page);

    // Level 2 + đủ vàng cho bicycle 800g (lv2 cần ~vài chục xp).
    await page.evaluate(() => {
      const w = window as unknown as { __gameTest: Bridge };
      w.__gameTest.actions.addGold(1000);
      for (let i = 0; i < 6; i++) w.__gameTest.actions.addXp(60);
    });

    await openShop(page);
    await page.getByRole("button", { name: "Thú cưỡi" }).click();
    await expect(page.getByTestId("shop-mounts")).toBeVisible({ timeout: 6000 });
    await shot(page, "60-mount-shop");
    await page.getByRole("button", { name: "Mua", exact: true }).click();
    await expect(page.getByText("Đã có").first()).toBeVisible({ timeout: 4000 });
    await page.keyboard.press("Escape"); // đóng shop
    await page.waitForTimeout(500);

    // Baseline đi bộ: teleport (10,22) — hàng cỏ trống, giữ D 1.2s.
    await page.evaluate(() => {
      const w = window as unknown as { __gameTest: Bridge };
      w.__gameTest.actions.teleport(10, 22);
    });
    await page.waitForTimeout(300);
    const offX = await runRight(page, 1200);

    // M lên xe — đo lại cùng quãng từ cùng tile.
    await page.evaluate(() => {
      const w = window as unknown as { __gameTest: Bridge };
      w.__gameTest.actions.teleport(10, 22);
    });
    await page.waitForTimeout(300);
    await selectEmptySlot(page); // không cầm tool — canMount gate
    await page.keyboard.press("n");
    await page.waitForTimeout(300);
    expect((await mountState(page)).mounted).toBe(true);
    await expect(page.getByTestId("hud-mount")).toBeVisible();
    await shot(page, "61-mount-riding");
    const onX = await runRight(page, 1200);
    // 1.25× tốc cùng thời gian — mounted xa hơn ít nhất 1 tile (tile granularity).
    expect(onX).toBeGreaterThan(offX);

    // Về vị trí cửa nhà (12,11) → giữ W lên vào house → auto-dismount. [relayout]
    await page.evaluate(() => {
      const w = window as unknown as { __gameTest: Bridge };
      w.__gameTest.actions.teleport(12, 11);
    });
    await page.keyboard.down("w");
    await page.waitForTimeout(700);
    await page.keyboard.up("w");
    await page.waitForTimeout(600);
    expect((await mountState(page)).mounted).toBe(false);
    await shot(page, "62-mount-house-dismount");
  });

  test("cầm cuốc Space khi mounted → xuống ngựa", async ({ page }) => {
    test.setTimeout(60_000);
    await startNewGame(page);
    await page.evaluate(() => {
      const w = window as unknown as { __gameTest: Bridge };
      w.__gameTest.actions.addXp(300); // lv2 đủ bicycle (giveMount bypass gold)
      w.__gameTest.actions.giveMount("bicycle");
      w.__gameTest.actions.teleport(10, 22);
    });
    await page.waitForTimeout(300);
    await selectEmptySlot(page);
    await page.keyboard.press("n");
    await page.waitForTimeout(300);
    expect(await mountState(page)).toMatchObject({ mounted: true, active: "bicycle" });

    const hoeIdx = await page.evaluate(() => {
      const w = window as unknown as { __gameTest: Bridge };
      return w.__gameTest.state.inv().slots.findIndex((s) => s?.itemId === "hoe");
    });
    expect(hoeIdx).toBeGreaterThanOrEqual(0);
    const key = hoeIdx < 9 ? String(hoeIdx + 1) : hoeIdx === 9 ? "0" : hoeIdx === 10 ? "-" : "=";
    await page.keyboard.press(key);
    await page.keyboard.press("Space");
    await page.waitForTimeout(300);
    expect((await mountState(page)).mounted).toBe(false);
    await shot(page, "63-mount-tool-dismount");
  });
});
