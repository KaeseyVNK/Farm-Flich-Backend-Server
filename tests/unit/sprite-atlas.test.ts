import { describe, it, expect } from "vitest";
import { frameSourceRect } from "../../src/lib/game/assets/sprite-atlas";
import { ASSET_TILE, SCALE } from "../../src/lib/game/constants";

describe("SpriteAtlas frame math", () => {
  it("frameSourceRect frame 0 = (0,0)", () => {
    expect(frameSourceRect(0)).toEqual({ sx: 0, sy: 0 });
  });

  it("frameSourceRect frame N = (N * ASSET_TILE, 0)", () => {
    expect(frameSourceRect(1)).toEqual({ sx: ASSET_TILE, sy: 0 });
    expect(frameSourceRect(3)).toEqual({ sx: ASSET_TILE * 3, sy: 0 });
  });

  it("scale ratio = TILE_SIZE / ASSET_TILE = 3", () => {
    expect(SCALE).toBe(3);
    expect(ASSET_TILE).toBe(16);
  });

  it("frameSourceRect custom frameW", () => {
    expect(frameSourceRect(2, 32)).toEqual({ sx: 64, sy: 0 });
  });
});
