import { test, expect } from "@playwright/test";
import { startNewGame, readGameState, shot, waitForGameState } from "./helpers";
import { MAP_COLS } from "../src/lib/game/constants";

/**
 * E2E — Farm gameplay full vòng lặp Stardew (phase 1-2-3):
 * new farm → shop mua seed → cuốc → trồng → tưới → sleep qua các ngày →
 * thu hoạch → bán → save/load → reset.
 *
 * Dùng window.__gameTest (test bridge) để teleport/di chuyển deterministic
 * + đọc state verify (KHÔNG phụ thuộc timing canvas).
 */

test.describe("Farm gameplay full-day loop", () => {
  test("new farm → till → plant → water → grow → harvest → sell → sleep", async ({ page }) => {
    await startNewGame(page);

    // ---- State ban đầu: Spring Day 1, 500g, đủ tools + 9 parsnip seeds ----
    let st = await readGameState(page);
    expect(st.game.day).toBe(1);
    expect(st.game.season).toBe("Spring");
    expect(st.game.gold).toBe(500);
    expect(st.inv.slots.some((s) => s?.itemId === "hoe")).toBe(true);
    expect(st.inv.slots.some((s) => s?.itemId === "parsnip_seed")).toBe(true);
    expect(st.inv.slots.find((s) => s?.itemId === "parsnip_seed")?.qty).toBe(9);
    await shot(page, "01-new-farm");

    // ---- Shop lv1: potato khóa (Lv2), cauliflower khóa (Lv5) — không mua được ----
    await page.keyboard.press("g"); // mở shop
    await page.getByText("Tidecrest General Store").waitFor({ state: "visible" });
    const cards = page.locator(".grid > div");
    const potatoCard = cards.filter({ hasText: "Potato" });
    await expect(potatoCard.getByRole("button", { name: "+1", exact: true })).toBeDisabled();
    const cauliCard = cards.filter({ hasText: "Cauliflower" });
    await expect(cauliCard.getByRole("button", { name: "+1", exact: true })).toBeDisabled();
    await shot(page, "02-shop-buy-seed");
    await page.keyboard.press("Escape");

    st = await readGameState(page);
    expect(st.game.gold).toBe(500); // không mua gì ở lv1 — hạt khóa level

    // ---- Cuốc ô ruộng lv1 (6,29) đứng facing up → cuốc (6,28) ----
    // Review e2e-fix: farm relayout 185505d dời FARM_PLOTS sang lưới (6-9, 28-31);
    // plot lv1 gần nhất (6,28), đứng dưới (6,29).
    await page.evaluate(() => {
      (window as unknown as {
        __gameTest: {
          actions: { teleport: (x: number, y: number) => void };
        };
      }).__gameTest.actions.teleport(6, 29);
    });
    await page.waitForTimeout(300);
    // FarmScene khởi tạo facing "down" (khớp frame idle-d) → gõ briefly "up"
    // để interact nhắm ô phía trên (6,28).
    await page.keyboard.down("ArrowUp");
    await page.waitForTimeout(100);
    await page.keyboard.up("ArrowUp");
    await page.waitForTimeout(150);
    // Chọn hoe qua hotbar (aria-label "Hoe") — exact để không dính HUD pin
    // "Việc hôm nay: Cuốc ô ruộng" / "Today: Hoe plots" (goal chứa chữ Hoe).
    await page.getByRole("button", { name: "Hoe", exact: true }).click();
    await page.evaluate(() => {
      (window as unknown as {
        __gameTest: { actions: { interact: () => void } };
      }).__gameTest.actions.interact();
    });
    await page.waitForTimeout(400);

    st = await readGameState(page);
    const idxTarget = 28 * MAP_COLS + 6; // (6,28) — FARM_PLOTS lv1 sau relayout
    expect(st.farm.terrain[idxTarget]).toBe(4); // T.TILLED
    await shot(page, "03-tilled-soil");

    // ---- Trồng parsnip seed trên (6,28) (đứng (6,29) facing up) ----
    await page.getByRole("button", { name: "Parsnip Seeds" }).click();
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      (window as unknown as {
        __gameTest: { actions: { interact: () => void } };
      }).__gameTest.actions.interact();
    });
    await page.waitForTimeout(400);

    st = await readGameState(page);
    const plantedIdx = idxTarget;
    const plantedCrop = st.farm.crops[plantedIdx];
    expect(plantedCrop).toBeDefined();
    expect(plantedCrop.cropId).toBe("parsnip");
    await shot(page, "04-planted-crop");

    // ---- Tưới nước (chọn watering can, interact vào (6,28)) ----
    await page.getByRole("button", { name: "Watering Can" }).click();
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      (window as unknown as {
        __gameTest: { actions: { interact: () => void } };
      }).__gameTest.actions.interact();
    });
    await page.waitForTimeout(400);

    st = await readGameState(page);
    const crop0 = st.farm.crops[plantedIdx];
    expect(crop0).toBeDefined();
    expect(crop0.watered).toBe(true);
    await shot(page, "05-watered-crop");

    // ---- Tiến 4 ngày (parsnip growth 4 days, watered) ----
    // endDay mỗi ngày + tưới lại. Parsnip 4 ngày → stage 4 (harvestable).
    const plantedX = 6;
    const plantedY = 28;
    for (let d = 0; d < 4; d++) {
      await page.evaluate(() => {
        (window as unknown as {
          __gameTest: { actions: { endDay: () => void } };
        }).__gameTest.actions.endDay();
      });
      await page.waitForTimeout(150);
      // Redesign: ngủ dậy trong NHÀ (zone house) → quay lại farm đứng cạnh crop
      // trước khi tưới lại (interact theo facing tile của zone hiện tại).
      await page.evaluate(() => {
        (window as unknown as {
          __gameTest: { state: { world: () => { enterZone: (z: string, s: { x: number; y: number }) => void } } };
        }).__gameTest.state.world().enterZone("farm", { x: 6, y: 29 });
      });
      await page.waitForTimeout(250);
      // Tưới lại crop mỗi sáng (nếu chưa harvestable)
      const s = await readGameState(page);
      const c = s.farm.crops[plantedIdx];
      if (c && c.stage < 4 && !c.dead) {
        await page.getByRole("button", { name: "Watering Can" }).click();
        await page.evaluate(() => {
          (window as unknown as {
            __gameTest: { actions: { interact: () => void } };
          }).__gameTest.actions.interact();
        });
        await page.waitForTimeout(250);
      }
    }
    st = await readGameState(page);
    expect(st.game.day).toBe(5); // 1 + 4 sleeps
    const grown = st.farm.crops[plantedIdx];
    expect(grown).toBeDefined();
    expect(grown.stage).toBeGreaterThanOrEqual(4); // harvestable
    await shot(page, "06-grown-crop");

    // ---- Thu hoạch (hand/empty slot hoặc scythe) ----
    // Chọn ô trống (slot 12) để dùng tay "hand" → harvest
    await page.keyboard.press("="); // slot 12 (index 11) — thường trống
    await page.evaluate(() => {
      (window as unknown as {
        __gameTest: { actions: { interact: () => void } };
      }).__gameTest.actions.interact();
    });
    await page.waitForTimeout(400);

    st = await readGameState(page);
    expect(st.farm.crops[plantedIdx]).toBeUndefined(); // đã harvest
    // Phase 5: crop vào SILO (không vào túi — túi chỉ tool/seed)
    const parsnips = st.farm.silo.parsnip ?? 0;
    expect(parsnips).toBeGreaterThanOrEqual(1);
    await shot(page, "07-harvested");

    // ---- Bán qua shop (sell tab) ----
    await page.keyboard.press("g");
    await page.getByRole("button", { name: "Sell Goods" }).click();
    // Row "Parsnip" (không phải "Parsnip Seeds") → click All
    const sellRows = page.locator(".space-y-2 > div");
    const parsnipRow = sellRows.filter({ hasText: "Parsnip" }).filter({ hasNotText: "Parsnip Seeds" });
    await parsnipRow.getByRole("button", { name: "All" }).click();
    await shot(page, "08-sold-goods");
    await page.keyboard.press("Escape");

    st = await readGameState(page);
    expect(st.game.gold).toBeGreaterThan(500); // 500 + 35/parsnip
    // Phase 5: bán trừ silo trước — silo + túi đều hết parsnip
    expect(st.farm.silo.parsnip ?? 0).toBe(0);
    const parsnipsLeft = st.inv.slots.filter((s) => s?.itemId === "parsnip").reduce((a, s) => a + (s?.qty ?? 0), 0);
    expect(parsnipsLeft).toBe(0);

    // ---- Save + verify (settings panel) ----
    // Mở Settings qua store (tránh dev overlay intercept pointer trên FeatureBar trái)
    await page.evaluate(() => {
      (window as unknown as {
        __gameTest: { state: { ui: () => { openPanel: (p: string) => void } } };
      }).__gameTest.state.ui().openPanel("settings");
    });
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: "Save", exact: true }).first().click();
    await page.getByText(/Đã lưu vào Slot 1/i).waitFor({ state: "visible", timeout: 10_000 });
    await shot(page, "09-saved");
    await page.evaluate(() => {
      (window as unknown as {
        __gameTest: { state: { ui: () => { closePanel: () => void } } };
      }).__gameTest.state.ui().closePanel();
    });

    // ---- Sleep → Day 6 ----
    await page.evaluate(() => {
      (window as unknown as {
        __gameTest: { actions: { sleep: () => void } };
      }).__gameTest.actions.sleep();
    });
    await page.waitForTimeout(400);
    st = await readGameState(page);
    expect(st.game.day).toBe(6);
    await shot(page, "10-next-day");
  });

  test("save → reload → state preserved", async ({ page }) => {
    await startNewGame(page);

    // Chơi tới Day 3 với vài thay đổi rồi save
    await page.evaluate(() => {
      (window as unknown as {
        __gameTest: {
          actions: { endDay: () => void; save: () => Promise<boolean> };
        };
      }).__gameTest.actions.endDay();
    });
    await page.waitForTimeout(200);
    // Thêm 5 parsnip_seed vào inventory (simulate activity) qua bridge không có — dùng addItem trực tiếp
    await page.evaluate(() => {
      (window as unknown as {
        __gameTest: { state: { inv: () => { addItem: (id: string, q: number) => void } } };
      }).__gameTest.state.inv().addItem("wood", 7);
    });
    await page.waitForTimeout(150);
    const saved = await page.evaluate(() => {
      return (window as unknown as {
        __gameTest: { actions: { save: () => Promise<boolean> } };
      }).__gameTest.actions.save();
    });
    expect(saved).toBe(true);

    // Reload page → StartScreen hiện save slot1 với preview Day 2 (1 sleep từ Day1)
    await page.reload();
    // Redesign: heading "Save slots" (en) / "Ô lưu game" (vi) — match không phân biệt hoa thường.
    await page.getByText(/save slots|ô lưu game/i).waitFor({ state: "visible", timeout: 20_000 });
    // Verify preview hiển thị gold (khác 0 sau các hoạt động)
    // Format preview: "Spring · 2/1 · 500g" (season · day/year · gold).
    const goldPreview = page.locator("text=Spring ·").first();
    await goldPreview.waitFor({ state: "visible", timeout: 10_000 });
    await shot(page, "11-save-slot-preview");

    // Continue → load lại state: day 2, wood 7
    await page.getByRole("button", { name: /continue latest|tiếp tục nông trại/i }).click();
    await page.waitForFunction(() => {
      const w = window as unknown as { __gameTest?: unknown };
      return !!w.__gameTest;
    }, undefined, { timeout: 20_000 });
    await page.waitForTimeout(500);
    const st = await readGameState(page);
    expect(st.game.day).toBe(2);
    const wood = st.inv.slots.filter((s) => s?.itemId === "wood").reduce((a, s) => a + (s?.qty ?? 0), 0);
    expect(wood).toBe(7);
    await shot(page, "12-loaded-state");
  });

  test("reset farm → về trạng thái mới", async ({ page }) => {
    await startNewGame(page);

    // Thay đổi state
    await page.evaluate(() => {
      (window as unknown as {
        __gameTest: {
          state: {
            inv: () => { addItem: (id: string, q: number) => void };
            game: () => { addGold: (g: number) => void };
          };
        };
      }).__gameTest.state.inv().addItem("wood", 99);
      (window as unknown as {
        __gameTest: { state: { game: () => { addGold: (g: number) => void } } };
      }).__gameTest.state.game().addGold(500);
    });
    await page.waitForTimeout(150);

    // Reset qua bridge
    await page.evaluate(() => {
      (window as unknown as {
        __gameTest: { actions: { reset: () => void } };
      }).__gameTest.actions.reset();
    });
    await page.waitForTimeout(200);

    const st = await readGameState(page);
    expect(st.game.gold).toBe(500);
    expect(st.game.day).toBe(1);
    expect(st.game.season).toBe("Spring");
    const wood = st.inv.slots.filter((s) => s?.itemId === "wood").reduce((a, s) => a + (s?.qty ?? 0), 0);
    expect(wood).toBe(0);
    await shot(page, "13-reset-farm");
  });
});
