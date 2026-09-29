import { test, expect } from "@playwright/test";
import { startNewGame, shot } from "./helpers";

/**
 * E2E — Tất cả UI panels (phase 1-2): Inventory, Seeds, Crafting, Map,
 * Relationships, Calendar, Help, Settings. Mở qua hotkey (I/P/C/M/R/L/H)
 * và bridge openPanel (settings). Verify title + content render.
 */

test.describe("UI panels", () => {
  test.beforeEach(async ({ page }) => {
    await startNewGame(page);
  });

          test("inventory panel (I) — tools + seeds + stats", async ({ page }) => {
            await page.keyboard.press("i");
            await page.getByRole("dialog", { name: "Inventory & Tools" }).waitFor({ state: "visible" });
            await page.getByText("Slots used").waitFor({ state: "visible" });
            // 5 tools + rod (W1P3) + parsnip seeds ×9 → 7/12.
            await page.getByText("7/12").waitFor({ state: "visible" });
            // Slot grid render emoji + tool badge (tên item nằm trong title attr)
            await page.locator('[title="Hoe ×1"]').waitFor({ state: "visible" });
            await shot(page, "20-panel-inventory");
            // Click slot 1 (hoe) → detail mở ra
            await page.locator('[title="Hoe ×1"]').click();
            await page.getByText("Hoe", { exact: true }).waitFor({ state: "visible" });
            await page.getByText("Cuốc đất trồng hạt giống.").waitFor({ state: "visible" });
            await shot(page, "21-panel-inventory-detail");
            // Close
            await page.keyboard.press("Escape");
          });

          test("seeds panel (P) — in-season seed list", async ({ page }) => {
            await page.keyboard.press("p");
            await page.getByRole("dialog", { name: "Farming & Seeds" }).waitFor({ state: "visible" });
            await page.getByText("Mùa hiện tại").waitFor({ state: "visible" });
            // Spring: parsnip/cauliflower in-season
            await page.getByText("Đúng mùa").first().waitFor({ state: "visible" });
            await page.getByText("Lợi nhuận cây trồng", { exact: false }).waitFor({ state: "visible" });
            await shot(page, "22-panel-seeds");
            await page.keyboard.press("Escape");
          });

          test("crafting panel (C) — recipes list", async ({ page }) => {
            await page.keyboard.press("c");
            await page.getByRole("dialog", { name: "Crafting" }).waitFor({ state: "visible" });
            await page.getByText("Crafting Bench", { exact: false }).waitFor({ state: "visible" });
            // Ít nhất recipe fence/bread hiển thị (tên + "×1" suffix)
            await page.getByText("Wood Fence", { exact: false }).first().waitFor({ state: "visible" });
            await shot(page, "23-panel-crafting");
            await page.keyboard.press("Escape");
          });

          test("map panel (M) — five walkable zones", async ({ page }) => {
            await page.keyboard.press("m");
            await page.getByRole("dialog", { name: "Valley Map" }).waitFor({ state: "visible" });
            await page.getByText("Nông trại Tidecrest", { exact: true }).first().waitFor({ state: "visible" });
            await page.getByText("Làng", { exact: true }).first().waitFor({ state: "visible" });
            await shot(page, "24-panel-map");
            await page.keyboard.press("Escape");
          });

          test("relationships panel (R) — NPCs", async ({ page }) => {
            await page.keyboard.press("r");
            await page.getByRole("dialog", { name: "Relationships" }).waitFor({ state: "visible" });
            await page.getByText("Alaric", { exact: true }).first().waitFor({ state: "visible" });
            await page.getByText("Gaston", { exact: true }).first().waitFor({ state: "visible" });
            await shot(page, "25-panel-relationships");
            await page.keyboard.press("Escape");
          });

          test("calendar panel (L) — calendar + quests", async ({ page }) => {
            await page.keyboard.press("l");
            await page.getByRole("dialog", { name: "Calendar & Quests" }).waitFor({ state: "visible" });
            await page.getByText("Spring Calendar", { exact: false }).waitFor({ state: "visible" });
            await page.getByText("Quest Board", { exact: false }).waitFor({ state: "visible" });
            await shot(page, "26-panel-calendar");
            await page.keyboard.press("Escape");
          });

          test("help panel (H) — controls", async ({ page }) => {
            await page.keyboard.press("h");
            await page.getByRole("dialog", { name: "Help & Controls" }).waitFor({ state: "visible" });
            await page.getByText("W A S D / ↑ ↓ ← →", { exact: false }).first().waitFor({ state: "visible" });
            await page.getByText("Move your character", { exact: true }).waitFor({ state: "visible" });
            await shot(page, "27-panel-help");
            await page.keyboard.press("Escape");
          });

  test("settings panel — save/load/reset + audio", async ({ page }) => {
    await page.evaluate(() => {
      (window as unknown as {
        __gameTest: { state: { ui: () => { openPanel: (p: string) => void } } };
      }).__gameTest.state.ui().openPanel("settings");
    });
    await page.getByRole("dialog", { name: "Settings & Save" }).waitFor({ state: "visible" });
    await page.getByText("Lưu & Tải", { exact: true }).waitFor({ state: "visible" });
    await page.getByText("Tự động lưu", { exact: true }).waitFor({ state: "visible" });
    await page.getByText("Reset Current Farm (Unsaved)", { exact: true }).waitFor({ state: "visible" });
    // Audio: SFX + Music sliders (VI labels) — điều chỉnh không crash
    await page.getByText("Hiệu ứng âm thanh", { exact: true }).waitFor({ state: "visible" });
    await page.getByText("Nhạc nền", { exact: true }).waitFor({ state: "visible" });
    const sfxRange = page.getByLabel("Âm lượng hiệu ứng");
    await sfxRange.waitFor({ state: "visible" });
    await sfxRange.fill("0.5");
    const musicRange = page.getByLabel("Âm lượng nhạc");
    await musicRange.waitFor({ state: "visible" });
    await musicRange.fill("0.5");
    await shot(page, "28-panel-settings");
    await page.keyboard.press("Escape");
  });

  test("calendar quests — harvest parsnip → claim reward", async ({ page }) => {
    // Setup: có củ cải trong túi (q_first_harvest) trước khi mở panel
    await page.evaluate(() => {
      const t = (window as unknown as {
        __gameTest: {
          state: {
            inv: () => { addItem: (id: string, qty: number) => void };
            ui: () => { openPanel: (p: string) => void };
          };
        };
      }).__gameTest;
      t.state.inv().addItem("parsnip", 1);
      t.state.ui().openPanel("calendar");
    });
    await page.getByRole("dialog", { name: "Calendar & Quests" }).waitFor({ state: "visible" });
    // Badge "Đang làm" render cùng <p> với title → text nối "Vụ mùa đầu tiênĐang làm".
    await page.getByText("Vụ mùa đầu tiên").first().waitFor({ state: "visible" });
    const claimBtn = page.getByRole("button", { name: "Nhận" }).first();
    await claimBtn.waitFor({ state: "visible" });
    await claimBtn.click();
    const gold = await page.evaluate(() =>
      (window as unknown as { __gameTest: { state: { game: () => { gold: number } } } }).__gameTest
        .state.game().gold,
    );
    expect(gold).toBe(580);
    const completed = await page.evaluate(() =>
      (window as unknown as {
        __gameTest: { state: { quests: () => { completed: Record<string, boolean> } } };
      }).__gameTest.state.quests().completed,
    );
    expect(completed.q_first_harvest).toBe(true);
    await page.getByText("Xong", { exact: true }).first().waitFor({ state: "visible" });
    await shot(page, "30-panel-quest-claim");
    await page.keyboard.press("Escape");
  });

  test("shop — buy seed + sell goods flow", async ({ page }) => {
    // Setup: thêm crop parsnip để bán; mở shop qua bridge
    const goldBefore = await page.evaluate(() => {
      const t = (window as unknown as {
        __gameTest: {
          state: {
            inv: () => { addItem: (id: string, qty: number) => void };
            game: () => { gold: number };
            ui: () => { setShowShop: (b: boolean) => void };
          };
        };
      }).__gameTest;
      t.state.inv().addItem("parsnip", 5);
      t.state.ui().setShowShop(true);
      return t.state.game().gold;
    });
    await page.getByRole("dialog", { name: "Shop" }).waitFor({ state: "visible" });
    await page.getByText("Tidecrest General Store", { exact: true }).waitFor({ state: "visible" });
    // Tab mua: hạt giống parsnip in-season
    await page.getByText("Mua hạt giống", { exact: true }).waitFor({ state: "visible" });
    await page.getByText(/bán 35g/).first().waitFor({ state: "visible" });
    // Mua 5 hạt giống → gold giảm, inventory tăng parsnip_seed
    await page.getByRole("button", { name: "+5" }).first().click();
    const afterBuy = await page.evaluate(() => {
      const t = (window as unknown as {
        __gameTest: { state: { inv: () => { countItem: (id: string) => number } } };
      }).__gameTest;
      return t.state.inv().countItem("parsnip_seed");
    });
    expect(afterBuy).toBe(14); // 9 ban đầu + 5
    // Chuyển tab bán → sell 1 parsnip → gold +35
    await page.getByText("Sell Goods", { exact: true }).click();
    // Anchor "Parsnip" (crop) → đi lên row bán hàng → click ×1.
    // Lưu ý "Parsnip Seeds" (hạt, 10g) cũng sellable — exact:true chọn đúng crop 35g.
    const parsnipRow = page
      .getByText("Parsnip", { exact: true })
      .locator("xpath=ancestor::div[contains(@class, 'rounded-xl')]")
      .first();
    await parsnipRow.getByRole("button", { name: "×1" }).click();
    const goldAfter = await page.evaluate(() =>
      (window as unknown as { __gameTest: { state: { game: () => { gold: number } } } }).__gameTest
        .state.game().gold,
    );
    expect(goldAfter).toBe(goldBefore - 100 + 35); // mua 5×20, bán 1×35
    await shot(page, "31-panel-shop");
    await page.getByRole("button", { name: "Đóng" }).click();
  });

  test("crafting panel — craft fence thật (wood → fence_item)", async ({ page }) => {
    // Setup: thêm 2 wood (fence recipe cần 2 wood)
    await page.evaluate(() => {
      const t = (window as unknown as {
        __gameTest: { state: { inv: () => { addItem: (id: string, qty: number) => void } } };
      }).__gameTest;
      t.state.inv().addItem("wood", 2);
    });
    await page.keyboard.press("c");
    await page.getByRole("dialog", { name: "Crafting" }).waitFor({ state: "visible" });
    // Wood Fence recipe hiển thị với badge Ready
    await page.getByText("Wood Fence", { exact: false }).first().waitFor({ state: "visible" });
    await page.getByText("Ready", { exact: true }).waitFor({ state: "visible" });
    // Craft → fence_item vào inventory. exact:true — tránh match nút sidebar "Crafting"
    // (getByRole name là substring match mặc định).
    await page.getByRole("button", { name: "Craft", exact: true }).first().click();
    await page.waitForTimeout(300);
    const fenceCount = await page.evaluate(() =>
      (window as unknown as {
        __gameTest: { state: { inv: () => { countItem: (id: string) => number } } };
      }).__gameTest.state.inv().countItem("fence_item"),
    );
    expect(fenceCount).toBe(1);
    await shot(page, "32-panel-craft-fence");
    await page.keyboard.press("Escape");
  });

  test("relationships — give gift tăng friendship", async ({ page }) => {
    // Setup: thêm wood (Robin loves) để tặng; mở panel R
    const ptsBefore = await page.evaluate(() => {
      const t = (window as unknown as {
        __gameTest: {
          state: {
            inv: () => { addItem: (id: string, qty: number) => void };
            npc: () => { friendship: Record<string, number> };
            ui: () => { openPanel: (p: string) => void };
          };
        };
      }).__gameTest;
      t.state.inv().addItem("wood", 1);
      t.state.ui().openPanel("relationships");
      return t.state.npc().friendship["alaric"] ?? 0;
    });
    await page.getByRole("dialog", { name: "Relationships" }).waitFor({ state: "visible" });
    // Mở gift picker cho Robin (loves wood — reaction loved). Anchor card Robin qua
    // ancestor — tránh nhầm nút "Tặng quà" của NPC khác (mỗi card đều có nút này).
    const alaricCard = page
      .getByText("Alaric", { exact: true })
      .first()
      .locator("xpath=ancestor::div[contains(@class, 'overflow-hidden') and contains(@class, 'rounded-xl')]");
    await alaricCard.waitFor({ state: "visible" });
    await alaricCard.getByText("Tặng quà", { exact: true }).click();
    await alaricCard.getByText("Chọn quà", { exact: true }).waitFor({ state: "visible" });
    await alaricCard.locator('[title*="Wood"]').first().click();
    const ptsAfter = await page.evaluate(() =>
      (window as unknown as {
        __gameTest: { state: { npc: () => { friendship: Record<string, number> } } };
      }).__gameTest.state.npc().friendship["alaric"] ?? 0,
    );
    expect(ptsAfter).toBeGreaterThan(ptsBefore);
    await shot(page, "33-panel-gift");
    await page.keyboard.press("Escape");
  });

  test("settings — Reset Current Farm về state mặc định", async ({ page }) => {
    // Làm bẩn state: thêm wood + vàng → reset → verify về mặc định
    await page.evaluate(() => {
      const t = (window as unknown as {
        __gameTest: {
          state: {
            inv: () => { addItem: (id: string, qty: number) => void };
            game: () => { addGold: (n: number) => void; gold: number };
            ui: () => { openPanel: (p: string) => void };
          };
        };
      }).__gameTest;
      t.state.inv().addItem("wood", 99);
      t.state.game().addGold(5000);
      t.state.ui().openPanel("settings");
    });
    await page.getByRole("dialog", { name: "Settings & Save" }).waitFor({ state: "visible" });
    // Click Reset Current Farm
    await page.getByRole("button", { name: "Reset Current Farm (Unsaved)" }).click();
    await page.waitForTimeout(300);
    const st = await page.evaluate(() => {
      const t = (window as unknown as {
        __gameTest: {
          state: {
            inv: () => { countItem: (id: string) => number };
            game: () => { gold: number; day: number; season: string };
          };
        };
      }).__gameTest;
      return {
        gold: t.state.game().gold,
        day: t.state.game().day,
        wood: t.state.inv().countItem("wood"),
        parsnipSeed: t.state.inv().countItem("parsnip_seed"),
      };
    });
    expect(st.gold).toBe(500); // reset về 500
    expect(st.day).toBe(1);
    expect(st.wood).toBe(0); // reset xóa wood thêm
    expect(st.parsnipSeed).toBe(9); // seed mặc định giữ
    await shot(page, "34-panel-reset");
    await page.keyboard.press("Escape");
  });

  test("skills panel (S) — skill trees + points", async ({ page }) => {
    await page.evaluate(() => {
      (window as unknown as {
        __gameTest: { state: { ui: () => { openPanel: (p: string) => void } } };
      }).__gameTest.state.ui().openPanel("skills");
    });
    await page.getByRole("dialog", { name: "Skill Trees" }).waitFor({ state: "visible" });
    await page.getByText("Điểm kỹ năng", { exact: true }).first().waitFor({ state: "visible" });
    await page.getByText("Trồng trọt", { exact: true }).waitFor({ state: "visible" });
    await page.getByText("Chiến đấu", { exact: true }).waitFor({ state: "visible" });
    await page.getByText("Xã hội", { exact: true }).waitFor({ state: "visible" });
    await shot(page, "29-panel-skills");
    await page.keyboard.press("Escape");
  });
});
