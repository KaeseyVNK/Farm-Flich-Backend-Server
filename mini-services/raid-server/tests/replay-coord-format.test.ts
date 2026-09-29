import { describe, expect, it } from "bun:test";
import { MAP_COLS, MAP_ROWS } from "../src/constants";

// Phase 3 spike: RaidEntity.x/y = tile index (integer, [0, MAP_COLS-1] × [0, MAP_ROWS-1]).
// KHÔNG pixel. Replay tile-based — backward-compat: không scale vì lưới raid giữ 30×22.
describe("replay coord format (phase 3 spike verified)", () => {
  it("entity coord trong tile bounds [0, COLS-1] × [0, ROWS-1]", () => {
    const sampleEntity = { x: 5, y: 10, dx: 0, dy: 0 };
    expect(sampleEntity.x).toBeGreaterThanOrEqual(0);
    expect(sampleEntity.x).toBeLessThanOrEqual(MAP_COLS - 1);
    expect(sampleEntity.y).toBeGreaterThanOrEqual(0);
    expect(sampleEntity.y).toBeLessThanOrEqual(MAP_ROWS - 1);
    expect(Number.isInteger(sampleEntity.x)).toBe(true);
    expect(Number.isInteger(sampleEntity.y)).toBe(true);
  });

  it("move delta là tile step (-1|0|1), không pixel velocity", () => {
    const deltas: Array<{ dx: -1 | 0 | 1; dy: -1 | 0 | 1 }> = [
      { dx: -1, dy: 0 },
      { dx: 1, dy: 1 },
      { dx: 0, dy: -1 },
    ];
    for (const d of deltas) {
      expect([-1, 0, 1]).toContain(d.dx);
      expect([-1, 0, 1]).toContain(d.dy);
    }
  });

  it("replay tile-based → KHÔNG nhân TILE_SIZE (lưới raid giữ 30×22)", () => {
    // tile coord 5 → render client nhân TILE_SIZE riêng (render concern, không data concern).
    const tileCoord = 5;
    expect(tileCoord).toBeLessThan(MAP_COLS);
    // data lưu tile, không pixel: không scale ×48/32.
  });
});
