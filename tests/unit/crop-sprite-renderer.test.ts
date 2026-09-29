// CropSpriteRenderer contract test: composed pixel plants remain display-only and
// anchored to the crop's authoritative tile index.
import { describe, it, expect } from "vitest";
import { CropSpriteRenderer } from "../../src/components/game/phaser/crop-sprite-renderer";
import { TILE_SIZE, MAP_COLS } from "../../src/lib/game/constants";
import { CROPS } from "../../src/lib/game/data";

function fakeScene() {
  type RecordedGraphic = {
    x: number; y: number; depth: number; destroyed: boolean; fills: number[]; widths: number[];
    setPosition(x: number, y: number): RecordedGraphic;
    setDepth(d: number): RecordedGraphic;
    fillStyle(fill: number): RecordedGraphic;
    fillRect(_x: number, _y: number, width: number): RecordedGraphic;
    destroy(): void;
  };
  const created: RecordedGraphic[] = [];
  const scene = {
    add: {
      graphics: () => {
        const graphic: RecordedGraphic = {
          x: 0, y: 0, depth: 0, destroyed: false, fills: [], widths: [],
          setPosition(x, y) { this.x = x; this.y = y; return this; },
          setDepth(depth) { this.depth = depth; return this; },
          fillStyle(fill) { this.fills.push(fill); return this; },
          fillRect(_x, _y, width) { this.widths.push(width); return this; },
          destroy() { this.destroyed = true; },
        };
        created.push(graphic);
        return graphic;
      },
    },
    created,
  };
  return scene as unknown as Phaser.Scene & { created: RecordedGraphic[] };
}

const parsnip = CROPS.parsnip;
const idxOf = (tx: number, ty: number) => ty * MAP_COLS + tx;

describe("CropSpriteRenderer (display-only)", () => {
  it("anchors a plant at the authoritative tile center", () => {
    const scene = fakeScene();
    const renderer = new CropSpriteRenderer();
    renderer.render(scene, { [idxOf(10, 9)]: { cropId: "parsnip", stage: 2, dead: false } });
    expect(scene.created[0].x).toBe(10 * TILE_SIZE + TILE_SIZE / 2);
    expect(scene.created[0].y).toBe(9 * TILE_SIZE + TILE_SIZE / 2);
  });

  it("uses ground-contact depth so crops sort below characters on later rows", () => {
    const scene = fakeScene();
    new CropSpriteRenderer().render(scene, { [idxOf(10, 9)]: { cropId: "parsnip", stage: 2, dead: false } });
    expect(scene.created[0].depth).toBe(9 * TILE_SIZE + TILE_SIZE);
  });

  it("grows on the same tile as its stage advances", () => {
    const scene = fakeScene();
    const renderer = new CropSpriteRenderer();
    const idx = idxOf(10, 9);
    renderer.render(scene, { [idx]: { cropId: "parsnip", stage: 0, dead: false } });
    const seedling = scene.created[0];
    renderer.render(scene, { [idx]: { cropId: "parsnip", stage: parsnip.stages - 1, dead: false } });
    const mature = scene.created.find((graphic) => !graphic.destroyed)!;
    expect(Math.max(...mature.widths)).toBeGreaterThan(Math.max(...seedling.widths));
    expect(mature.x).toBe(seedling.x);
    expect(mature.y).toBe(seedling.y);
  });

  it("uses a brown blossom palette for a dead crop", () => {
    const scene = fakeScene();
    new CropSpriteRenderer().render(scene, { [idxOf(10, 9)]: { cropId: "parsnip", stage: 1, dead: true } });
    expect(scene.created[0].fills).toContain(0x8a6238);
  });

  it("skips unknown crop ids without creating a visual", () => {
    const scene = fakeScene();
    const renderer = new CropSpriteRenderer();
    renderer.render(scene, { [idxOf(1, 1)]: { cropId: "no_such_crop", stage: 0, dead: false } });
    expect(scene.created).toHaveLength(0);
    expect(renderer.count).toBe(0);
  });

  it("rerender and destroy clean prior graphics", () => {
    const scene = fakeScene();
    const renderer = new CropSpriteRenderer();
    const idx = idxOf(10, 9);
    renderer.render(scene, { [idx]: { cropId: "parsnip", stage: 2, dead: false } });
    renderer.render(scene, { [idx]: { cropId: "parsnip", stage: 2, dead: false, watered: true } });
    expect(scene.created[0].destroyed).toBe(true);
    renderer.destroy();
    expect(scene.created.every((graphic) => graphic.destroyed)).toBe(true);
    expect(renderer.count).toBe(0);
  });

  it("darkens a watered, not-yet-ready crop without moving it", () => {
    const scene = fakeScene();
    const renderer = new CropSpriteRenderer();
    const idx = idxOf(10, 9);
    renderer.render(scene, { [idx]: { cropId: "parsnip", stage: 1, dead: false, watered: false } });
    const dry = scene.created[0];
    renderer.render(scene, { [idx]: { cropId: "parsnip", stage: 1, dead: false, watered: true } });
    const wet = scene.created.find((graphic) => !graphic.destroyed)!;
    expect(wet.fills).not.toEqual(dry.fills);
    expect(wet.x).toBe(dry.x);
    expect(wet.y).toBe(dry.y);
  });
});
