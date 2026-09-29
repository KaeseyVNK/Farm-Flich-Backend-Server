// Wave 5 P5 — e2e combat deepforest.
// 1) Warp farm→deepforest, spawn slime cạnh, chọn kiếm (giveItem e2e), Space ×2 →
//    dead + XP tăng (loot rng đã cover unit P2 — không assert pickup cụ thể).
// 2) Quái chạm player đứng yên → energy giảm (touch + invuln loop).
// 3) Về farm → combat snapshot rỗng (farm-safe, cozy §4).
// Pattern: page.evaluate body phải self-contained (closure module không serialize).
import { test, expect, type Page } from "@playwright/test";
import { startNewGame, shot, readStoryProgression } from "./helpers";

interface CombatSnap {
  enemies: { id: string; defId: string; x: number; y: number; hp: number; fsm: string }[];
  pickups: { itemId: string; qty: number; x: number; y: number }[];
}

interface Bridge {
  actions: {
    teleport: (x: number, y: number) => void;
    giveItem: (itemId: string, qty: number) => number;
    combat: () => CombatSnap | null;
    spawnEnemyAt: (defId: string, tx: number, ty: number) => boolean;
  };
  state: {
    world: () => { zone: string };
    game: () => { energy: number };
    inv: () => { slots: ({ itemId: string; qty: number } | null)[]; selectedSlot: number };
  };
}

async function zoneOf(page: Page): Promise<string> {
  return page.evaluate(() => (window as unknown as { __gameTest: Bridge }).__gameTest.state.world().zone);
}

async function energyOf(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __gameTest: Bridge }).__gameTest.state.game().energy);
}

async function combatOf(page: Page): Promise<CombatSnap | null> {
  return page.evaluate(() => (window as unknown as { __gameTest: Bridge }).__gameTest.actions.combat());
}

async function teleport(page: Page, x: number, y: number): Promise<void> {
  await page.evaluate(([tx, ty]) => (window as unknown as { __gameTest: Bridge }).__gameTest.actions.teleport(tx as number, ty as number), [x, y]);
}

async function spawnEnemyAt(page: Page, defId: string, tx: number, ty: number): Promise<boolean> {
  return page.evaluate(([d, px, py]) => (window as unknown as { __gameTest: Bridge }).__gameTest.actions.spawnEnemyAt(d as string, px as number, py as number), [defId, tx, ty]);
}

/** Giữ phím di chuyển tới khi zone đổi (warp) rồi nhả. */
async function holdMoveUntilZone(page: Page, key: string, wantZone: string, timeout = 6000): Promise<void> {
  await page.keyboard.down(key);
  try {
    await page.waitForFunction(
      ([z]) => {
        const w = window as unknown as { __gameTest?: { state: { world: () => { zone: string } } } };
        return w.__gameTest?.state.world().zone === z;
      },
      [wantZone],
      { timeout },
    );
  } finally {
    await page.keyboard.up(key);
  }
}

/** giveItem rồi nhấn phím hotbar của slot chứa item (1-9,0,-,=). */
async function selectItemSlot(page: Page, itemId: string): Promise<void> {
  const idx = await page.evaluate(
    ([id]) => {
      const g = (window as unknown as { __gameTest: Bridge }).__gameTest;
      g.actions.giveItem(id, 1);
      return g.state.inv().slots.findIndex((s) => s?.itemId === id);
    },
    [itemId],
  );
  expect(idx).toBeGreaterThanOrEqual(0);
  const key = idx < 9 ? String(idx + 1) : idx === 9 ? "0" : idx === 10 ? "-" : "=";
  await page.keyboard.press(key);
  const sel = await page.evaluate(() => (window as unknown as { __gameTest: Bridge }).__gameTest.state.inv().selectedSlot);
  expect(sel).toBe(idx);
}

test.describe("combat (W5 deepforest)", () => {
  test("warp → spawn slime → kiếm ×2 → dead + XP → về farm sạch quái", async ({ page }) => {
    test.setTimeout(90_000);
    await startNewGame(page);
    // Kiếm vào túi + chọn slot TRƯỚC khi warp (mua shop thật đã cover shop spec).
    await selectItemSlot(page, "sword");

    // Farm (56,10) → giữ D bước vào warp (57,10) → deepforest spawn (3,14).
    await teleport(page, 56, 10);
    await holdMoveUntilZone(page, "d", "deepforest");
    expect(await zoneOf(page)).toBe("deepforest");

    // 8 spawn layout + e2e spawn 1 slime ngay dưới player (facing down).
    const before = await combatOf(page);
    expect(before?.enemies.length ?? 0).toBeGreaterThanOrEqual(8);
    await shot(page, "50-combat-deepforest");
    const xpBefore = (await readStoryProgression(page)).progression.xp as number;

    // Player vào warp bằng phím D → facing "right" — spawn quái BÊN PHẢI.
    // Teleport vào giữa path trước: cạnh warp (2,14) knockback hoạt động sẽ hất
    // player ngược vào warp tile → bounce về farm giữa trận.
    await teleport(page, 8, 14);
    const spawned = await spawnEnemyAt(page, "sprout_slime", 9, 14);
    expect(spawned).toBe(true);
    expect((await combatOf(page))!.enemies.find((e) => e.id === "e2e-0")?.fsm).not.toBe("dead");

    // 2 swings (hp 2, damage 1) — actionLock ~833ms + cooldown 180ms → nghỉ 1.2s.
    // Space GIỮ qua ≥1 frame — press down+up cùng frame bị endFrame clear edge.
    await page.keyboard.down("Space");
    await page.waitForTimeout(200);
    await page.keyboard.up("Space");
    await page.waitForTimeout(1200);
    await page.keyboard.down("Space");
    await page.waitForTimeout(200);
    await page.keyboard.up("Space");
    await shot(page, "51-combat-swing");
    await expect
      .poll(async () => (await combatOf(page))?.enemies.find((e) => e.id === "e2e-0")?.fsm, { timeout: 4000 })
      .toBe("dead");
    await shot(page, "52-combat-dead");

    const xpAfter = (await readStoryProgression(page)).progression.xp as number;
    expect(xpAfter).toBeGreaterThan(xpBefore);

    // Loot pickup rng (80%/30%) — unit P2 cover bảng roll; ở đây chỉ record nếu rơi.
    const loot = (await combatOf(page))?.pickups ?? [];
    console.log(`[combat e2e] drops: ${JSON.stringify(loot)}`);

    // Về farm: giữ A từ (3,14) vào warp (2,14) → farm — quái dọn sạch.
    await holdMoveUntilZone(page, "a", "farm");
    expect(await zoneOf(page)).toBe("farm");
    await expect
      .poll(async () => (await combatOf(page))?.enemies.length ?? -1, { timeout: 4000 })
      .toBe(0);
    await shot(page, "53-combat-farm-clean");
  });

  test("quái chạm player đứng yên → energy giảm (touch + invuln)", async ({ page }) => {
    test.setTimeout(60_000);
    await startNewGame(page);
    await teleport(page, 56, 10);
    await holdMoveUntilZone(page, "d", "deepforest");

    const e0 = await energyOf(page);
    // myconid aggro 6 — spawn 1 tile dưới player, đứng yên → chase → chạm.
    const spawned = await spawnEnemyAt(page, "myconid_purple", 3, 15);
    expect(spawned).toBe(true);
    await expect
      .poll(async () => energyOf(page), { timeout: 8000 })
      .toBeLessThan(e0);
    await shot(page, "54-combat-touch-energy");
  });
});
