// Task 5 — Beach MAX 40×26 layout contract tests.
// Pier corridor cols 19–21 rows 0–9 must stay walkable (plank PATH carves
// the sea); palm trunks solid; dolphins non-solid in the sea; everything
// in-bounds; solid footprints never overlap; warp approach clear.
// Human-gate round 1: paved promenade links spawn → club / wharf / pier,
// club + wharf props form tight clusters, volleyball posts flank the ball.
import { describe, it, expect } from "vitest";
import {
  BEACH_PIER,
  BEACH_PALMS,
  BEACH_CLUB_CENTROID,
  BEACH_JACK,
  BEACH_SCENERY,
} from "../../src/lib/game/scenery/beach-layout";
import { getZoneScenery } from "../../src/lib/game/scenery";
import { BEACH_ZONE } from "../../src/lib/game/zones/beach";
import { NPCS } from "../../src/lib/game/data";
import { SOLID_TILES, T } from "../../src/lib/game/constants";

const COLS = 40;
const ROWS = 26;

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

describe("beach pier", () => {
  it("pier corridor walkable, sea solid off-pier", () => {
    for (let ty = 0; ty <= 9; ty++) for (let tx = 19; tx <= 21; tx++)
      expect(BEACH_SCENERY.isSolid(tx, ty)).toBe(false);
    expect(BEACH_SCENERY.isSolid(5, 2)).toBe(false); // sea handled by T.WATER terrain solid
  });

  it("pier corridor carved as plank PATH through WATER rows 0-5", () => {
    expect(BEACH_PIER).toEqual({ tx: 19, ty: 0, cols: 3, rows: 10 });
    for (let ty = 0; ty <= 9; ty++) {
      expect(BEACH_ZONE.terrain[ty * COLS + 20]).toBe(T.PATH);
    }
    expect(BEACH_ZONE.terrain[2 * COLS + 5]).toBe(T.WATER); // off-pier sea
    expect(BEACH_ZONE.terrain[0 * COLS + 0]).toBe(T.WATER);
  });
});

describe("beach scenery solidity", () => {
  it("palm trunks solid (2x3 footprints)", () => {
    expect(BEACH_PALMS).toHaveLength(6);
    for (const p of BEACH_PALMS) {
      expect(BEACH_SCENERY.isSolid(p.tx, p.ty + 2)).toBe(true); // trunk base
      expect(BEACH_SCENERY.isSolid(p.tx, p.ty)).toBe(true);
    }
  });

  it("dolphins non-solid in the sea, seagull/pelican non-solid on pier posts", () => {
    const byKey = BEACH_SCENERY.placements.filter((p) => p.key.startsWith("animal.dolphin"));
    expect(byKey).toHaveLength(2);
    for (const p of byKey) {
      expect(BEACH_SCENERY.isSolid(p.tx, p.ty)).toBe(false);
      expect(p.depthOffset).toBe(40);
      expect(p.ty).toBeLessThanOrEqual(5); // mid-sea
    }
    for (const key of ["animal.seagull", "animal.pelican"]) {
      const bird = BEACH_SCENERY.placements.find((p) => p.key === key);
      expect(bird).toBeDefined();
      expect(BEACH_SCENERY.isSolid(bird!.tx, bird!.ty)).toBe(false);
    }
  });

  it("wharf crates/barrels + grill + moai solid; jack's wharf tile clear", () => {
    for (const [tx, ty] of [[29, 11], [30, 13], [33, 12], [32, 11], [13, 18], [37, 20], [36, 23]]) {
      expect(BEACH_SCENERY.isSolid(tx, ty)).toBe(true);
    }
    expect(BEACH_SCENERY.isSolid(32, 13)).toBe(false); // Jack stands here
  });

  it("all placements in-bounds 40x26", () => {
    for (const p of BEACH_SCENERY.placements) {
      expect(p.tx).toBeGreaterThanOrEqual(0);
      expect(p.ty).toBeGreaterThanOrEqual(0);
      expect(p.tx + p.cols).toBeLessThanOrEqual(COLS);
      expect(p.ty + p.rows).toBeLessThanOrEqual(ROWS);
    }
  });

  it("solid placements never overlap each other's footprints", () => {
    const solidRects = BEACH_SCENERY.placements
      .filter((p) => BEACH_SCENERY.isSolid(p.tx, p.ty))
      .map((p) => ({ tx: p.tx, ty: p.ty, cols: p.cols, rows: p.rows }));
    for (let i = 0; i < solidRects.length; i++) {
      for (let j = i + 1; j < solidRects.length; j++) {
        expect(rectsOverlap(solidRects[i], solidRects[j])).toBe(false);
      }
    }
  });

  it("warp tile and pier-base spawn approach clear of props", () => {
    expect(BEACH_SCENERY.isSolid(20, 11)).toBe(false); // warp tile
    expect(BEACH_SCENERY.isSolid(20, 12)).toBe(false); // spawn tile
    expect(BEACH_SCENERY.isSolid(20, 10)).toBe(false); // pier base approach
  });

  it("registered in the zone scenery registry", () => {
    expect(getZoneScenery("beach")).toBe(BEACH_SCENERY);
  });
});

describe("beach zone binding", () => {
  it("40x26, spawn (20,12), south warp to farm labelled VỀ TRẠI", () => {
    expect(BEACH_ZONE.cols).toBe(40);
    expect(BEACH_ZONE.rows).toBe(26);
    expect(BEACH_ZONE.terrain).toHaveLength(40 * 26);
    expect(BEACH_ZONE.spawn).toEqual({ x: 20, y: 12 });
    const warp = BEACH_ZONE.warps.find((w) => w.x === 20 && w.y === 11);
    expect(warp).toBeDefined();
    expect(warp!.to).toBe("farm");
    expect(warp!.spawn).toEqual({ x: 20, y: 57 });
    expect(warp!.label).toBe("VỀ TRẠI");
  });

  it("elyria at pier end, jack at wharf", () => {
    expect(BEACH_ZONE.npcs).toContainEqual({ id: "elyria", x: 20, y: 1 });
    expect(BEACH_ZONE.npcs).toContainEqual({ id: "jack", x: 32, y: 13 });
  });
});

describe("jack NPC data", () => {
  it("exists in NPCS with wharf home and static schedule", () => {
    const jack = NPCS.jack;
    expect(jack).toBeDefined();
    expect(jack.id).toBe("jack");
    expect(jack.name).toBe("Jack");
    expect(jack.role).toBe("Cướp biển nghỉ hưu");
    expect(jack.home).toEqual({ x: 32, y: 13 });
    expect(jack.dialogue.length).toBeGreaterThanOrEqual(3);
    for (const sp of jack.schedulePoints) {
      expect(sp).toMatchObject({ x: 32, y: 13, label: "Wharf" });
    }
  });
});

// ─── Human-gate round 1: layout-logic rubric ──────────────────────────────────

/** BFS over PAVED tiles only (PATH terrain, not scenery-solid) from spawn. */
function reachablePaved(): Set<string> {
  const seen = new Set<string>();
  const queue: Array<[number, number]> = [[BEACH_ZONE.spawn.x, BEACH_ZONE.spawn.y]];
  seen.add(`${BEACH_ZONE.spawn.x},${BEACH_ZONE.spawn.y}`);
  while (queue.length) {
    const [x, y] = queue.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      const k = `${nx},${ny}`;
      if (seen.has(k)) continue;
      if (BEACH_ZONE.terrain[ny * COLS + nx] !== T.PATH) continue;
      if (BEACH_SCENERY.isSolid(nx, ny)) continue;
      seen.add(k);
      queue.push([nx, ny]);
    }
  }
  return seen;
}

const PATH_TILES: Array<[number, number]> = [];
for (let y = 0; y < ROWS; y++) {
  for (let x = 0; x < COLS; x++) {
    if (BEACH_ZONE.terrain[y * COLS + x] === T.PATH) PATH_TILES.push([x, y]);
  }
}

function distToPath(x: number, y: number): number {
  let best = Infinity;
  for (const [px, py] of PATH_TILES) {
    const d = Math.hypot(px - x, py - y);
    if (d < best) best = d;
  }
  return best;
}

/** Wilderness/landmark props exempt from the no-floating rule. */
const EXEMPT_FLOAT = new Set([
  "obj.beach.coconut", // dune grove (trees)
  "obj.beach.moai", // far-east landmark pair
  "obj.picnic", // deliberate meadow rug
  "animal.dolphin.green", // mid-sea decor
  "animal.dolphin.pink",
]);

describe("beach layout logic (human-gate round 1)", () => {
  it("paved route spawn → pier end, club centroid, Jack, volleyball ball", () => {
    const reach = reachablePaved();
    expect(reach.has("20,1")).toBe(true); // pier end (elyria)
    expect(reach.has(`${BEACH_CLUB_CENTROID.x},${BEACH_CLUB_CENTROID.y}`)).toBe(true);
    expect(reach.has(`${BEACH_JACK.x},${BEACH_JACK.y}`)).toBe(true);
    expect(reach.has("21,17")).toBe(true); // volleyball ball tile
  });

  it("beach-club props cluster within 3 tiles of the centroid (centroid ON path)", () => {
    const c = BEACH_CLUB_CENTROID;
    expect(BEACH_ZONE.terrain[c.y * COLS + c.x]).toBe(T.PATH);
    expect(BEACH_SCENERY.isSolid(c.x, c.y)).toBe(false);
    const keys = ["obj.beach.umbrella", "obj.beach.chair", "obj.beach.towel", "obj.beach.grill"];
    const props = BEACH_SCENERY.placements.filter((p) => keys.includes(p.key));
    expect(props.length).toBeGreaterThanOrEqual(8);
    for (const p of props) {
      const cx = p.tx + (p.cols - 1) / 2;
      const cy = p.ty + (p.rows - 1) / 2;
      expect(Math.hypot(cx - c.x, cy - c.y)).toBeLessThanOrEqual(3);
    }
  });

  it("wharf crates/barrels cluster within 3 tiles of Jack, Jack stands on PATH", () => {
    expect(BEACH_ZONE.terrain[BEACH_JACK.y * COLS + BEACH_JACK.x]).toBe(T.PATH);
    const keys = ["obj.beach.fishcrate", "obj.beach.fishbarrel"];
    const props = BEACH_SCENERY.placements.filter((p) => keys.includes(p.key));
    expect(props.length).toBeGreaterThanOrEqual(4);
    for (const p of props) {
      const cx = p.tx + (p.cols - 1) / 2;
      const cy = p.ty + (p.rows - 1) / 2;
      expect(Math.hypot(cx - BEACH_JACK.x, cy - BEACH_JACK.y)).toBeLessThanOrEqual(3);
    }
  });

  it("volleyball: two lifering net posts with the ball mid-way on the court", () => {
    const posts = BEACH_SCENERY.placements.filter((p) => p.key === "obj.beach.lifering");
    expect(posts).toHaveLength(2);
    expect(posts[0].ty).toBe(posts[1].ty);
    expect(Math.abs(posts[0].tx - posts[1].tx)).toBe(2); // 3-tile span
    const ball = BEACH_SCENERY.placements.find((p) => p.key === "obj.beach.volleyball");
    expect(ball).toBeDefined();
    expect(ball!.ty).toBe(posts[0].ty);
    expect(ball!.tx).toBe((posts[0].tx + posts[1].tx) / 2); // exactly mid-way
    expect(BEACH_ZONE.terrain[ball!.ty * COLS + ball!.tx]).toBe(T.PATH);
  });

  it("pier birds perched ON pier-corridor PATH tiles", () => {
    for (const key of ["animal.seagull", "animal.pelican"]) {
      const bird = BEACH_SCENERY.placements.find((p) => p.key === key);
      expect(bird).toBeDefined();
      expect(BEACH_ZONE.terrain[bird!.ty * COLS + bird!.tx]).toBe(T.PATH);
    }
  });

  it("palms stay off the paved rows (dune grove, none on row-12 promenade)", () => {
    for (const palm of BEACH_PALMS) {
      expect(palm.ty + palm.rows).toBeLessThanOrEqual(12);
    }
  });

  it("no non-exempt prop floats ≥3 tiles from every path", () => {
    for (const p of BEACH_SCENERY.placements) {
      if (EXEMPT_FLOAT.has(p.key)) continue;
      let nearest = Infinity;
      for (let dy = 0; dy < p.rows; dy++)
        for (let dx = 0; dx < p.cols; dx++)
          nearest = Math.min(nearest, distToPath(p.tx + dx, p.ty + dy));
      expect(nearest).toBeLessThan(3);
    }
  });

  it("sea stays solid off the pier (terrain walkability contract)", () => {
    expect(SOLID_TILES.has(BEACH_ZONE.terrain[3 * COLS + 5])).toBe(true);
    expect(SOLID_TILES.has(BEACH_ZONE.terrain[0 * COLS + 0])).toBe(true);
  });
});
