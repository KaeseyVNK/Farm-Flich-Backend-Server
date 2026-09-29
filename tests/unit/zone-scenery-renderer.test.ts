// Task 8 — renderer wiring contract tests.
// ZoneSceneryRenderer runs against a plain structural SceneryScene mock
// (no Phaser import), plus the worldStore non-farm solidity dispatch that
// makes the Tasks 3–7 zone layouts actually collide: before Task 8 the
// isZoneScenerySolid call sat inside the `zone === "farm"` branch, so
// village/beach/cave/house landmarks rendered walk-through.
import { describe, it, expect } from "vitest";
import { registerZoneScenery } from "../../src/lib/game/scenery";
import type { SpritePlacement, ZoneScenery } from "../../src/lib/game/scenery/types";
import { ZoneSceneryRenderer } from "../../src/components/game/phaser/zone-scenery-renderer";
import { TILE_SIZE } from "../../src/lib/game/constants";
// Real store + real zone layouts (self-registering) — the dispatch test must
// go through the actual worldStore.isSolid, not the registry directly.
import { useWorldStore } from "@/store/worldStore";
import { T } from "@/lib/game/constants";
import { VILLAGE_ZONE } from "@/lib/game/zones";
import { VILLAGE_SCENERY } from "@/lib/game/scenery/village-layout";

type MockRect = {
  color: number; x: number; y: number; w: number; h: number;
  depth: number; destroyed: boolean;
};

type MockImage = {
  key: string; depth: number; destroyed: boolean;
  setOrigin(): MockImage;
  setScale(): MockImage;
  setDepth(d: number): MockImage;
  setData(k: string, v: unknown): MockImage;
  getData(k: string): unknown;
  destroy(): void;
};

function fakeScene(withTextures = false) {
  const rects: MockRect[] = [];
  const images: MockImage[] = [];
  const killedTweens: unknown[] = [];
  const addedTweens: unknown[] = [];
  const frames = new Set<string>();
  const scene = {
    add: {
      image(x: number, y: number, key: string): MockImage {
        const img: MockImage = {
          key, depth: 0, destroyed: false,
          setOrigin() { return img; },
          setScale() { return img; },
          setDepth(d: number) { img.depth = d; return img; },
          setData(k: string, v: unknown) { (img as unknown as Record<string, unknown>)[k] = v; return img; },
          getData(k: string) { return (img as unknown as Record<string, unknown>)[k]; },
          destroy() { img.destroyed = true; },
        };
        void x; void y;
        images.push(img);
        return img;
      },
      graphics() {
        const rect: MockRect = { color: -1, x: 0, y: 0, w: 0, h: 0, depth: 0, destroyed: false };
        const g = {
          fillStyle(color: number) { rect.color = color; return g; },
          fillRect(x: number, y: number, w: number, h: number) {
            rect.x = x; rect.y = y; rect.w = w; rect.h = h;
            rects.push(rect);
            return g;
          },
          setDepth(depth: number) { rect.depth = depth; return g; },
          destroy() { rect.destroyed = true; },
        };
        return g;
      },
    },
    textures: withTextures
      ? {
          exists: () => true,
          get: () => ({
            has: (f: string) => frames.has(f),
            add: (f: string) => frames.add(f),
          }),
        }
      : undefined,
    tweens: {
      add: (config: { targets?: unknown }) => {
        addedTweens.push(config);
        return config;
      },
      killTweensOf: (t: unknown) => killedTweens.push(t),
    },
  };
  return { scene, rects, images, killedTweens, addedTweens };
}

describe("ZoneSceneryRenderer contract", () => {
  it("draws one fallback rect per placement when textures do not exist", () => {
    registerZoneScenery("t8-multi-zone", {
      placements: [
        { key: "obj.a", tx: 1, ty: 2, cols: 2, rows: 2, fallbackColor: 0x111111 },
        { key: "obj.b", tx: 5, ty: 6, cols: 1, rows: 3, fallbackColor: 0x222222 },
      ],
      isSolid: () => false,
    });
    const { scene, rects, images } = fakeScene();
    new ZoneSceneryRenderer().render(scene, "t8-multi-zone", "Spring");
    expect(images).toHaveLength(0);
    expect(rects).toHaveLength(2);
    expect(rects[0]).toMatchObject({
      color: 0x111111,
      x: 1 * TILE_SIZE,
      y: 2 * TILE_SIZE,
      w: 2 * TILE_SIZE,
      h: 2 * TILE_SIZE,
    });
    expect(rects[1]).toMatchObject({
      color: 0x222222,
      x: 5 * TILE_SIZE,
      y: 6 * TILE_SIZE,
      w: 1 * TILE_SIZE,
      h: 3 * TILE_SIZE,
    });
  });

  it("destroy is idempotent and safe before any render", () => {
    registerZoneScenery("t8-idempotent-zone", {
      placements: [
        { key: "obj.missing", tx: 0, ty: 0, cols: 1, rows: 1, fallbackColor: 0x333333 },
      ],
      isSolid: () => false,
    });
    const renderer = new ZoneSceneryRenderer();
    expect(() => renderer.destroy()).not.toThrow(); // never rendered
    const { scene, rects } = fakeScene();
    renderer.render(scene, "t8-idempotent-zone", "Spring");
    renderer.destroy();
    expect(rects[0].destroyed).toBe(true);
    expect(() => renderer.destroy()).not.toThrow(); // second destroy is a no-op
    expect(rects[0].destroyed).toBe(true);
  });

  it("draws nothing for an unregistered zone", () => {
    const { scene, rects, images } = fakeScene(true);
    new ZoneSceneryRenderer().render(scene, "atlantis-t8", "Spring");
    expect(rects).toHaveLength(0);
    expect(images).toHaveLength(0);
  });

  it("skips the sway tween for sway placements when reducedMotion is set", () => {
    const placements: readonly SpritePlacement[] = [
      { key: "obj.sway", tx: 3, ty: 4, cols: 2, rows: 2, fallbackColor: 0x444444, sway: true },
    ];
    registerZoneScenery("t8-sway-zone", { placements, isSolid: () => false });
    const { scene, images, addedTweens, killedTweens } = fakeScene(true);
    const renderer = new ZoneSceneryRenderer();
    renderer.render(scene, "t8-sway-zone", "Spring", { reducedMotion: true });
    expect(images).toHaveLength(1); // sprite still drawn — only the sway dies
    expect(addedTweens).toHaveLength(0);
    renderer.destroy();
    expect(killedTweens).toHaveLength(0); // nothing to kill
  });
});

describe("worldStore non-farm scenery solidity (Task 8 dispatch)", () => {
  it("village fountain is solid via worldStore.isSolid after entering the village", () => {
    useWorldStore.getState().reset();
    useWorldStore.getState().enterZone("village");
    // obj.fountain footprint (20,14,3×3): centre tile must be solid…
    expect(useWorldStore.getState().isSolid(21, 15)).toBe(true);
    // …even though the authored terrain there is plain floor — solid must
    // come from the scenery dispatch, not the terrain layer.
    const solidTerrain = [T.WATER, T.TREE, T.ROCK, T.FENCE];
    expect(solidTerrain).not.toContain(VILLAGE_ZONE.terrain[15 * VILLAGE_ZONE.cols + 21]);
    // The plaza corridor beside it stays walkable, and the check really
    // flows through VILLAGE_SCENERY.
    expect(useWorldStore.getState().isSolid(19, 15)).toBe(false);
    expect(VILLAGE_SCENERY.isSolid(21, 15)).toBe(true);
    useWorldStore.getState().reset();
  });

  it("beach moai, cave bonfire and house bed are solid via their layouts", () => {
    const world = useWorldStore.getState();
    world.reset();
    world.enterZone("beach");
    expect(useWorldStore.getState().isSolid(37, 21)).toBe(true); // moai (37,20,2×3)
    world.enterZone("cave");
    expect(useWorldStore.getState().isSolid(13, 13)).toBe(true); // bonfire (13,12,2×2)
    world.enterZone("house");
    expect(useWorldStore.getState().isSolid(4, 3)).toBe(true); // bed south foot = interact tile
    useWorldStore.getState().reset();
  });
});
