// Task 6 — Cave MAX 32×24 layout contract tests.
// The 5 ore/slime gameplay coords stay put, authored on ROCK nodes (existing
// cozy-zones contract: solid until mined, walkable after) but each must stay
// reachable from spawn; shrine altar + portal solid; portal south neighbors
// walkable (locked-portal teaser); pool water; everything in-bounds 32×24;
// solid footprints never overlap; registered "cave" identity.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  CAVE_SCENERY,
  CAVE_COLS,
  CAVE_ROWS,
  CAVE_PORTAL,
  CAVE_SHRINE_BOUNDS,
  CAVE_CAMP_CENTROID,
} from "../../src/lib/game/scenery/cave-layout";
import { getZoneScenery } from "../../src/lib/game/scenery";
import { CAVE_ZONE } from "../../src/lib/game/zones/cave";
import { FARM_ZONE } from "../../src/lib/game/zones/farm";
import { SOLID_TILES, T } from "../../src/lib/game/constants";
import { useWorldStore } from "@/store/worldStore";

const COLS = 32;
const ROWS = 24;

/** Preserved gameplay coords — ore nodes (task binding: do NOT move). */
const ORE: Array<[number, number]> = [
  [5, 5],
  [8, 6],
  [14, 5],
  [10, 8],
  [16, 9],
];
/** Preserved slime homes. */
const SLIME_TILES: Array<[number, number]> = [
  [6, 10],
  [15, 7],
  [12, 11],
];

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

function terrainSolid(tx: number, ty: number): boolean {
  return SOLID_TILES.has(CAVE_ZONE.terrain[ty * COLS + tx]);
}

function slimeAt(tx: number, ty: number): boolean {
  return CAVE_ZONE.slimes.some((s) => s.x === tx && s.y === ty);
}

/** Fully walkable = open terrain + open scenery + no living slime on top. */
function walkable(tx: number, ty: number): boolean {
  return !terrainSolid(tx, ty) && !CAVE_SCENERY.isSolid(tx, ty) && !slimeAt(tx, ty);
}

/** BFS from the spawn over walkable tiles → set of reachable coords. */
function reachableFromSpawn(): Set<string> {
  const seen = new Set<string>();
  const queue: Array<[number, number]> = [[CAVE_ZONE.spawn.x, CAVE_ZONE.spawn.y]];
  seen.add(`${CAVE_ZONE.spawn.x},${CAVE_ZONE.spawn.y}`);
  while (queue.length) {
    const [x, y] = queue.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      const k = `${nx},${ny}`;
      if (seen.has(k) || !walkable(nx, ny)) continue;
      seen.add(k);
      queue.push([nx, ny]);
    }
  }
  return seen;
}

describe("cave gameplay coords (ore + slimes)", () => {
  it("five ore nodes + three slimes preserved verbatim", () => {
    expect(CAVE_ZONE.rocks.map((r) => [r.x, r.y])).toEqual(ORE);
    expect(CAVE_ZONE.slimes).toEqual([
      { id: "slime-a", x: 6, y: 10 },
      { id: "slime-b", x: 15, y: 7 },
      { id: "slime-c", x: 12, y: 11 },
    ]);
  });

  it("ore nodes authored on ROCK tiles, each with a reachable floor neighbor", () => {
    const reach = reachableFromSpawn();
    for (const [x, y] of ORE) {
      expect(CAVE_ZONE.terrain[y * COLS + x]).toBe(T.ROCK);
      const nbrs: Array<[number, number]> = [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ];
      expect(nbrs.some(([nx, ny]) => reach.has(`${nx},${ny}`))).toBe(true);
    }
  });

  it("ore nodes become walkable once mined (worldStore mine semantics)", () => {
    useWorldStore.getState().reset();
    useWorldStore.getState().enterZone("cave", CAVE_ZONE.spawn);
    try {
      for (const [x, y] of ORE) {
        expect(useWorldStore.getState().mineRock(x, y)).toBe(true);
        expect(useWorldStore.getState().isSolid(x, y)).toBe(false);
      }
    } finally {
      useWorldStore.getState().reset();
      useWorldStore.getState().enterZone("farm", FARM_ZONE.spawn);
    }
  });

  it("slime homes sit on open floor with a reachable approach tile", () => {
    const reach = reachableFromSpawn();
    for (const [x, y] of SLIME_TILES) {
      // open terrain + open scenery (the living slime itself sits here)
      expect(terrainSolid(x, y)).toBe(false);
      expect(CAVE_SCENERY.isSolid(x, y)).toBe(false);
      const nbrs: Array<[number, number]> = [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ];
      expect(nbrs.some(([nx, ny]) => reach.has(`${nx},${ny}`))).toBe(true);
    }
  });

  it("player approach tiles used by cozy interactions stay open ((5,6) mining, (6,11) slime)", () => {
    expect(walkable(5, 6)).toBe(true);
    expect(walkable(6, 11)).toBe(true);
    expect(walkable(11, 13)).toBe(true); // legacy enterZone spawn used in tests
  });
});

describe("cave shrine", () => {
  it("shrine chamber floor is PATH rows 2-8 cols 10-20 (ore nodes excepted)", () => {
    for (let ty = 2; ty <= 8; ty++) {
      for (let tx = 10; tx <= 20; tx++) {
        const isOre = ORE.some(([x, y]) => x === tx && y === ty);
        if (isOre) continue;
        expect(CAVE_ZONE.terrain[ty * COLS + tx]).toBe(T.PATH);
      }
    }
  });

  it("portal is solid across its 3x3 footprint", () => {
    expect(CAVE_PORTAL).toEqual({ tx: 15, ty: 2, cols: 3, rows: 3 });
    for (let dy = 0; dy < 3; dy++)
      for (let dx = 0; dx < 3; dx++)
        expect(CAVE_SCENERY.isSolid(15 + dx, 2 + dy)).toBe(true);
  });

  it("portal south neighbors are walkable and reachable (locked teaser)", () => {
    const reach = reachableFromSpawn();
    for (const [tx, ty] of [[15, 5], [16, 5], [17, 5]]) {
      expect(walkable(tx, ty)).toBe(true);
      expect(reach.has(`${tx},${ty}`)).toBe(true);
    }
  });

  it("altar solid 2x2 at (13,6) — moved off the preserved (14,5) ore node", () => {
    for (let dy = 0; dy < 2; dy++)
      for (let dx = 0; dx < 2; dx++)
        expect(CAVE_SCENERY.isSolid(13 + dx, 6 + dy)).toBe(true);
    // the ore node at (14,5) is NOT covered by any scenery footprint
    expect(CAVE_SCENERY.isSolid(14, 5)).toBe(false);
  });

  it("pillars, broken columns, candle lamps solid", () => {
    for (const [tx, ty] of [[11, 4], [11, 5], [18, 4], [18, 5], [11, 7], [18, 7], [12, 6], [12, 7], [17, 6], [17, 7]]) {
      expect(CAVE_SCENERY.isSolid(tx, ty)).toBe(true);
    }
  });
});

describe("cave camp + gallery scenery", () => {
  it("bonfire + camp lamp solid; chest + mineprops walkable", () => {
    expect(CAVE_SCENERY.isSolid(13, 12)).toBe(true); // bonfire 2x2
    expect(CAVE_SCENERY.isSolid(14, 13)).toBe(true);
    expect(CAVE_SCENERY.isSolid(15, 12)).toBe(false); // chest
    expect(CAVE_SCENERY.isSolid(11, 14)).toBe(false); // mineprops backdrop
    expect(CAVE_SCENERY.isSolid(12, 15)).toBe(false);
    expect(CAVE_SCENERY.isSolid(16, 12)).toBe(true); // camp lamp 1x2
    expect(CAVE_SCENERY.isSolid(16, 13)).toBe(true);
  });

  it("mineral clusters + lavastone solid", () => {
    for (const [tx, ty] of [[23, 5], [26, 8], [24, 12], [28, 15]]) {
      expect(CAVE_SCENERY.isSolid(tx, ty)).toBe(true);
      expect(CAVE_SCENERY.isSolid(tx + 1, ty + 1)).toBe(true); // 2x2 footprint
    }
  });

  it("webs non-solid with depthOffset -20", () => {
    const webs = CAVE_SCENERY.placements.filter((p) => p.key === "obj.cave.web");
    expect(webs).toHaveLength(3);
    for (const w of webs) {
      expect(CAVE_SCENERY.isSolid(w.tx, w.ty)).toBe(false);
      expect(w.depthOffset).toBe(-20);
    }
  });

  it("exit-flanking statues solid, corridor + spawn + warp clear", () => {
    expect(CAVE_SCENERY.isSolid(10, 20)).toBe(true);
    expect(CAVE_SCENERY.isSolid(13, 21)).toBe(true);
    for (let ty = 20; ty <= 23; ty++) expect(CAVE_SCENERY.isSolid(15, ty)).toBe(false);
    expect(CAVE_SCENERY.isSolid(15, 20)).toBe(false); // spawn
    expect(CAVE_SCENERY.isSolid(15, 23)).toBe(false); // warp
  });

  it("all placements in-bounds 32x24", () => {
    expect(CAVE_COLS).toBe(32);
    expect(CAVE_ROWS).toBe(24);
    for (const p of CAVE_SCENERY.placements) {
      expect(p.tx).toBeGreaterThanOrEqual(0);
      expect(p.ty).toBeGreaterThanOrEqual(0);
      expect(p.tx + p.cols).toBeLessThanOrEqual(COLS);
      expect(p.ty + p.rows).toBeLessThanOrEqual(ROWS);
    }
  });

  it("solid placements never overlap each other's footprints", () => {
    const solidRects = CAVE_SCENERY.placements
      .filter((p) => CAVE_SCENERY.isSolid(p.tx, p.ty))
      .map((p) => ({ tx: p.tx, ty: p.ty, cols: p.cols, rows: p.rows }));
    for (let i = 0; i < solidRects.length; i++) {
      for (let j = i + 1; j < solidRects.length; j++) {
        expect(rectsOverlap(solidRects[i], solidRects[j])).toBe(false);
      }
    }
  });

  it("registered in the zone scenery registry", () => {
    expect(getZoneScenery("cave")).toBe(CAVE_SCENERY);
  });
});

describe("cave zone binding", () => {
  it("32x24, spawn (15,20), exit corridor PATH col 15 rows 20-23", () => {
    expect(CAVE_ZONE.cols).toBe(32);
    expect(CAVE_ZONE.rows).toBe(24);
    expect(CAVE_ZONE.terrain).toHaveLength(32 * 24);
    expect(CAVE_ZONE.spawn).toEqual({ x: 15, y: 20 });
    for (let ty = 20; ty <= 23; ty++) {
      expect(CAVE_ZONE.terrain[ty * COLS + 15]).toBe(T.PATH);
    }
  });

  it("warp pair consistent: cave (15,23)→farm(20,9), farm (20,8)→cave(15,20)", () => {
    const warp = CAVE_ZONE.warps.find((w) => w.x === 15 && w.y === 23);
    expect(warp).toBeDefined();
    expect(warp!.to).toBe("farm");
    expect(warp!.spawn).toEqual({ x: 20, y: 9 });
    const farmWarp = FARM_ZONE.warps.find((w) => w.to === "cave");
    expect(farmWarp).toBeDefined();
    expect(farmWarp!.spawn).toEqual({ x: 15, y: 20 });
  });

  it("subterranean pool is WATER cols 3-8 rows 16-19", () => {
    for (let ty = 16; ty <= 19; ty++) {
      for (let tx = 3; tx <= 8; tx++) {
        expect(CAVE_ZONE.terrain[ty * COLS + tx]).toBe(T.WATER);
      }
    }
  });

  it("border walls stay ROCK (2-tile frame, corridor excepted)", () => {
    for (let tx = 0; tx < COLS; tx++) {
      expect(CAVE_ZONE.terrain[0 * COLS + tx]).toBe(T.ROCK);
      expect(CAVE_ZONE.terrain[1 * COLS + tx]).toBe(T.ROCK);
      if (tx !== 15) expect(CAVE_ZONE.terrain[23 * COLS + tx]).toBe(T.ROCK);
    }
    for (let ty = 0; ty < ROWS; ty++) {
      expect(CAVE_ZONE.terrain[ty * COLS + 0]).toBe(T.ROCK);
      expect(CAVE_ZONE.terrain[ty * COLS + 1]).toBe(T.ROCK);
      expect(CAVE_ZONE.terrain[ty * COLS + 30]).toBe(T.ROCK);
      expect(CAVE_ZONE.terrain[ty * COLS + 31]).toBe(T.ROCK);
    }
  });

  it("warp tile reachable from spawn through the corridor", () => {
    const reach = reachableFromSpawn();
    expect(reach.has("15,23")).toBe(true);
  });
});

describe("cave dim floor (farm-scene overlay clamp)", () => {
  beforeEach(() => useWorldStore.getState().enterZone("cave", CAVE_ZONE.spawn));
  afterEach(() => useWorldStore.getState().enterZone("farm", FARM_ZONE.spawn));

  it("zone reports cave while entered", () => {
    expect(useWorldStore.getState().zone).toBe("cave");
  });
});

// ─── Human-gate round 1: layout-logic rubric ──────────────────────────────────

describe("cave layout logic (human-gate round 1)", () => {
  it("miner camp clusters within 3 tiles of its centroid (centroid ON floor)", () => {
    const c = CAVE_CAMP_CENTROID;
    expect(CAVE_ZONE.terrain[c.y * COLS + c.x]).toBe(T.PATH);
    expect(CAVE_SCENERY.isSolid(c.x, c.y)).toBe(false);
    const keys = ["obj.cave.bonfire", "obj.cave.chest", "obj.cave.mineprops", "obj.cave.lamp"];
    const camp = CAVE_SCENERY.placements.filter((p) => keys.includes(p.key) && p.ty >= 10 && p.ty <= 15);
    expect(camp.length).toBe(4);
    for (const p of camp) {
      const cx = p.tx + (p.cols - 1) / 2;
      const cy = p.ty + (p.rows - 1) / 2;
      expect(Math.hypot(cx - c.x, cy - c.y)).toBeLessThanOrEqual(3);
    }
  });

  it("camp centroid is reachable from spawn over walkable floor", () => {
    const reach = reachableFromSpawn();
    expect(reach.has(`${CAVE_CAMP_CENTROID.x},${CAVE_CAMP_CENTROID.y}`)).toBe(true);
  });

  it("every shrine prop sits inside the shrine chamber floor bounds", () => {
    const b = CAVE_SHRINE_BOUNDS;
    const shrine = CAVE_SCENERY.placements.filter((p) => p.key.startsWith("obj.shrine."));
    expect(shrine.length).toBeGreaterThanOrEqual(6);
    for (const p of shrine) {
      expect(p.tx).toBeGreaterThanOrEqual(b.tx);
      expect(p.ty).toBeGreaterThanOrEqual(b.ty);
      expect(p.tx + p.cols).toBeLessThanOrEqual(b.tx + b.cols);
      expect(p.ty + p.rows).toBeLessThanOrEqual(b.ty + b.rows);
    }
    // Candle lamps flank the altar inside the chamber too.
    const lamps = CAVE_SCENERY.placements.filter((p) => p.key === "obj.cave.lamp" && p.ty < 10);
    expect(lamps).toHaveLength(2);
    for (const l of lamps) {
      expect(l.tx).toBeGreaterThanOrEqual(b.tx);
      expect(l.tx).toBeLessThan(b.tx + b.cols);
    }
  });
});
