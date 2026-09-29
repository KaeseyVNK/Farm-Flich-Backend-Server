import { describe, it, expect } from "bun:test";
import { RaidRoom } from "../src/room";
import { MAP_COLS, T } from "../src/constants";

/**
 * W7d-P1: guard-rep ≥ 50 (owner) → RaidRoom guardBonus → dog vision +1 tile.
 * Test hành vi: dog level 1 vision 6 — thief ở dist 7 (ngoài tầm, LOS trống,
 * ngoài hearing 3): không guard → không bump alert; có guard (+1 = 7) → thấy + bump 3.
 */

const grass = (): number[] => new Array(MAP_COLS * 22).fill(T.GRASS);

function makeRoom(guardBonus: boolean): RaidRoom {
  // Dog (1,1) — thief enter (1,8): cùng cột dist 7, terrain trống → LOS clear.
  return new RaidRoom({
    terrain: grass(),
    enterTile: { x: 1, y: 8 },
    dogs: [{ x: 1, y: 1 }],
    chests: [{ id: "c1", x: 20, y: 10 }],
    seed: "guard-bonus-test",
    guardBonus,
  });
}

describe("RaidRoom guardBonus (W7d-P1)", () => {
  it("mặc định tắt — vision 6, dist 7: dog KHÔNG thấy (alert không bump)", () => {
    const r = makeRoom(false);
    r.tick(100);
    expect(r.alert.score).toBe(0);
  });

  it("guardBonus → vision +1 = 7: dog THẤY thief dist 7 (bump 3)", () => {
    const r = makeRoom(true);
    r.tick(100);
    expect(r.alert.score).toBeGreaterThan(0);
  });

  it("guardBonus không đổi hearing (dist 7 > hearing 3: vẫn chỉ vision", () => {
    // Cả 2 phòng hearing như nhau — khác biệt chỉ đến từ vision (+1).
    const a = makeRoom(false);
    const b = makeRoom(true);
    a.tick(100);
    b.tick(100);
    expect(b.alert.score).toBe(a.alert.score + 3);
  });
});
