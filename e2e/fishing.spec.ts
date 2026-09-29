// Wave 1 P6 — e2e câu cá end-to-end.
// KHÔNG dùng __gameTest.fishingRng (turbopack stale-chunk ghi đè bridge giữa
// evaluate — bug dev-cache, không phải app); deterministic bằng thiết kế:
// pond lv1 pool = 100% cá common → tap-only; reel path probe random tới khi
// roll trúng medium/rare; aquaculture không cần RNG.
// 1) Common tap-only: câu ao → CẮN → tap → cá vào silo.
// 2) Reel path: probe cast → reel bar hiện → hold chạy tới kết.
// 3) Aquaculture: mua fry (shop) → thả ao → 2 đêm → thu → silo +1.
import { test, expect, type Page } from "@playwright/test";
import { startNewGame, readGameState, shot } from "./helpers";

const FISH_IDS = [
  "sunfish", "perch", "carp", "chub", "bass", "pike",
  "tiger_trout", "sturgeon", "anchovy", "sardine", "red_snapper", "tuna",
];

/** Chờ hint đổi theo text contains — không blind-sleep. */
async function waitHint(page: Page, needle: string, timeout = 14000): Promise<string | null> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const t = await page.getByTestId("fishing-hint").textContent().catch(() => null);
    if (t && t.toLowerCase().includes(needle.toLowerCase())) return t;
    await page.waitForTimeout(150);
  }
  return null;
}

async function fishSiloTotal(page: Page): Promise<number> {
  const st = await readGameState(page);
  const silo = (st.farm as { silo: Record<string, number> }).silo;
  return FISH_IDS.reduce((n, id) => n + (silo[id] ?? 0), 0);
}

async function teleport(page: Page, x: number, y: number): Promise<void> {
  await page.evaluate(
    ([tx, ty]) => {
      (window as unknown as { __gameTest: { actions: { teleport: (a: number, b: number) => void } } }).__gameTest.actions.teleport(tx, ty);
    },
    [x, y],
  );
}

test.describe("fishing (W1)", () => {
  test("common tap-only — câu ao, CẮN, tap → silo +1", async ({ page }) => {
    await startNewGame(page);
    await teleport(page, 9, 20); // POND_SHORE sau relayout — pond lv1 chỉ cá common
    await page.keyboard.press("7"); // rod slot 7 (index 6)
    await page.keyboard.down("Space");
    await page.waitForTimeout(200);
    await page.keyboard.up("Space");
    await expect(page.getByTestId("fishing-hint")).toBeVisible({ timeout: 8000 });
    const bite = await waitHint(page, "NHẤN NGAY", 14000);
    expect(bite).toContain("CÁ CẮN");
    await shot(page, "40-fishing-bite");
    await page.keyboard.down("Space");
    await page.waitForTimeout(200);
    await page.keyboard.up("Space"); // tap bắt — common caught ngay
    await waitHint(page, "được", 4000);
    await expect.poll(() => fishSiloTotal(page)).toBe(1);
  });

  test("reel path — probe cast vào reel, hold Space chạy tới kết", async ({ page }) => {
    test.setTimeout(240_000); // 12 cast × wait ≤14s
    await startNewGame(page);
    await page.evaluate(() => {
      (window as unknown as { __gameTest: { actions: { addXp: (n: number) => void } } }).__gameTest.actions.addXp(4000); // level ≥4
    });
    await page.waitForTimeout(300);
    await teleport(page, 24, 16); // LAKE_SHORE sau relayout — pool có medium/rare (~30%)
    let entered = false;
    for (let attempt = 0; attempt < 12 && !entered; attempt++) {
      await page.keyboard.press("7");
      await page.keyboard.down("Space");
      await page.waitForTimeout(200);
      await page.keyboard.up("Space");
      const bite = await waitHint(page, "NHẤN NGAY", 14000);
      expect(bite, `attempt ${attempt}: phải có pha CẮN`).toBeTruthy();
      await page.keyboard.down("Space");
      await page.waitForTimeout(200);
      await page.keyboard.up("Space");
      if (
        await page
          .getByTestId("fishing-reel-bar")
          .waitFor({ state: "visible", timeout: 2500 })
          .then(() => true)
          .catch(() => false)
      ) {
        entered = true;
        break;
      }
      // Roll trúng common → đã caught; thu cần (phím di chuyển) rồi thử lại.
      await page.keyboard.press("w");
      await page.waitForTimeout(500);
    }
    expect(entered, "12 lần cast phải có ít nhất 1 lần vào reel (~30%/lần — P fail ~1.4%)").toBe(true);
    await shot(page, "41-fishing-reel");
    // Spec verify WIRING (reel UI render + hold input + session chạy tới kết);
    // physics đã unit-test kín trong reel-bar.test.
    await page.keyboard.down("Space");
    // Kết hợp lệ: "Bắt được" (bar theo cá) HOẶC "Tuột" (hold kẹt đỉnh — wiring
    // input + session chạy tới kết là điều spec verify; physics đã unit-test).
    let done: string | null = null;
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline && !done) {
      const t = await page.getByTestId("fishing-hint").textContent().catch(() => null);
      if (t && (t.includes("được") || t.includes("Tuột"))) done = t;
      else await page.waitForTimeout(150);
    }
    await page.keyboard.up("Space");
    expect(done).toBeTruthy();
    await page.waitForTimeout(800);
  });

  test("aquaculture — mua fry, thả ao, 2 đêm, thu cá vào kho", async ({ page }) => {
    test.setTimeout(180_000);
    await startNewGame(page);
    await page.evaluate(() => {
      (window as unknown as { __gameTest: { state: { ui: () => { setShowShop: (b: boolean) => void } } } }).__gameTest.state.ui().setShowShop(true);
    });
    await page.getByRole("dialog", { name: "Shop" }).waitFor({ state: "visible" });
    await page.getByText("Cá bột — nuôi trong ao").waitFor({ state: "visible" });
    await page.getByTestId("buy-fry-sunfish").click();
    await page.getByRole("button", { name: "Đóng" }).click();
    await teleport(page, 9, 20); // POND_SHORE (relayout) — facing up vào nước ao
    const st = await readGameState(page);
    const frySlot = (st.inv.slots as ({ itemId: string } | null)[]).findIndex((s) => s?.itemId === "fry_sunfish");
    expect(frySlot).toBeGreaterThanOrEqual(0);
    await page.keyboard.press(String(frySlot + 1));
    // Space GIỮ qua ≥1 frame — press (down+up cùng lúc) bị endFrame clear edge
    // trước khi update đọc → interact không chạy (flaky dưới tải CPU).
    await page.keyboard.down("Space");
    await page.waitForTimeout(200);
    await page.keyboard.up("Space"); // thả ao (fry branch quét bán kính)
    // 2 đêm → cá lớn (growDays 2). Poll day với retry-sleep — sleep đơn lẻ có thể
    // bị guard/flag nuốt (isSleeping window); lặp cho tới day 3 (tối đa 4 lần).
    for (let i = 0; i < 4; i++) {
      const d = await page.evaluate(
        () => (window as unknown as { __gameTest: { state: { game: () => { day: number } } } }).__gameTest.state.game().day,
      );
      if (d >= 3) break;
      await page.evaluate(() => {
        (window as unknown as { __gameTest: { actions: { sleep: () => void } } }).__gameTest.actions.sleep();
      });
      await page.waitForTimeout(500);
    }
    // Đi xuống tìm cửa nhà → warp về farm (cửa ở mép nam nhà).
    for (let i = 0; i < 14; i++) {
      await page.keyboard.down("s");
      await page.waitForTimeout(160);
      await page.keyboard.up("s");
      const zone = await page.evaluate(
        () => (window as unknown as { __gameTest: { state: { world: () => { zone: string } } } }).__gameTest.state.world().zone,
      );
      if (zone === "farm") break;
    }
    await expect
      .poll(
        () =>
          page.evaluate(
            () => (window as unknown as { __gameTest: { state: { world: () => { zone: string } } } }).__gameTest.state.world().zone,
          ),
        { timeout: 6000 },
      )
      .toBe("farm");
    // Thu: đứng POND_SHORE (9,20), nước ở (9,21) BÊN DƯỚI → face DOWN.
    await teleport(page, 9, 20);
    await page.keyboard.down("s");
    await page.waitForTimeout(150);
    await page.keyboard.up("s"); // facing down vào ô nước ao
    // Thu: hold-Space + retry ≤4 lần. Mỗi lần re-face down (teleport/warp có thể
    // reset facing) + poll silo sunfish.
    for (let i = 0; i < 4; i++) {
      const st0 = await readGameState(page);
      const got0 = (st0.farm as { silo: Record<string, number> }).silo.sunfish ?? 0;
      const fishLeft = (st0.farm as { pondFish?: { fishId: string; daysGrown: number }[] }).pondFish ?? [];
      console.log(`[aqua ${i}] silo.sunfish=${got0} pondFish=${JSON.stringify(fishLeft)}`);
      if (got0 >= 1) break;
      // Re-select Hoe (slot có item — selSlot0 null làm skip nhánh harvest) +
      // re-face down trước mỗi lần thu.
      await page.keyboard.press("1");
      await teleport(page, 9, 20);
      await page.keyboard.down("s");
      await page.waitForTimeout(150);
      await page.keyboard.up("s");
      await page.waitForTimeout(200); // interactCooldown 180ms hết hạn
      await page.keyboard.down("Space");
      await page.waitForTimeout(200);
      await page.keyboard.up("Space");
      await page.waitForTimeout(1000);
    }
    await expect
      .poll(
        async () => {
          const s = await readGameState(page);
          return (s.farm as { silo: Record<string, number> }).silo.sunfish ?? 0;
        },
        { timeout: 8000 },
      )
      .toBeGreaterThanOrEqual(1);
    await shot(page, "42-fishing-aqua-harvest");
  });
});
