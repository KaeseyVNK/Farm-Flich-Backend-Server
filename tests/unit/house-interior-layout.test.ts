// Task 7 — House interior (16×12) furnished-cottage layout contract tests.
// Bed 2×3 solid against the north wall with its interact tile inside the
// footprint; hearth + dining block solid; south exit walkway (col 8 up to
// the door warp) and the bed-approach carpet tile walkable; everything
// in-bounds; solid footprints never overlap; registered as "house".
import { describe, it, expect } from "vitest";
import {
  HOUSE_COLS,
  HOUSE_ROWS,
  HOUSE_BED,
  HOUSE_SCENERY,
} from "../../src/lib/game/scenery/house-interior-layout";
import { getZoneScenery } from "../../src/lib/game/scenery";
import { HOUSE_ZONE } from "../../src/lib/game/zones/house";

function rectsOverlap(
  a: { tx: number; ty: number; cols: number; rows: number },
  b: { tx: number; ty: number; cols: number; rows: number },
): boolean {
  return (
    a.tx < b.tx + b.cols &&
    a.tx + a.cols > b.tx &&
    a.ty < b.ty + b.rows &&
    a.ty + a.rows > b.ty
  );
}

describe("house interior scenery", () => {
  it("zone is 16x12 and every placement is in-bounds", () => {
    expect(HOUSE_ZONE.cols).toBe(HOUSE_COLS);
    expect(HOUSE_ZONE.rows).toBe(HOUSE_ROWS);
    for (const p of HOUSE_SCENERY.placements) {
      expect(p.tx).toBeGreaterThanOrEqual(0);
      expect(p.ty).toBeGreaterThanOrEqual(0);
      expect(p.tx + p.cols).toBeLessThanOrEqual(HOUSE_COLS);
      expect(p.ty + p.rows).toBeLessThanOrEqual(HOUSE_ROWS);
    }
  });

  it("bed 2x3 solid against the north wall", () => {
    expect(HOUSE_BED).toEqual({ tx: 3, ty: 1, cols: 2, rows: 3 });
    for (let ty = HOUSE_BED.ty; ty < HOUSE_BED.ty + HOUSE_BED.rows; ty++) {
      for (let tx = HOUSE_BED.tx; tx < HOUSE_BED.tx + HOUSE_BED.cols; tx++) {
        expect(HOUSE_SCENERY.isSolid(tx, ty)).toBe(true);
      }
    }
  });

  it("bed interact tile sits inside the bed footprint", () => {
    expect(HOUSE_ZONE.beds).toHaveLength(1);
    const bed = HOUSE_ZONE.beds[0];
    expect(
      bed.x >= HOUSE_BED.tx &&
        bed.x < HOUSE_BED.tx + HOUSE_BED.cols &&
        bed.y >= HOUSE_BED.ty &&
        bed.y < HOUSE_BED.ty + HOUSE_BED.rows,
    ).toBe(true);
    expect(HOUSE_SCENERY.isSolid(bed.x, bed.y)).toBe(true);
  });

  it("fireplace 2x2 and dining chairs+table 2x2 solid", () => {
    const byKey = (key: string) =>
      HOUSE_SCENERY.placements.filter((p) => p.key === key);
    expect(byKey("int.fireplace")).toEqual([
      { key: "int.fireplace", tx: 7, ty: 1, cols: 2, rows: 2, fallbackColor: expect.any(Number), depthOffset: undefined, sway: undefined },
    ]);
    expect(byKey("int.chairs")).toHaveLength(1);
    const table = byKey("int.chairs")[0];
    expect(table.tx).toBe(5);
    expect(table.ty).toBe(5);
    expect(table.cols).toBe(2);
    expect(table.rows).toBe(2);
    for (const [tx, ty] of [
      [7, 1], [8, 2], // hearth
      [5, 5], [6, 6], // dining block
    ]) {
      expect(HOUSE_SCENERY.isSolid(tx, ty)).toBe(true);
    }
  });

  it("candles + carpet non-solid; carpet under the dining table at depth -1", () => {
    const candles = HOUSE_SCENERY.placements.filter((p) => p.key === "int.candle");
    expect(candles.map((c) => [c.tx, c.ty]).sort()).toEqual([[2, 4], [6, 2], [9, 2]].sort());
    for (const c of candles) expect(HOUSE_SCENERY.isSolid(c.tx, c.ty)).toBe(false);

    const carpet = HOUSE_SCENERY.placements.find((p) => p.key === "int.carpet");
    expect(carpet).toMatchObject({ tx: 4, ty: 4, cols: 4, rows: 3, depthOffset: -1 });
    // Carpet-only tiles walkable (cols 5–6 rows 5–6 are the solid table block).
    for (const [tx, ty] of [[4, 4], [5, 4], [6, 4], [7, 4], [4, 5], [7, 5], [4, 6], [7, 6]]) {
      expect(HOUSE_SCENERY.isSolid(tx, ty)).toBe(false);
    }
  });

  it("south exit walkway clear: col 8 from spawn row to door warp", () => {
    expect(HOUSE_ZONE.spawn).toEqual({ x: 8, y: 9 });
    const warp = HOUSE_ZONE.warps.find((w) => w.x === 8 && w.y === 11);
    expect(warp).toBeDefined();
    for (let ty = 7; ty <= 11; ty++) {
      expect(HOUSE_SCENERY.isSolid(8, ty)).toBe(false);
    }
  });

  it("bed-approach carpet tile (4,4) walkable", () => {
    expect(HOUSE_SCENERY.isSolid(4, 4)).toBe(false);
    expect(HOUSE_SCENERY.isSolid(3, 4)).toBe(false);
  });

  it("solid placements never overlap each other's footprints", () => {
    const solidRects = HOUSE_SCENERY.placements
      .filter((p) => HOUSE_SCENERY.isSolid(p.tx, p.ty))
      .map((p) => ({ tx: p.tx, ty: p.ty, cols: p.cols, rows: p.rows }));
    expect(solidRects.length).toBeGreaterThanOrEqual(6);
    for (let i = 0; i < solidRects.length; i++) {
      for (let j = i + 1; j < solidRects.length; j++) {
        expect(rectsOverlap(solidRects[i], solidRects[j])).toBe(false);
      }
    }
  });

  it("registered in the zone scenery registry as \"house\"", () => {
    expect(getZoneScenery("house")).toBe(HOUSE_SCENERY);
  });
});

// ─── Human-gate round 1: layout-logic rubric ──────────────────────────────────

describe("house layout logic (human-gate round 1)", () => {
  it("dining table+chairs centered ON the carpet rect", () => {
    const carpet = HOUSE_SCENERY.placements.find((p) => p.key === "int.carpet")!;
    const table = HOUSE_SCENERY.placements.find((p) => p.key === "int.chairs")!;
    // 2×2 table inside a 4×3 rug, centered horizontally with a north margin.
    expect(table.tx).toBe(carpet.tx + 1);
    expect(table.ty).toBe(carpet.ty + 1);
    expect(table.tx + table.cols).toBe(carpet.tx + carpet.cols - 1);
  });

  it("candles flank the hearth and the bed — none floating mid-room", () => {
    const candles = HOUSE_SCENERY.placements.filter((p) => p.key === "int.candle");
    const fireplace = HOUSE_SCENERY.placements.find((p) => p.key === "int.fireplace")!;
    const bed = HOUSE_SCENERY.placements.find((p) => p.key === "int.bed")!;
    const adjacentTo = (c: { tx: number; ty: number }, r: { tx: number; ty: number; cols: number; rows: number }) => {
      const dx = Math.max(r.tx - c.tx, c.tx - (r.tx + r.cols - 1), 0);
      const dy = Math.max(r.ty - c.ty, c.ty - (r.ty + r.rows - 1), 0);
      return Math.max(dx, dy) <= 1;
    };
    // Two candles hug the fireplace (west + east flanks), one hugs the bed.
    const hearthCandles = candles.filter((c) => adjacentTo(c, fireplace));
    const bedCandles = candles.filter((c) => adjacentTo(c, bed));
    expect(hearthCandles.length).toBeGreaterThanOrEqual(2);
    expect(bedCandles.length).toBeGreaterThanOrEqual(1);
    for (const c of candles) {
      expect(adjacentTo(c, fireplace) || adjacentTo(c, bed)).toBe(true);
    }
  });

  it("bed approach (4,4) reachable from the spawn over open floor", () => {
    const seen = new Set<string>(["8,9"]);
    const queue: Array<[number, number]> = [[8, 9]];
    while (queue.length) {
      const [x, y] = queue.shift()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 1 || ny < 1 || nx >= HOUSE_COLS - 1 || ny >= HOUSE_ROWS - 1) continue;
        const k = `${nx},${ny}`;
        if (seen.has(k) || HOUSE_SCENERY.isSolid(nx, ny)) continue;
        seen.add(k);
        queue.push([nx, ny]);
      }
    }
    expect(seen.has("4,4")).toBe(true); // bed-approach carpet tile
  });
});
