// Task 4 — Village MAX 40×28 layout contract tests.
// Plaza corridor cols 19–23 must stay free of buildings; landmark props are
// solid; market gap walkable; everything in-bounds; warp approach clear.
// Human-gate round 1: door approaches are PATH + paved-reachable from spawn,
// market carts line one row with even gaps, playground is one contiguous
// cluster, lamps sit on the corridor edge, nothing floats off the paths.
import { describe, it, expect } from "vitest";
import {
  VILLAGE_HOUSES,
  VILLAGE_DOOR_TILES,
  VILLAGE_CARTS,
  VILLAGE_PLAYGROUND_CENTROID,
  VILLAGE_SCENERY,
} from "../../src/lib/game/scenery/village-layout";
import { getZoneScenery } from "../../src/lib/game/scenery";
import { VILLAGE_ZONE } from "../../src/lib/game/zones/village";
import { T } from "../../src/lib/game/constants";

const COLS = 40;
const ROWS = 28;

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

describe("village buildings", () => {
  it("7 buildings, plaza corridor cols 19-23 clear of buildings", () => {
    expect(VILLAGE_HOUSES).toHaveLength(7);
    for (const h of VILLAGE_HOUSES) {
      const overlaps = h.tx < 24 && h.tx + h.cols > 19;
      expect(overlaps).toBe(false);
    }
  });

  it("all buildings in-bounds for 40x28 and non-overlapping", () => {
    for (const h of VILLAGE_HOUSES) {
      expect(h.tx).toBeGreaterThanOrEqual(0);
      expect(h.ty).toBeGreaterThanOrEqual(0);
      expect(h.tx + h.cols).toBeLessThanOrEqual(COLS);
      expect(h.ty + h.rows).toBeLessThanOrEqual(ROWS);
      expect(VILLAGE_SCENERY.isSolid(h.tx, h.ty)).toBe(true);
    }
    for (let i = 0; i < VILLAGE_HOUSES.length; i++) {
      for (let j = i + 1; j < VILLAGE_HOUSES.length; j++) {
        expect(rectsOverlap(VILLAGE_HOUSES[i], VILLAGE_HOUSES[j])).toBe(false);
      }
    }
  });
});

describe("village scenery solidity", () => {
  it("fountain + oldtree solid; between-carts gap walkable", () => {
    expect(VILLAGE_SCENERY.isSolid(21, 15)).toBe(true); // fountain
    expect(VILLAGE_SCENERY.isSolid(20, 7)).toBe(true); // old tree
    expect(VILLAGE_SCENERY.isSolid(20, 22)).toBe(false); // market gap
  });

  it("all placements in-bounds 40x28", () => {
    for (const p of VILLAGE_SCENERY.placements) {
      expect(p.tx).toBeGreaterThanOrEqual(0);
      expect(p.ty).toBeGreaterThanOrEqual(0);
      expect(p.tx + p.cols).toBeLessThanOrEqual(COLS);
      expect(p.ty + p.rows).toBeLessThanOrEqual(ROWS);
    }
  });

  it("solid placements never overlap each other's footprints", () => {
    const solidRects = VILLAGE_SCENERY.placements
      .filter((p) => VILLAGE_SCENERY.isSolid(p.tx, p.ty))
      .map((p) => ({ tx: p.tx, ty: p.ty, cols: p.cols, rows: p.rows }));
    for (let i = 0; i < solidRects.length; i++) {
      for (let j = i + 1; j < solidRects.length; j++) {
        expect(rectsOverlap(solidRects[i], solidRects[j])).toBe(false);
      }
    }
  });

  it("west warp tile and its approach row are clear of props", () => {
    expect(VILLAGE_SCENERY.isSolid(1, 13)).toBe(false); // warp tile
    for (let col = 0; col <= 5; col++) {
      expect(VILLAGE_SCENERY.isSolid(col, 13)).toBe(false);
    }
  });

  it("pets placed as non-solid animal sprites", () => {
    const keys = VILLAGE_SCENERY.placements.map((p) => p.key);
    expect(keys).toContain("animal.cat");
    expect(keys).toContain("animal.dog");
    for (const p of VILLAGE_SCENERY.placements) {
      if (p.key === "animal.cat" || p.key === "animal.dog") {
        expect(VILLAGE_SCENERY.isSolid(p.tx, p.ty)).toBe(false);
      }
    }
  });

  it("registered in the zone scenery registry", () => {
    expect(getZoneScenery("village")).toBe(VILLAGE_SCENERY);
  });
});

describe("village zone binding", () => {
  it("40x28, spawn (5,13), west warp to farm labelled VỀ TRẠI", () => {
    expect(VILLAGE_ZONE.cols).toBe(40);
    expect(VILLAGE_ZONE.rows).toBe(28);
    expect(VILLAGE_ZONE.terrain).toHaveLength(40 * 28);
    expect(VILLAGE_ZONE.spawn).toEqual({ x: 5, y: 13 });
    const warp = VILLAGE_ZONE.warps.find((w) => w.x === 1 && w.y === 13);
    expect(warp).toBeDefined();
    expect(warp!.to).toBe("farm");
    expect(warp!.spawn).toEqual({ x: 37, y: 22 });
    expect(warp!.label).toBe("VỀ TRẠI");
  });

  it("NPC homes at forge/kitchen doors", () => {
    const alaric = VILLAGE_ZONE.npcs.find((n) => n.id === "alaric");
    const gaston = VILLAGE_ZONE.npcs.find((n) => n.id === "gaston");
    expect(alaric).toEqual({ id: "alaric", x: 10, y: 15 });
    expect(gaston).toEqual({ id: "gaston", x: 33, y: 15 });
  });
});

// ─── Human-gate round 1: layout-logic rubric ──────────────────────────────────

const PATH_TILES: Array<[number, number]> = [];
for (let y = 0; y < ROWS; y++) {
  for (let x = 0; x < COLS; x++) {
    if (VILLAGE_ZONE.terrain[y * COLS + x] === T.PATH) PATH_TILES.push([x, y]);
  }
}

/** BFS over PAVED tiles only (PATH terrain, not scenery-solid) from spawn. */
function reachablePaved(): Set<string> {
  const seen = new Set<string>();
  const queue: Array<[number, number]> = [[VILLAGE_ZONE.spawn.x, VILLAGE_ZONE.spawn.y]];
  seen.add(`${VILLAGE_ZONE.spawn.x},${VILLAGE_ZONE.spawn.y}`);
  while (queue.length) {
    const [x, y] = queue.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      const k = `${nx},${ny}`;
      if (seen.has(k)) continue;
      if (VILLAGE_ZONE.terrain[ny * COLS + nx] !== T.PATH) continue;
      if (VILLAGE_SCENERY.isSolid(nx, ny)) continue;
      seen.add(k);
      queue.push([nx, ny]);
    }
  }
  return seen;
}

/** Euclidean distance from a tile to the nearest PATH tile. */
function distToPath(x: number, y: number): number {
  let best = Infinity;
  for (const [px, py] of PATH_TILES) {
    const d = Math.hypot(px - x, py - y);
    if (d < best) best = d;
  }
  return best;
}

describe("village layout logic (human-gate round 1)", () => {
  it("every building door approach is PATH and paved-reachable from spawn", () => {
    expect(VILLAGE_DOOR_TILES).toHaveLength(7);
    const reach = reachablePaved();
    for (const door of VILLAGE_DOOR_TILES) {
      expect(VILLAGE_ZONE.terrain[door.y * COLS + door.x]).toBe(T.PATH);
      expect(VILLAGE_SCENERY.isSolid(door.x, door.y)).toBe(false);
      expect(reach.has(`${door.x},${door.y}`)).toBe(true);
    }
  });

  it("resident row shares one south-face row, pairs symmetric about the corridor", () => {
    const residents = VILLAGE_HOUSES.filter((h) => h.ty === 16);
    expect(residents).toHaveLength(4);
    for (const h of residents) expect(h.ty + h.rows).toBe(21);
    const west = residents.filter((h) => h.tx < 19).map((h) => h.tx).sort((a, b) => a - b);
    const east = residents.filter((h) => h.tx > 23).map((h) => h.tx).sort((a, b) => b - a);
    // Plaza axis ≈ col 21: mirror tx ↔ 42−tx−cols, tolerate ±1.
    west.forEach((tx, i) => {
      expect(Math.abs(42 - tx - 6 - east[i])).toBeLessThanOrEqual(1);
    });
  });

  it("market carts line ONE row on the street with even gaps", () => {
    expect(VILLAGE_CARTS).toHaveLength(3);
    const txs = VILLAGE_CARTS.map((c) => c.tx);
    for (const c of VILLAGE_CARTS) {
      // Cart footprint (tx..tx+1, 22..23) sits on market-street PATH terrain.
      for (let dx = 0; dx < 2; dx++)
        for (let dy = 0; dy < 2; dy++)
          expect(VILLAGE_ZONE.terrain[(22 + dy) * COLS + c.tx + dx]).toBe(T.PATH);
    }
    const gaps = [txs[1] - txs[0], txs[2] - txs[1]];
    expect(gaps[0]).toBe(gaps[1]);
    // The plaza-corridor market gap stays walkable (existing contract).
    expect(VILLAGE_SCENERY.isSolid(20, 22)).toBe(false);
  });

  it("newsstand + noticeboard stand ON the market street", () => {
    for (const key of ["obj.newsstand", "obj.noticeboard"]) {
      const p = VILLAGE_SCENERY.placements.find((q) => q.key === key);
      expect(p).toBeDefined();
      expect(VILLAGE_ZONE.terrain[p!.ty * COLS + p!.tx]).toBe(T.PATH);
    }
  });

  it("playground is one contiguous cluster on its lane (centroid ON path)", () => {
    const c = VILLAGE_PLAYGROUND_CENTROID;
    expect(VILLAGE_ZONE.terrain[c.y * COLS + c.x]).toBe(T.PATH);
    expect(VILLAGE_SCENERY.isSolid(c.x, c.y)).toBe(false);
    const props = VILLAGE_SCENERY.placements.filter((p) => p.key.startsWith("obj.playground."));
    expect(props.length).toBeGreaterThanOrEqual(4);
    for (const p of props) {
      const cx = p.tx + (p.cols - 1) / 2;
      const cy = p.ty + (p.rows - 1) / 2;
      expect(Math.hypot(cx - c.x, cy - c.y)).toBeLessThanOrEqual(3);
    }
  });

  it("streetlamps stand on corridor-edge PATH columns at regular intervals", () => {
    const lamps = VILLAGE_SCENERY.placements.filter((p) => p.key === "obj.streetlamp");
    expect(lamps.map((l) => l.ty).sort((a, b) => a - b)).toEqual([10, 10, 20, 20, 26, 26]);
    for (const l of lamps) {
      expect([19, 23]).toContain(l.tx);
      expect(VILLAGE_ZONE.terrain[l.ty * COLS + l.tx]).toBe(T.PATH);
    }
  });

  it("bus bay: bus footprint sits on bay PATH terrain", () => {
    const bus = VILLAGE_SCENERY.placements.find((p) => p.key === "obj.bus");
    expect(bus).toBeDefined();
    for (let dy = 0; dy < bus!.rows; dy++)
      for (let dx = 0; dx < bus!.cols; dx++)
        expect(VILLAGE_ZONE.terrain[(bus!.ty + dy) * COLS + bus!.tx + dx]).toBe(T.PATH);
  });

  it("no prop floats ≥3 tiles from every path (props hug the paved network)", () => {
    for (const p of VILLAGE_SCENERY.placements) {
      let nearest = Infinity;
      for (let dy = 0; dy < p.rows; dy++)
        for (let dx = 0; dx < p.cols; dx++)
          nearest = Math.min(nearest, distToPath(p.tx + dx, p.ty + dy));
      expect(nearest).toBeLessThan(3);
    }
  });
});
