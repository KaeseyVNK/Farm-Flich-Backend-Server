import { describe, expect, it } from "bun:test";
import { TILE_SIZE, MAP_COLS, MAP_ROWS, MAP_AREA } from "../src/constants";

// Phase 3: TILE_SIZE synced 32→48 với client; raid grid GIỮ 30×22 (KHÔNG 60×60).
describe("raid-server constants sync (phase 3)", () => {
  it("TILE_SIZE = 48 (match client phase 3)", () => {
    expect(TILE_SIZE).toBe(48);
  });

  it("raid grid GIỮ 30×22 (KHÔNG farm 60×60)", () => {
    expect(MAP_COLS).toBe(30);
    expect(MAP_ROWS).toBe(22);
    expect(MAP_AREA).toBe(660);
  });

  it("MAP_AREA = COLS × ROWS (drift check)", () => {
    expect(MAP_COLS * MAP_ROWS).toBe(MAP_AREA);
  });
});
