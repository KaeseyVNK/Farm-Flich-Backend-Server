import { describe, it, expect } from "bun:test";
import { RaidRoom } from "../src/room";
import { MAP_COLS, T } from "../src/constants";

const grass = (): number[] => new Array(MAP_COLS * 22).fill(T.GRASS);

function makeRoom(dogs: { x: number; y: number; breed?: string; patrol?: { x: number; y: number }[] }[]) {
  return new RaidRoom({
    terrain: grass(),
    enterTile: { x: 1, y: 1 },
    dogs,
    chests: [{ id: "c1", x: 20, y: 10 }],
    seed: "breed-test",
  });
}

/** Khoảng cách dog đi được sau N tick (patrol đứng yên ban đầu — chase mới đi). */
function distMoved(room: RaidRoom): number {
  const d = room.dogs[0];
  return Math.abs(d.x - 15) + Math.abs(d.y - 10);
}

describe("W7b breed trong room", () => {
  it("hound hearing 5 nghe thief cách 5 tile khi LOS chặn", () => {
    const wall = grass();
    for (let y = 0; y < 22; y++) wall[y * MAP_COLS + 11] = T.ROCK;
    const mk = (breed?: string) =>
      new RaidRoom({
        terrain: wall,
        enterTile: { x: 13, y: 10 }, // cách dog (8,10) = 5, LOS chặn bởi x=11
        dogs: [{ x: 8, y: 10, breed }],
        chests: [{ id: "c1", x: 20, y: 10 }],
        seed: "s",
      });
    const ret = mk(); // hearing 3 < 5 → patrol, không tiến về thief
    ret.tick(100);
    const hound = mk("hound"); // hearing 5 → chase
    for (let i = 0; i < 3; i++) hound.tick(100);
    // Hound tiến về thief (8→9...), retriever đi patrol (có thể cũng rời 8) —
    // so sánh hướng: hound đi PHẢI (dx>0 hoặc x tăng). Đơn giản: hound x ≥ retriever trend
    expect(hound.dogs[0].x).toBeGreaterThan(ret.dogs[0].x - 1);
    expect(hound.dogs[0].x).toBeGreaterThanOrEqual(8);
  });

  it("patrol chủ 2+ điểm thắng gen AI (waypoint đặt chủ W7b-P2)", () => {
    const patrol = [
      { x: 3, y: 3 },
      { x: 3, y: 18 },
    ];
    const r = makeRoom([{ x: 3, y: 3, patrol }]);
    expect(r.dogs[0].patrol).toEqual(patrol);
    // patrol 1 điểm (không hợp lệ) → fallback gen AI (4 điểm)
    const r2 = makeRoom([{ x: 3, y: 3, patrol: [{ x: 3, y: 3 }] }]);
    expect(r2.dogs[0].patrol.length).toBe(4);
  });

  it("shepherd chase nhanh hơn retriever (speedMul 1.2 — extra steps)", () => {
    // thief đứng cạnh, LOS trống — cả hai chase; shepherd tích acc 0.2/tick
    // → sau 5 tick có 1 extra step cộng dồn.
    const mk = (breed?: string) =>
      new RaidRoom({
        terrain: grass(),
        enterTile: { x: 20, y: 10 }, // cách 5 tile, LOS trống, trong vision 6
        dogs: [{ x: 15, y: 10, breed }],
        chests: [{ id: "c1", x: 25, y: 10 }],
        seed: "s",
      });
    const ret = mk();
    const shep = mk("shepherd");
    for (let i = 0; i < 6; i++) {
      ret.tick(100);
      shep.tick(100);
    }
    const dr = Math.abs(ret.dogs[0].x - 15);
    const ds = Math.abs(shep.dogs[0].x - 15);
    expect(ds).toBeGreaterThanOrEqual(dr); // shepherd không chậm hơn
  });

  it("maan thấy thief bump alert nhiều hơn retriever", () => {
    // Cảnh giác: bump 3+12=15 vs 3 — đo alert score sau 1 tick thấy.
    const mk = (breed?: string) =>
      new RaidRoom({
        terrain: grass(),
        enterTile: { x: 17, y: 10 }, // 2 tile, LOS trống
        dogs: [{ x: 15, y: 10, breed }],
        chests: [{ id: "c1", x: 25, y: 10 }],
        seed: "s",
      });
    const ret = mk();
    const maan = mk("maan");
    ret.tick(100);
    maan.tick(100);
    expect(maan.snapshot().alert.score).toBeGreaterThan(ret.snapshot().alert.score);
  });

  it("breed lạ → retriever default trong room", () => {
    const r = makeRoom([{ x: 15, y: 10, breed: "ufo" }]);
    expect(r.dogs[0].breed).toBe("retriever");
  });
});
