// FarmEntitySpriteRenderer contract tests for composed display-only NPC avatars.
import { describe, it, expect } from "vitest";
import { FarmEntitySpriteRenderer, type EntityRenderInput } from "../../src/components/game/phaser/farm-entity-sprite-renderer";
import { TILE_SIZE } from "../../src/lib/game/constants";

function fakeScene() {
  const created: Array<{ kind: string; x: number; y: number; depth: number; destroyed: boolean }> = [];
  const scene = {
    add: {
      graphics: () => ({ fillStyle() { return this; }, fillEllipse() { return this; }, fillRect() { return this; } }),
      container: (x: number, y: number) => {
        const avatar = {
          kind: "container", x, y, depth: 0, destroyed: false,
          add() { return this; },
          setDepth(depth: number) { this.depth = depth; return this; },
          destroy() { this.destroyed = true; },
        };
        created.push(avatar);
        return avatar;
      },
    },
    created,
  };
  return scene as unknown as Phaser.Scene & { created: typeof created };
}

const NPC: EntityRenderInput = { id: "bob", tx: 5, ty: 4, color: "#7a5230", glyph: "B" };
const NPC2: EntityRenderInput = { id: "anna", tx: 6, ty: 7, color: "#c0452f", glyph: "A" };

describe("FarmEntitySpriteRenderer (display-only)", () => {
  it("anchors one composed avatar at each NPC home tile", () => {
    const scene = fakeScene();
    const renderer = new FarmEntitySpriteRenderer();
    renderer.render(scene, [NPC]);
    expect(scene.created).toHaveLength(1);
    expect(scene.created[0].x).toBe(5 * TILE_SIZE + TILE_SIZE / 2);
    expect(scene.created[0].y).toBe(4 * TILE_SIZE + TILE_SIZE / 2);
    expect(renderer.count).toBe(1);
  });

  it("sorts avatars by ground contact y", () => {
    const scene = fakeScene();
    const renderer = new FarmEntitySpriteRenderer();
    renderer.render(scene, [NPC, NPC2]);
    expect(scene.created[0].depth).toBe(4 * TILE_SIZE + TILE_SIZE / 2 + 4);
    expect(scene.created[1].depth).toBeGreaterThan(scene.created[0].depth);
  });

  it("rerender and destroy clean old avatar containers", () => {
    const scene = fakeScene();
    const renderer = new FarmEntitySpriteRenderer();
    renderer.render(scene, [NPC]);
    renderer.render(scene, [NPC2]);
    expect(scene.created[0].destroyed).toBe(true);
    expect(scene.created.find((avatar) => !avatar.destroyed)!.x).toBe(6 * TILE_SIZE + TILE_SIZE / 2);
    renderer.destroy();
    expect(scene.created.every((avatar) => avatar.destroyed)).toBe(true);
    expect(renderer.count).toBe(0);
  });
});
