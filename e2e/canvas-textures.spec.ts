// Regression guard cho Phaser 4.2.1 scene-key fix ("canvas phẳng"):
// khi config.scene = [BootScene, FarmScene], SceneManager đăng ký mọi scene
// với placeholder key "default" → getScene("FarmScene") null → FarmScene không
// render texture → flat rectangle placeholder. Fix: game.scene.add(key, cls)
// tường minh sau khi boot. Test verify: scene keys đúng, FarmScene render
// texture tiles (terrainRenderer.count > 0), không dùng fallback rects.
import { test, expect } from "@playwright/test";
import { startNewGame } from "./helpers";

test.describe("Canvas texture render (scene-key regression)", () => {
  test("FarmScene renders texture tiles under its own scene key", async ({ page }) => {
    await startNewGame(page);
    await page.waitForFunction(() => {
      const w = window as unknown as { __game?: unknown; __gameTest?: unknown };
      return !!w.__game && !!w.__gameTest;
    }, undefined, { timeout: 30_000 });
    await page.waitForTimeout(1500);

    const diag = await page.evaluate(() => {
      const g = (window as unknown as {
        __game: {
          scene?: {
            keys: Record<string, unknown> | Map<string, unknown>;
            getScene: (k: string) => {
              terrainRenderer?: { count?: number };
              terrainLayer?: unknown[];
              cropRenderer?: { count?: number };
            } | null;
          };
        };
      }).__game;
      let keysEntries: string[] = [];
      if (g.scene?.keys instanceof Map) keysEntries = Array.from(g.scene.keys.keys());
      else keysEntries = Object.keys(g.scene?.keys ?? {});
      const farm = g.scene?.getScene?.("FarmScene") ?? null;
      return {
        keysEntries,
        farmFound: !!farm,
        terrainSpriteCount: farm?.terrainRenderer?.count ?? -1,
        fallbackRectCount: farm?.terrainLayer?.length ?? -1,
        cropRendererReady: typeof farm?.cropRenderer?.count === "number",
      };
    });
    // Mỗi scene phải đăng ký dưới key riêng — nếu cả 2 thành "default" thì
    // getScene("FarmScene") null và FarmScene không render (bug "canvas phẳng").
    expect(diag.keysEntries).toContain("FarmScene");
    expect(diag.keysEntries).toContain("BootScene");
    expect(diag.farmFound).toBe(true);
    // Texture path active: terrainRenderer dùng sprite Images (không fallback rects).
    expect(diag.terrainSpriteCount).toBeGreaterThan(0);
    expect(diag.fallbackRectCount).toBe(-1);
    // Crop layer renderer wired (audit M-1: crops phải hiển thị trên Phaser path).
    expect(diag.cropRendererReady).toBe(true);
  });

  test("planted crop renders a visible sprite on the Phaser path", async ({ page }) => {
    await startNewGame(page);
    await page.waitForFunction(() => {
      const w = window as unknown as { __game?: unknown; __gameTest?: unknown };
      return !!w.__game && !!w.__gameTest;
    }, undefined, { timeout: 30_000 });
    await page.waitForTimeout(1500);

      // Flow như farm-day.spec (UI-driven chọn tool/seed, bridge interact):
      // teleport → chọn Hoe → interact (cuốc) → chọn Parsnip Seeds → interact (trồng).
      // Review e2e-fix: relayout 185505d — plot lv1 (6,28), đứng (6,29) nhìn lên.
      await page.evaluate(() => {
        (window as unknown as {
          __gameTest: { actions: { teleport: (x: number, y: number) => void } };
        }).__gameTest.actions.teleport(6, 29);
      });
      await page.waitForTimeout(300);
      // FarmScene khởi tạo facing "down" — gõ briefly "up" để hoe nhắm (6,28) lv1.
      await page.keyboard.down("ArrowUp");
      await page.waitForTimeout(100);
      await page.keyboard.up("ArrowUp");
      await page.waitForTimeout(150);
      await page.getByRole("button", { name: "Hoe", exact: true }).click();
      await page.evaluate(() => {
        (window as unknown as {
          __gameTest: { actions: { interact: () => void } };
        }).__gameTest.actions.interact(); // till (6,28) facing up
      });
      await page.waitForTimeout(400);
      await page.getByRole("button", { name: "Parsnip Seeds" }).click();
      await page.evaluate(() => {
        (window as unknown as {
          __gameTest: { actions: { interact: () => void } };
        }).__gameTest.actions.interact(); // plant (6,28)
    });
    await page.waitForTimeout(400);

    // Crop layer phải có ít nhất 1 sprite — trồng cây trên Phaser path hiển thị.
    const cropCount = await page.evaluate(() => {
      const g = (window as unknown as {
        __game: {
          scene?: {
            getScene: (k: string) => { cropRenderer?: { count?: number } } | null;
          };
        };
      }).__game;
      return g.scene?.getScene?.("FarmScene")?.cropRenderer?.count ?? -1;
    });
    expect(cropCount).toBeGreaterThan(0);
  });

  test("NPC interact opens dialogue on the Phaser path", async ({ page }) => {
    await startNewGame(page);
    await page.waitForFunction(() => {
      const w = window as unknown as { __game?: unknown; __gameTest?: unknown };
      return !!w.__game && !!w.__gameTest;
    }, undefined, { timeout: 30_000 });
    await page.waitForTimeout(1500);

    // Alaric at village forge door (10,15). Enter village, stand (10,16), interact.
    // Map-enrichment: forge building now spans (7–12)×(9–13) — spot cũ (8,9) nằm trong forge.
    await page.evaluate(() => {
      const t = (window as unknown as {
        __gameTest: {
          state: { world: () => { enterZone: (z: string, spawn?: { x: number; y: number }) => void } };
          actions: { teleport: (x: number, y: number) => void };
        };
      }).__gameTest;
      t.state.world().enterZone("village", { x: 10, y: 16 });
      t.actions.teleport(10, 16);
    });
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      (window as unknown as {
        __gameTest: { actions: { interact: () => void } };
      }).__gameTest.actions.interact();
    });
    await page.waitForTimeout(400);

    // Dialogue modal mở (Alaric) — NPC talk khả dụng trên Phaser path.
    const dialogueOpen = await page.evaluate(() => {
      const api = (window as unknown as {
        __gameTest: { state: { ui: () => { dialogueNpc: string | null } } };
      }).__gameTest;
      return api.state.ui().dialogueNpc;
    });
    expect(dialogueOpen).not.toBeNull();
  });
});
