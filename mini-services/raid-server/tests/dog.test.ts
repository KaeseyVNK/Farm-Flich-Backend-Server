import { describe, it, expect } from "bun:test";
import { bfs, lineOfSight, solidFromTerrain } from "../src/dog";
import { MAP_COLS, T } from "../src/constants";

// Terrain 30×22 toàn grass (0), dùng index y*MAP_COLS+x.
const grass = (): number[] => new Array(MAP_COLS * 22).fill(T.GRASS);
const withTile = (terrain: number[], x: number, y: number, t: number) => {
  const out = [...terrain];
  out[y * MAP_COLS + x] = t;
  return out;
};

describe("bfs (660 node grid)", () => {
  it("path thẳng trên grass", () => {
    const s = solidFromTerrain(grass());
    const path = bfs({ x: 5, y: 5 }, { x: 8, y: 5 }, s);
    expect(path).not.toBeNull();
    expect(path![0]).toEqual({ x: 6, y: 5 });
    expect(path![path!.length - 1]).toEqual({ x: 8, y: 5 });
  });
  it("src === dst → path rỗng", () => {
    const s = solidFromTerrain(grass());
    expect(bfs({ x: 5, y: 5 }, { x: 5, y: 5 }, s)).toEqual([]);
  });
  it("null khi dst là tile solid", () => {
    const t = withTile(grass(), 10, 5, T.ROCK);
    const s = solidFromTerrain(t);
    expect(bfs({ x: 5, y: 5 }, { x: 10, y: 5 }, s)).toBeNull();
  });
  it("đi vòng qua wall", () => {
    // wall dọc tại x=7, y=4..6 → path từ (5,5)→(9,5) phải vòng
    let t = grass();
    for (let y = 4; y <= 6; y++) t = withTile(t, 7, y, T.FENCE);
    const s = solidFromTerrain(t);
    const path = bfs({ x: 5, y: 5 }, { x: 9, y: 5 }, s);
    expect(path).not.toBeNull();
    // không bước qua tile solid
    expect(path!.every((p) => !s(p.x, p.y))).toBe(true);
    expect(path![path!.length - 1]).toEqual({ x: 9, y: 5 });
  });
  it("out of bounds = solid → null khi dst ngoài map", () => {
    const s = solidFromTerrain(grass());
    expect(bfs({ x: 0, y: 0 }, { x: -1, y: 0 }, s)).toBeNull();
  });
});

describe("lineOfSight (Bresenham)", () => {
  it("clear trên grass", () => {
    const s = solidFromTerrain(grass());
    expect(lineOfSight({ x: 1, y: 1 }, { x: 5, y: 5 }, s)).toBe(true);
  });
  it("blocked khi wall giữa 2 điểm", () => {
    let t = grass();
    t = withTile(t, 3, 1, T.TREE);
    const s = solidFromTerrain(t);
    expect(lineOfSight({ x: 1, y: 1 }, { x: 5, y: 1 }, s)).toBe(false);
  });
  it("clear khi wall ở chính dst (không check đích)", () => {
    let t = grass();
    t = withTile(t, 5, 1, T.TREE);
    const s = solidFromTerrain(t);
    expect(lineOfSight({ x: 1, y: 1 }, { x: 5, y: 1 }, s)).toBe(true);
  });
});
