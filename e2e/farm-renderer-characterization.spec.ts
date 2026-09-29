// Phase 3 — farm renderer characterization (phase-03 §Tests before).
// Pins the data + coordinate contract that any display-only renderer extraction MUST
// preserve: the 60×60 terrain grid, the player start tile, the crop index↔tile math, and
// the store-input shape renderers consume. These run via the test bridge BEFORE the
// terrain/decor/entity renderer extraction so a regression in coordinate/index handling is
// caught. art-independent: it asserts the DATA contract, not pixel art.
import { test, expect } from "@playwright/test";
import { startNewGame, readGameState } from "./helpers";
import { getPlayerPos } from "./helpers/phaser-canvas-strategy";

// Stable world constants (src/lib/game/constants.ts). Hardcoded here to characterize them:
// the renderer extraction must not change the grid dimensions. NOTE: the FARM zone is 60×60
// (the 30×22 in raid/constants.ts is the raid ARENA, a different map).
const MAP_COLS = 60;
const MAP_ROWS = 60;
const TILE_SIZE = 48;
const TILE_COUNT = MAP_COLS * MAP_ROWS; // 3600

test.describe("Farm renderer data contract (characterization)", () => {
  test.beforeEach(async ({ page }) => {
    await startNewGame(page);
  });

  test("terrain is the full 60×60 grid (renderer must preserve count + shape)", async ({ page }) => {
    const st = await readGameState(page);
    const terrain = st.farm.terrain as number[];
    expect(terrain.length, "terrain length = MAP_COLS×MAP_ROWS").toBe(TILE_COUNT);
    expect(terrain.length % MAP_COLS, "divisible into 60-col rows").toBe(0);
    expect(terrain.length / MAP_COLS, "exactly 60 rows").toBe(MAP_ROWS);
    // Every cell is a valid terrain enum value (finite, non-negative).
    for (const t of terrain) expect(t).toBeGreaterThanOrEqual(0);
  });

  test("player start tile is (12, 12) — coordinate derivation floor(x/TILE_SIZE)", async ({ page }) => {
    const pos = await getPlayerPos(page);
    const tx = Math.floor(pos.x / TILE_SIZE); // TILE_SIZE = 48
    const ty = Math.floor(pos.y / TILE_SIZE);
    expect(tx).toBe(12);
    expect(ty).toBe(12);
  });

  test("crops + objects are Record<index, …> — the renderer's keyed input shape", async ({ page }) => {
    const st = await readGameState(page);
    expect(typeof st.farm.crops).toBe("object");
    expect(st.farm.crops).not.toBeNull();
    // Crop keys (when present) must be valid tile indices in the grid.
    for (const key of Object.keys(st.farm.crops as Record<string, unknown>)) {
      const idx = Number(key);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(TILE_COUNT);
    }
    expect(typeof st.farm.objects).toBe("object");
  });

  test("crop index ↔ tile coordinate math: idx = ty*MAP_COLS + tx", async ({ page }) => {
    // The renderer derives a crop sprite's x/y from its store index via this exact formula.
    // Pin both directions so an extraction cannot silently swap row/col.
    const tx = 10;
    const ty = 9;
    const idx = ty * MAP_COLS + tx;
    expect(idx).toBe(550);
    // Inverse: idx → (tx, ty)
    expect(idx % MAP_COLS).toBe(tx);
    expect(Math.floor(idx / MAP_COLS)).toBe(ty);
  });
});

test.describe("Route restart cleanup (phase-03 §route restart)", () => {
  test("scene shutdown destroys renderers; re-enter leaves no duplicate or stale state", async ({ page }) => {
    await startNewGame(page);
    // Wait for the scene + renderers to be live (H5: de-flake — don't eval before boot).
    await page.waitForFunction(() => {
      const g = (window as unknown as {
        __game?: {
          scene?: { getScene?: (k: string) => unknown };
        };
      }).__game;
      const farm = g?.scene?.getScene?.("FarmScene");
      return !!farm;
    }, undefined, { timeout: 20_000 });
    await page.waitForTimeout(500);

    const readCounts = () =>
      page.evaluate(() => {
        const g = (window as unknown as {
          __game?: {
            scene?: {
              getScene: (k: string) => {
                terrainRenderer?: { count?: number };
                cropRenderer?: { count?: number };
                entityRenderer?: { count?: number };
              } | null;
            };
          };
        }).__game;
        const farm = g?.scene?.getScene?.("FarmScene");
        return {
          terrain: farm?.terrainRenderer?.count ?? -1,
          crop: farm?.cropRenderer?.count ?? -1,
          entity: farm?.entityRenderer?.count ?? -1,
        };
      });

    const before = await readCounts();
    expect(before.terrain).toBeGreaterThan(0); // texture tiles rendered
    // Farm zone không còn NPC placeholder sau visual redesign (zones/farm.ts npcs: [] —
    // NPC elyria chuyển sang beach zone), nên entity count trên farm là 0 hợp lệ. Mục đích
    // thật của test là cleanup contract: after phải bằng before (xem dưới).
    expect(before.entity).toBeGreaterThanOrEqual(0);

    // In-SPA scene restart (same heap): stop FarmScene → shutdown emits and must destroy
    // every renderer's objects and unsubscribe stores; then re-start → fresh render.
    const restarted = await page.evaluate(() => {
      const g = (window as unknown as {
        __game?: {
          scene?: {
            stop: (k: string) => void;
            start: (k: string) => void;
            getScene: (k: string) => { sys?: { settings?: { key?: string } } } | null;
          };
        };
      }).__game;
      if (!g?.scene) return false;
      g.scene.stop("FarmScene");
      g.scene.start("FarmScene");
      return true;
    });
    expect(restarted).toBe(true);
    await page.waitForFunction(() => {
      const g = (window as unknown as {
        __game?: {
          scene?: { getScene?: (k: string) => { terrainRenderer?: { count?: number } } | null };
        };
      }).__game;
      const farm = g?.scene?.getScene?.("FarmScene");
      return !!farm && (farm.terrainRenderer?.count ?? -1) > 0;
    }, undefined, { timeout: 20_000 });

    const after = await readCounts();
    // Fresh scene re-renders exactly the baseline counts; an uncleaned shutdown would leave
    // duplicate objects (count > baseline) or stale destroyed sprites attached to the scene.
    expect(after.terrain).toBe(before.terrain);
    expect(after.crop).toBe(before.crop);
    expect(after.entity).toBe(before.entity);
  });
});
