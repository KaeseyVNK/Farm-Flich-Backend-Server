// Wave 8 P5 — e2e festival end-to-end (§2/§14).
// 1) Ngày lễ chính 13 Spring: vào village — overlay festival render trên canvas
//    (gallery cho human gate visual), về farm không crash.
// 2) Host NPC (alaric) dialogue có nút 🎉 → mở FestivalPanel.
// 3) Contest: đặt 23 flower_sign (fancy 9đ) = 207 ≥ 200 GOLD → claim +800g +
//    trophy_contest vào kho + event decor mùa xuân + key chốt "Đã nhận".
// 4) Cookoff nộp parsnip_soup +20đ (tier1 không buff) + derby 0đ claim chặn +
//    puzzle booth mở PuzzleModal.
// Overlay pixel-diff là human gate — spec chỉ verify wiring không-crash + UI flow.
import { test, expect, type Page } from "@playwright/test";
import { startNewGame, readGameState, shot } from "./helpers";

async function teleport(page: Page, x: number, y: number): Promise<void> {
  await page.evaluate(
    ([tx, ty]) => {
      (window as unknown as { __gameTest: { actions: { teleport: (a: number, b: number) => void } } }).__gameTest.actions.teleport(tx, ty);
    },
    [x, y],
  );
}

async function giveItem(page: Page, itemId: string, qty: number): Promise<void> {
  await page.evaluate(
    ([id, n]) => {
      (window as unknown as { __gameTest: { actions: { giveItem: (a: string, b: number) => number } } }).__gameTest.actions.giveItem(id as string, n as number);
    },
    [itemId, qty],
  );
}

/** Set ngày lễ qua bridge (W8 setDate) — deterministic, không endDay 12 lần. */
async function setFestivalDay(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as {
      __gameTest: { actions: { setDate: (y: number, s: "Spring" | "Summer" | "Fall" | "Winter", d: number) => void } };
    }).__gameTest.actions.setDate(1, "Spring", 13);
  });
}

async function enterZone(page: Page, zone: "farm" | "village"): Promise<void> {
  await page.evaluate((z) => {
    (window as unknown as { __gameTest: { state: { world: () => { enterZone: (a: "farm" | "village") => void } } } }).__gameTest.state.world().enterZone(z);
  }, zone);
  await page.waitForFunction(
    (z) =>
      (window as unknown as { __gameTest: { state: { world: () => { zone: string } } } }).__gameTest.state.world().zone === z,
    zone,
    { timeout: 10_000 },
  );
  await page.waitForTimeout(600); // FarmScene warp + scenery render settle
}

async function gold(page: Page): Promise<number> {
  const st = await readGameState(page);
  return st.game.gold as number;
}

async function ownedCount(page: Page, defId: string): Promise<number> {
  const st = await readGameState(page);
  return ((st.farm as { decorOwned: Record<string, number> }).decorOwned[defId] ?? 0);
}

test.describe("festival (W8)", () => {
  test("ngày 13 Spring — vào village overlay lễ hội render, về farm ổn", async ({ page }) => {
    await startNewGame(page);
    await setFestivalDay(page);
    await enterZone(page, "village");
    await page.waitForSelector("canvas", { timeout: 10_000 });
    await teleport(page, 20, 13); // giữa plaza — camera bám player, balloons/carts quanh đây
    await page.waitForTimeout(900); // balloons sway + carts vẽ
    await shot(page, "50-village-festival-overlay");
    // Closeup cụm balloon trên đầu player (props nhỏ ~26px trong ảnh full —
    // crop cho human gate visual rõ nét).
    const rect = await page.evaluate(() => {
      const r = document.querySelector("canvas")!.getBoundingClientRect();
      return { left: r.left, top: r.top, w: r.width, h: r.height };
    });
    const sx = rect.w / 1440;
    const sy = rect.h / 1056;
    await page.screenshot({
      path: "test-results/screenshots/50b-village-festival-balloon-closeup.png",
      clip: {
        x: Math.max(0, rect.left + 1008 * sx - 50),
        y: Math.max(0, rect.top + (624 - 120) * sy - 110),
        width: 220,
        height: 220,
      },
    });
    // Overlay không đổi collision — đi bộ 1 tile không kẹt (wiring không-crash).
    await page.keyboard.down("w");
    await page.waitForTimeout(200);
    await page.keyboard.up("w");
    await enterZone(page, "farm");
    await shot(page, "51-festival-back-to-farm");
  });

  test("host alaric — nút 🎉 trong dialogue mở FestivalPanel", async ({ page }) => {
    await startNewGame(page);
    await setFestivalDay(page);
    await enterZone(page, "village");
    await teleport(page, 10, 16); // dưới alaric (10,15) — forge door
    await page.keyboard.down("w");
    await page.waitForTimeout(150);
    await page.keyboard.up("w");
    await page.keyboard.press("Space");
    const dialogue = page.getByRole("dialog", { name: "Hội thoại" });
    await expect(dialogue).toBeVisible({ timeout: 8000 });
    await shot(page, "52-festival-host-dialogue");
    await page.getByRole("button", { name: /Lễ hội hôm nay/ }).click();
    await expect(page.getByTestId("fest-contest")).toBeVisible({ timeout: 8000 });
    await shot(page, "53-festival-panel");
  });

  test("contest — 23 flower_sign 207đ GOLD: +800g, trophy + event decor, chốt 1 lần", async ({ page }) => {
    await startNewGame(page);
    await setFestivalDay(page);
    // fancy flower_sign unlockLevel 4 — addXp cho chắc; own ×23 + đặt vùng đồng
    // trống đông nam (w2 — step x+2, 5/hàng × 5 hàng).
    await page.evaluate(() => {
      (window as unknown as { __gameTest: { actions: { addXp: (n: number) => void } } }).__gameTest.actions.addXp(4000);
    });
    const placed = await page.evaluate(() => {
      const farm = (window as unknown as {
        __gameTest: { state: { farm: () => { ownDecor: (a: string) => void; placeDecor: (a: string, b: number, c: number, d: number, e: { x: number; y: number }) => boolean } } };
      }).__gameTest.state.farm();
      let n = 0;
      for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 5 && n < 23; col++) {
          farm.ownDecor("flower_sign");
          if (farm.placeDecor("flower_sign", 30 + col * 2, 28 + row, 0, { x: 10, y: 38 })) n++;
        }
      }
      return n;
    });
    expect(placed).toBe(23);
    await page.evaluate(() => {
      (window as unknown as { __gameTest: { state: { ui: () => { openPanel: (p: string) => void } } } }).__gameTest.state.ui().openPanel("festival");
    });
    const contest = page.getByTestId("fest-contest");
    await expect(contest).toBeVisible({ timeout: 8000 });
    await expect(contest.getByText(/207/)).toBeVisible(); // 23 × 9 fancy
    const g0 = await gold(page);
    await contest.getByRole("button", { name: "Nhận" }).click();
    await expect.poll(() => gold(page), { timeout: 6000 }).toBe(g0 + 800);
    await expect.poll(() => ownedCount(page, "trophy_contest"), { timeout: 6000 }).toBeGreaterThanOrEqual(1);
    // event decor mùa xuân (gold +decor) cũng vào kho — id thật từ catalog Spring
    const st = await readGameState(page);
    const owned = (st.farm as { decorOwned: Record<string, number> }).decorOwned;
    expect(Object.keys(owned).some((id) => id.startsWith("ev_spring"))).toBe(true);
    // chốt 1 lần — nút đổi "Đã nhận", gold không đổi khi click lại
    await expect(contest.getByText("Đã nhận")).toBeVisible();
    await shot(page, "54-festival-claim-gold");
    // key quest chốt đúng ngày/mùa/hoạt động
    const quests = await page.evaluate(() => {
      return (window as unknown as { __gameTest: { state: { quests: () => { completed: Record<string, boolean> } } } }).__gameTest.state.quests().completed;
    });
    expect(quests["fest_1_Spring_13_contest"]).toBe(true);
  });

  test("cookoff nộp món +20đ, derby 0đ chặn claim, puzzle booth mở modal", async ({ page }) => {
    await startNewGame(page);
    await setFestivalDay(page);
    await giveItem(page, "parsnip_soup", 1);
    await page.evaluate(() => {
      (window as unknown as { __gameTest: { state: { ui: () => { openPanel: (p: string) => void } } } }).__gameTest.state.ui().openPanel("festival");
    });
    const cookoff = page.getByTestId("fest-cookoff");
    await expect(cookoff).toBeVisible({ timeout: 8000 });
    await cookoff.getByRole("button", { name: /Canh Củ Từ/ }).click();
    await expect(cookoff.getByText(/20/)).toBeVisible({ timeout: 6000 }); // tier1 ×20
    // derby catchLog rỗng → 0đ → claim chặn với msg nhắc ngưỡng
    const derby = page.getByTestId("fest-derby");
    await derby.getByRole("button", { name: "Nhận" }).click();
    await expect(page.getByText(/Chưa đủ điểm bronze/)).toBeVisible({ timeout: 4000 });
    // puzzle booth mở PuzzleModal (deadline countdown hiện)
    await page.getByTestId("booth-open").click();
    await expect(page.getByTestId("puzzle-deadline")).toBeVisible({ timeout: 8000 });
    await shot(page, "55-festival-puzzle-booth");
  });
});
