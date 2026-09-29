// Wave 9 P5 — e2e tutorial full-chain trên FRESH SAVE (chơi mới từ đầu).
// Mục tiêu (plan W9): người chơi mới đi hết chuỗi 14 bước quest tutorial tới
// raid đầu — productive path thật (interact/claim UI), không dùng giveItem trừ
// parsnip (rau củ farming không phải đầu ra của tutorial — e2e fixture hợp lệ).
// Tách 2 test: (1) farm-chain steps 1–5 (cuốc → ngủ), (2) progression steps
// 6–14 (câu → raid escape). Mỗi test tự startNewGame → 2 lần fresh-save path.
// Robustness: poll claim (render async), fish bite poll 150ms qua window 1.2s.
// Lưu ý: page.evaluate CHỈ trả về giá trị serialize được — đừng trả object có
// function qua boundary; mỗi action gọi evaluate riêng (pattern fishing.spec).
import { test, expect, type Page } from "@playwright/test";
import { startNewGame, readGameState, shot } from "./helpers";
import { MAP_COLS } from "../src/lib/game/constants";

async function qs(page: Page) {
  return page.evaluate(() =>
    (window as unknown as { __gameTest: { state: { quests: () => { tutorialStep: number; tutorialClaimed: string[] } } } })
      .__gameTest.state.quests(),
  );
}

/** Poll claim button xuất hiện rồi click — trả khi tutorialStep đạt expectStep. */
async function claimNext(page: Page, expectStep: number): Promise<void> {
  const claim = page.getByTestId("hud-quest-claim");
  await claim.waitFor({ state: "visible", timeout: 15_000 });
  await claim.click();
  await page.waitForFunction(
    (s) =>
      (window as unknown as { __gameTest: { state: { quests: () => { tutorialStep: number } } } })
        .__gameTest.state.quests().tutorialStep === s,
    expectStep,
    { timeout: 10_000 },
  );
}

async function doInteract(page: Page, settleMs = 400): Promise<void> {
  await page.waitForTimeout(settleMs);
  await page.evaluate(() =>
    (window as unknown as { __gameTest: { actions: { interact: () => void } } }).__gameTest.actions.interact(),
  );
  await page.waitForTimeout(settleMs);
}

async function enterFarmAt(page: Page, x: number, y: number): Promise<void> {
  await page.evaluate(([x, y]) => {
    (window as unknown as { __gameTest: { state: { world: () => { enterZone: (z: string, s: { x: number; y: number }) => void } } } })
      .__gameTest.state.world().enterZone("farm", { x, y });
  }, [x, y] as [number, number]);
  await page.waitForTimeout(400);
  await page.evaluate(([x, y]) => {
    (window as unknown as { __gameTest: { actions: { teleport: (x: number, y: number) => void } } }).__gameTest.actions.teleport(x, y);
  }, [x, y] as [number, number]);
  await page.waitForTimeout(400);
}

test("farm-chain: cuốc → trồng → tưới → 4 ngày → thu → ngủ (steps 1–5)", async ({ page }) => {
  test.setTimeout(200_000);
  await startNewGame(page);
  await shot(page, "w9-00-fresh-save");

  // ---- step 1: t_till — cuốc ô (6,28) [relayout 185505d] ----
  await enterFarmAt(page, 6, 29);
  // Face lên (9,18) — retry loop qua getFacing probe (review W9P5: hold 100ms
  // có thể không span frame nào → hoe đánh ô khoá (9,20) → assert fail).
  // KHÔNG giống kitchen loop: (9,18) là FALLOW walkable — hold 350ms KÉO player
  // lên trên (drift) → teleport lại (9,19) cho vị trí all-deterministic
  // (teleportToTile chỉ set position, KHÔNG đụng facing).
  for (let i = 0; i < 6; i++) {
    await page.keyboard.down("ArrowUp");
    await page.waitForTimeout(350);
    await page.keyboard.up("ArrowUp");
    const face = (await page.evaluate(() => {
      const w = window as unknown as { __gameTest: { engine: () => { getFacing?: () => string } } };
      return w.__gameTest.engine().getFacing?.() ?? "";
    })) ?? "";
    if (face === "up") break;
  }
  await page.evaluate(() => (window as unknown as { __gameTest: { actions: { teleport: (x: number, y: number) => void } } }).__gameTest.actions.teleport(6, 29));
  await page.waitForTimeout(150);
  await page.getByRole("button", { name: "Hoe", exact: true }).click();
  await doInteract(page);
  let st = await readGameState(page);
  expect(st.farm.terrain[28 * MAP_COLS + 6]).toBe(4); // T.TILLED (6,28)
  await claimNext(page, 1);
  expect((await qs(page)).tutorialClaimed).toContain("t_till");
  await shot(page, "w9-01-till-claimed");

  // ---- step 2: t_plant_water — trồng + tưới (9,18) ----
  await page.getByRole("button", { name: "Parsnip Seeds" }).click();
  await doInteract(page);
  await page.getByRole("button", { name: "Watering Can" }).click();
  await doInteract(page);
  st = await readGameState(page);
  const c0 = st.farm.crops[28 * MAP_COLS + 6];
  expect(c0).toBeDefined();
  expect(c0.watered).toBe(true);
  await claimNext(page, 2);
  await shot(page, "w9-02-plant-water-claimed");

  // ---- step 3: t_harvest — 4 ngày parsnip, tưới lại mỗi sáng ----
  const plantedIdx = 28 * MAP_COLS + 6;
  for (let d = 0; d < 4; d++) {
    await page.evaluate(() => (window as unknown as { __gameTest: { actions: { sleep: () => void } } }).__gameTest.actions.sleep());
    await page.waitForTimeout(250);
    await enterFarmAt(page, 6, 29);
    const s = await readGameState(page);
    const c = s.farm.crops[plantedIdx];
    if (c && c.stage < 4 && !c.dead) {
      await page.getByRole("button", { name: "Watering Can" }).click();
      await doInteract(page, 250);
    }
  }
  st = await readGameState(page);
  expect(st.game.day).toBe(5);
  expect(st.farm.crops[plantedIdx]?.stage).toBeGreaterThanOrEqual(4);
  await page.keyboard.press("="); // hand slot
  await doInteract(page);
  st = await readGameState(page);
  expect(st.farm.crops[plantedIdx]).toBeUndefined();
  expect(st.farm.silo.parsnip ?? 0).toBeGreaterThanOrEqual(1);
  await claimNext(page, 3);
  await shot(page, "w9-03-harvest-claimed");

  // ---- step 4: t_first_order — bán 1 parsnip (không cheat XP) ----
  await page.evaluate(() => (window as unknown as { __gameTest: { actions: { sellItem: (id: string, n: number) => void } } }).__gameTest.actions.sellItem("parsnip", 1));
  await page.waitForTimeout(300);
  await claimNext(page, 4);
  await shot(page, "w9-04-first-order-claimed");

  // ---- step 5: t_sleep — 1 đêm nữa (day 6) ----
  await page.evaluate(() => (window as unknown as { __gameTest: { actions: { sleep: () => void } } }).__gameTest.actions.sleep());
  await page.waitForTimeout(400);
  await claimNext(page, 5);
  await shot(page, "w9-05-sleep-claimed");
});

test("progression-chain: câu → fry → nấu → ăn → decor → visit → quái → mount → raid (steps 6–14)", async ({ page }) => {
  test.setTimeout(240_000);
  await startNewGame(page);

  // Nhảy tutorialStep lên 5 (claim 1–5). UI claim path đã verify ở test 1 —
  // test này chỉ chứng minh chain 6–14. jumpTutorial không cấp reward.
  await page.evaluate(() => (window as unknown as { __gameTest: { actions: { jumpTutorial: (s: number) => void } } }).__gameTest.actions.jumpTutorial(5));
  await page.waitForTimeout(300);
  expect((await qs(page)).tutorialStep).toBe(5);

  // ---- step 6: t_fish — câu ao pond ----
  // Determinism: lv1 pond pool = sunfish+perch (đều common — carp/chub
  // unlockLevel 2) → tap tại bite = caught NGAY, không vào reel (medium/rare
  // phải hold). Test KHÔNG addXp trước bước này — giữ lv1 (review LOW2).
  await enterFarmAt(page, 9, 20); // POND_SHORE relayout
  await page.keyboard.press("7"); // rod
  await page.waitForTimeout(200);
  // Retry cast ≤3 lần — interactCooldown/scene-remount race có thể nuốt lần đầu.
  for (let i = 0; i < 3; i++) {
    await doInteract(page, 300);
    const hintVisible = await page
      .getByTestId("fishing-hint")
      .isVisible({ timeout: 2500 })
      .catch(() => false);
    if (hintVisible) break;
    await page.evaluate(() => (window as unknown as { __gameTest: { actions: { teleport: (x: number, y: number) => void } } }).__gameTest.actions.teleport(9, 20));
    await page.waitForTimeout(200);
  }
  await expect(page.getByTestId("fishing-hint")).toBeVisible({ timeout: 8000 });
  // poll bite: MutationObserver TRONG page (mutex) — node round-trip textContent()
  // chậm ~1s trong SwiftShader → miss window bite 1.2s ("CÁ CẮN! → Tuột").
  // Observer TAP NGAY trong page khi bite — zero round-trip (window bite 1.2s,
  // node round-trip ~1s SwiftShader → miss). Gọi bridge interact trực tiếp.
  await page.evaluate(() => {
    const w = window as unknown as { __bitTap?: boolean; __biteObs?: MutationObserver };
    w.__bitTap = false;
    const obs = new MutationObserver(() => {
      const el = document.querySelector('[data-testid="fishing-hint"]');
      const t = el?.textContent ?? "";
      if (t.includes("NHẤN NGAY") || t.includes("Nhấn ngay")) {
        w.__bitTap = true;
        (window as unknown as { __gameTest: { actions: { interact: () => void } } }).__gameTest.actions.interact();
      }
    });
    w.__biteObs = obs;
    obs.observe(document.body, { subtree: true, childList: true, characterData: true });
  });
  const biteDeadline = Date.now() + 35_000;
  let tapped = false;
  while (Date.now() < biteDeadline && !tapped) {
    tapped = await page.evaluate(() => (window as unknown as { __bitTap?: boolean }).__bitTap === true);
    if (!tapped) await page.waitForTimeout(100);
  }
  // Disconnect observer (review LOW1) — tránh querySelector chạy trên mọi DOM
  // mutation của shop/cooking/decor phía sau.
  await page.evaluate(() => {
    const w = window as unknown as { __biteObs?: MutationObserver; __bitTap?: boolean };
    w.__biteObs?.disconnect();
    delete w.__biteObs;
    delete w.__bitTap;
  });
  expect(tapped, "cá phải cắn (observer tap) trong 35s").toBe(true);
  await page.waitForTimeout(1500); // chờ caught → silo + tickFish
  // Assert cá vào silo (catchFish chạy) — claim 6 ở dưới chứng minh tickFish.
  const st = await readGameState(page);
  expect(Object.values(st.farm.silo).reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(1);
  await claimNext(page, 6);
  await shot(page, "w9-06-fish-claimed");

  // ---- step 7: t_fry — mua fry sunfish + THẢ VÀO AO (tickFry ở releaseFry,
  // không phải buyFry) ----
  await page.evaluate(() => (window as unknown as { __gameTest: { state: { ui: () => { setShowShop: (b: boolean) => void } } } }).__gameTest.state.ui().setShowShop(true));
  await page.getByRole("dialog", { name: "Shop" }).waitFor({ state: "visible", timeout: 8000 });
  await page.getByTestId("buy-fry-sunfish").click();
  await page.getByRole("button", { name: "Đóng" }).click();
  await page.waitForTimeout(300);
  // Chọn slot cá bột rồi đứng cạnh ao thả (releaseFry yêu cầu vị trí pond).
  await page.evaluate(() => {
    const inv = (window as unknown as { __gameTest: { state: { inv: () => { slots: ({ itemId: string; qty: number } | null)[]; selectSlot: (i: number) => void } } } }).__gameTest.state.inv();
    const i = inv.slots.findIndex((s) => s?.itemId === "fry_sunfish");
    if (i >= 0) inv.selectSlot(i);
  });
  await enterFarmAt(page, 9, 20); // POND_SHORE relayout
  await page.waitForTimeout(300);
  await page.evaluate(() => (window as unknown as { __gameTest: { actions: { interact: () => void } } }).__gameTest.actions.interact());
  await page.waitForTimeout(500);
  await claimNext(page, 7);
  await shot(page, "w9-07-fry-claimed");

  // ---- step 8: t_cook — parsnip_soup (2 parsnip fixture — farming không thuộc
  // nhánh tutorial này; chain thật đã kiểm ở test 1) ----
  await page.evaluate(() => (window as unknown as { __gameTest: { actions: { giveItem: (id: string, q: number) => number } } }).__gameTest.actions.giveItem("parsnip", 2));
  // Đổi slot sang parsnip — nếu còn giữ slot cá bột, interact bị chặn bởi nhánh
  // releaseFry ("Đứng cạnh ao…") → bếp không mở.
  await page.evaluate(() => {
    const inv = (window as unknown as { __gameTest: { state: { inv: () => { slots: ({ itemId: string; qty: number } | null)[]; selectSlot: (i: number) => void } } } }).__gameTest.state.inv();
    const i = inv.slots.findIndex((s) => s?.itemId === "parsnip");
    if (i >= 0) inv.selectSlot(i);
  });
  await page.evaluate(() => {
    (window as unknown as { __gameTest: { state: { world: () => { enterZone: (z: string, s: { x: number; y: number }) => void } } } }).__gameTest.state.world().enterZone("house", { x: 12, y: 7 });
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => (window as unknown as { __gameTest: { actions: { teleport: (x: number, y: number) => void } } }).__gameTest.actions.teleport(12, 5)); // kitchenpot (12,4) — house layout giữ nguyên
  await page.waitForTimeout(300);
  // Face lên (12,4) — keydown GIỮ qua ≥1 frame (press = down+up cùng lúc →
  // endFrame clear edge trước khi update đọc → facing không đổi, flaky).
  for (let i = 0; i < 6; i++) {
    await page.keyboard.down("ArrowUp");
    await page.waitForTimeout(350);
    await page.keyboard.up("ArrowUp");
    const face = (await page.evaluate(() => {
      const w = window as unknown as { __gameTest: { engine: () => { getFacing?: () => string } } };
      return w.__gameTest.engine().getFacing?.() ?? "";
    })) ?? "";
    if (face === "up") break;
  }
  await page.evaluate(() => (window as unknown as { __gameTest: { actions: { interact: () => void } } }).__gameTest.actions.interact()); // bếp — bridge path (Space bị focus ăn)
  await expect(page.getByTestId("cooking-modal")).toBeVisible({ timeout: 8000 });
  await page.getByTestId("cook-ck_parsnip_soup").click();
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          (window as unknown as { __gameTest: { state: { inv: () => { slots: ({ itemId: string; qty: number } | null)[] } } } }).__gameTest.state.inv().slots.filter((s) => s?.itemId === "parsnip_soup").reduce((a, s) => a + (s?.qty ?? 0), 0),
        ),
      { timeout: 8000 },
    )
    .toBe(1);
  const cookClose = page.getByTestId("cooking-close");
  if (await page.getByTestId("cooking-modal").isVisible()) {
    await cookClose.click();
  }
  await page.waitForTimeout(300);
  await claimNext(page, 8);
  await shot(page, "w9-08-cook-claimed");

  // ---- step 9: t_eat — chọn parsnip_soup + interact ----
  await page.evaluate(() => {
    const inv = (window as unknown as { __gameTest: { state: { inv: () => { slots: ({ itemId: string; qty: number } | null)[]; selectSlot: (i: number) => void } } } }).__gameTest.state.inv();
    const i = inv.slots.findIndex((s) => s?.itemId === "parsnip_soup");
    if (i >= 0) inv.selectSlot(i);
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => (window as unknown as { __gameTest: { actions: { teleport: (x: number, y: number) => void } } }).__gameTest.actions.teleport(6, 7));
  await page.waitForTimeout(300);
  // Ăn món — held-key (review W9P5: press() down+up cùng lúc → endFrame clear
  // justPressed edge trước khi update đọc → eat no-op, flaky dưới tải CPU).
  await page.keyboard.down("Space");
  await page.waitForTimeout(200);
  await page.keyboard.up("Space");
  await page.waitForTimeout(600);
  await claimNext(page, 9);
  await shot(page, "w9-09-eat-claimed");

  // ---- step 10: t_decor — mua fence_wood + đặt ----
  // Về farm TRƯỚC: DecorPanel shop lọc theo zone (house chỉ bán decor nhà —
  // fence_wood là farm decor → không hiện → click treo).
  await enterFarmAt(page, 30, 30);
  await page.evaluate(() => (window as unknown as { __gameTest: { state: { ui: () => { openPanel: (p: string) => void } } } }).__gameTest.state.ui().openPanel("decor"));
  await page.waitForTimeout(400);
  await page.getByTestId("decor-tab-shop").click();
  await page.getByTestId("decor-buy-fence_wood").click();
  await page.getByTestId("decor-tab-owned").click();
  await page.getByTestId("decor-place-fence_wood").click();
  await page.keyboard.press("d");
  await page.keyboard.press("w");
  // Hold Space 200ms — instant press edge bị endFrame clear trước frame đọc (flaky).
  await page.keyboard.down("Space");
  await page.waitForTimeout(200);
  await page.keyboard.up("Space");
  await expect
    .poll(
      () =>
        page.evaluate(() => (window as unknown as { __gameTest: { state: { farm: () => { placedDecor: unknown[] } } } }).__gameTest.state.farm().placedDecor.length),
      { timeout: 8000 },
    )
    .toBe(1);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await claimNext(page, 10);
  await shot(page, "w9-10-decor-claimed");

  // ---- step 11: t_visit — mở panel Khách Thăm ----
  // togglePanel (KHÔNG phải openPanel) — tickVisit wired trong togglePanel.
  await page.evaluate(() => (window as unknown as { __gameTest: { state: { ui: () => { togglePanel: (p: string) => void } } } }).__gameTest.state.ui().togglePanel("visitors"));
  await page.waitForTimeout(500);
  await page.evaluate(() => (window as unknown as { __gameTest: { state: { ui: () => { closePanel: () => void } } } }).__gameTest.state.ui().closePanel());
  await page.waitForTimeout(200);
  await claimNext(page, 11);
  await shot(page, "w9-11-visit-claimed");

  // ---- step 12: t_deep_forest — hạ quái (đường CAVE defeatSlime — interact
// tĩnh, deterministic; combat deepforest cũng tick kể từ W9P5 fix) ----
  await page.evaluate(() => {
    (window as unknown as { __gameTest: { state: { world: () => { enterZone: (z: string, s: { x: number; y: number }) => void } } } }).__gameTest.state.world().enterZone("cave", { x: 6, y: 12 });
  });
  await page.waitForTimeout(400);
  // Cầm kiếm? KHÔNG cần — nhánh cave slime trong tryInteract chạy trước tool
  // check (bất kể slot). Đứng (6,12) face lên slime-a (6,10)? facing tile phải
  // TRÙNG ô slime: đứng (6,11) face up → facing (6,10).
  await page.evaluate(() => (window as unknown as { __gameTest: { actions: { teleport: (x: number, y: number) => void } } }).__gameTest.actions.teleport(6, 11));
  await page.waitForTimeout(300);
  for (let i = 0; i < 4; i++) {
    await page.keyboard.down("ArrowUp");
    await page.waitForTimeout(300);
    await page.keyboard.up("ArrowUp");
    const face = (await page.evaluate(() => {
      const w = window as unknown as { __gameTest: { engine: () => { getFacing?: () => string } } };
      return w.__gameTest.engine().getFacing?.() ?? "";
    })) ?? "";
    if (face === "up") break;
  }
  await page.evaluate(() => (window as unknown as { __gameTest: { actions: { interact: () => void } } }).__gameTest.actions.interact());
  await page.waitForTimeout(500);
  const killed = await page.evaluate(() => (window as unknown as { __gameTest: { state: { tutorial: () => { monstersDefeated: number } } } }).__gameTest.state.tutorial().monstersDefeated >= 1);
  expect(killed, "hạ slime cave → monstersDefeated ≥ 1").toBe(true);
  await claimNext(page, 12);
  await shot(page, "w9-12-monster-claimed");

  // ---- step 13: t_mount — giveMount bicycle + ride ----
  // Bicycle unlockLevel 2 — fresh save lv1 → addXp 100 (curve lv1→2).
  await page.evaluate(() => (window as unknown as { __gameTest: { actions: { addXp: (a: number) => void } } }).__gameTest.actions.addXp(100));
  await page.waitForTimeout(300);
  await page.evaluate(() => (window as unknown as { __gameTest: { actions: { giveMount: (id: string) => boolean } } }).__gameTest.actions.giveMount("bicycle"));
  // Tay không (canMount chặn khi cầm tool — slot đang chọn còn đồ dùng).
  await page.evaluate(() => {
    const inv = (window as unknown as { __gameTest: { state: { inv: () => { slots: ({ itemId: string } | null)[]; selectSlot: (i: number) => void } } } }).__gameTest.state.inv();
    const i = inv.slots.findIndex((s) => s === null);
    if (i >= 0) inv.selectSlot(i);
  });
  // N (KHÔNG phải M — M là hotkey map-panel; farm-scene W6P3 note).
  await page.keyboard.press("n");
  await page.waitForTimeout(400);
  await claimNext(page, 13);
  await shot(page, "w9-13-mount-claimed");

  // ---- step 14: t_raid_first — thoát raid ----
  await page.evaluate(() => (window as unknown as { __gameTest: { state: { raid: () => { setEnd: (e: { reason: "exit" }) => void } } } }).__gameTest.state.raid().setEnd({ reason: "exit" }));
  await page.waitForTimeout(300);
  // setEnd → phase "ended" → HUD pin UNMOUNT (raidPhase !== idle) → claim 14
  // không thể hiện. Reset raid (giống user đóng end-screen) → pin trở lại +
  // tickRaidEscape đã chạy trong setEnd → claim được.
  await page.evaluate(() => (window as unknown as { __gameTest: { state: { raid: () => { reset: () => void } } } }).__gameTest.state.raid().reset());
  await page.waitForTimeout(400);
  await claimNext(page, 14);
  expect((await qs(page)).tutorialStep).toBe(14);
  await shot(page, "w9-14-raid-first-claimed");
  // Hết chuỗi: pin quay về farmGoal — không còn claim
  await expect(page.getByTestId("hud-quest-claim")).toHaveCount(0);
  await shot(page, "w9-15-tutorial-done");
});