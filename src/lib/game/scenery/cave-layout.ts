// Cave MAX (32×24) — single source of truth for the old mine + hidden shrine.
// zones/cave.ts consumes CAVE_COLS/CAVE_ROWS/CAVE_ORE/CAVE_KEEP_FLOOR;
// ZoneSceneryRenderer draws CAVE_SCENERY.placements; worldStore collides on
// isSolid.
//
// Layout logic: south entry chamber (spawn + exit corridor col 15 rows 20–23,
// flanked by mine statues) opening into a wide middle gallery — miner camp
// (bonfire, chest, mineprops backdrop, lamp) on the gallery floor, preserved
// ore/slime territory west (gameplay coords never move), glowing mineral
// clusters east + lava stone in the far corner, spider webs on the wall
// corners; north = hidden shrine chamber (PATH rows 2–8 cols 10–20): locked
// root portal teaser with candle-lamp rows, altar, pillars, broken columns;
// subterranean pool (T.WATER cols 3–8 rows 16–19) west; cave always dim
// (farm-scene clamps the night overlay to alpha ≥ 0.45, tint 0x10162e).
//
// Deviations from the task-6 brief (each forced by footprint/gameplay logic):
// - altar (13,5)→(13,6): the brief 2×2 footprint (cols 13–14, rows 5–6)
//   covered the preserved ore node at (14,5) — ore coords are gameplay state
//   and must not move, so the altar shifts one row south. It stays centered
//   under the portal between the candle lamps.
// - "slime tiles walkable": the brief wants the 5 ore coords walkable, but
//   the pre-existing cozy-zones contract authors them as T.ROCK nodes (solid
//   until mined — worldStore makes a mined node walkable). Kept authored
//   ROCK; zones/cave.ts guarantees every node keeps a floor neighbor that is
//   BFS-reachable from spawn (verified in tests/unit/cave-layout.test.ts).
import { registerZoneScenery } from "./index";
import type { SpritePlacement, ZoneScenery } from "./types";

/** Cave zone dims — mirrored by src/lib/game/zones/cave.ts. */
export const CAVE_COLS = 32;
export const CAVE_ROWS = 24;

/** Preserved ore-node coords (gameplay state — NEVER move these). */
export const CAVE_ORE: ReadonlyArray<{ x: number; y: number }> = [
  { x: 5, y: 5 },
  { x: 8, y: 6 },
  { x: 14, y: 5 },
  { x: 10, y: 8 },
  { x: 16, y: 9 },
];

/** Locked root portal — shrine teaser (interact comes in a later task). */
export const CAVE_PORTAL = { tx: 15, ty: 2, cols: 3, rows: 3 } as const;

/** Shrine chamber floor bounds — every shrine prop must sit inside. */
export const CAVE_SHRINE_BOUNDS = { tx: 10, ty: 2, cols: 11, rows: 7 } as const;

/** Miner-camp cluster centroid (bonfire/chest/mineprops/lamp within 3 tiles). */
export const CAVE_CAMP_CENTROID = { x: 15, y: 13 } as const;

/**
 * Structural rects the irregular carve in zones/cave.ts must never disturb
 * (shrine floor, connectors, exit corridor, camp floor, slime pockets,
 * statue flanks). Scenery footprints are protected separately there.
 */
export const CAVE_KEEP_FLOOR: readonly {
  tx: number;
  ty: number;
  cols: number;
  rows: number;
}[] = [
  { tx: 10, ty: 2, cols: 11, rows: 7 }, // shrine chamber rows 2–8 cols 10–20
  { tx: 4, ty: 4, cols: 6, rows: 4 }, // west slime gallery (ore ledge)
  { tx: 5, ty: 8, cols: 4, rows: 2 }, // west connector down to the gallery
  { tx: 11, ty: 9, cols: 9, rows: 1 }, // shrine mouth (row 9)
  { tx: 15, ty: 18, cols: 1, rows: 6 }, // exit corridor + spawn approach
  { tx: 10, ty: 10, cols: 10, rows: 6 }, // miner camp floor
  { tx: 5, ty: 9, cols: 3, rows: 3 }, // west slime pocket (6,10)
  { tx: 9, ty: 19, cols: 6, rows: 4 }, // statue flanks by the exit
];

interface SolidRect {
  tx: number;
  ty: number;
  cols: number;
  rows: number;
}

const solidRects: SolidRect[] = [];

/** Mark a placement's whole footprint solid (bonfire, minerals, shrine…). */
function solid(p: SpritePlacement): SpritePlacement {
  solidRects.push({ tx: p.tx, ty: p.ty, cols: p.cols, rows: p.rows });
  return p;
}

function placement(
  key: string,
  tx: number,
  ty: number,
  cols: number,
  rows: number,
  fallbackColor: number,
  opts: { depthOffset?: number } = {},
): SpritePlacement {
  return {
    key,
    tx,
    ty,
    cols,
    rows,
    fallbackColor,
    depthOffset: opts.depthOffset,
  };
}

const PROPS: readonly SpritePlacement[] = [
  // ── Miner camp on the gallery floor (cluster within 3 tiles of (15,13)) ────
  solid(placement("obj.cave.bonfire", 13, 12, 2, 2, 0xd97b29)),
  placement("obj.cave.chest", 15, 12, 1, 1, 0x8a6d3b), // chest — walkable
  placement("obj.cave.mineprops", 12, 14, 3, 2, 0x6b5a4a), // backdrop — walkable
  solid(placement("obj.cave.lamp", 16, 12, 1, 2, 0xe8d9a0)),

  // ── East gallery: glowing mineral clusters + lava stone corner ────────────
  solid(placement("obj.cave.minerals", 23, 5, 2, 2, 0x3fd0c9)),
  solid(placement("obj.cave.minerals2", 26, 8, 2, 2, 0x8f6fd0)),
  solid(placement("obj.cave.minerals", 24, 12, 2, 2, 0x3fd0c9)),
  solid(placement("obj.cave.lavastone", 28, 15, 2, 2, 0xd05a2a)),

  // ── Spider webs on the wall corners (drawn behind the walls) ──────────────
  placement("obj.cave.web", 2, 2, 1, 1, 0xc9c9d9, { depthOffset: -20 }),
  placement("obj.cave.web", 29, 2, 1, 1, 0xc9c9d9, { depthOffset: -20 }),
  placement("obj.cave.web", 2, 21, 1, 1, 0xc9c9d9, { depthOffset: -20 }),

  // ── Hidden shrine (north): locked root portal + stone court ───────────────
  solid(placement("obj.shrine.portal", CAVE_PORTAL.tx, CAVE_PORTAL.ty, CAVE_PORTAL.cols, CAVE_PORTAL.rows, 0x6f4fd0)),
  solid(placement("obj.shrine.altar", 13, 6, 2, 2, 0xb8c9d9)), // see header: moved off (14,5)
  solid(placement("obj.shrine.pillar", 11, 4, 1, 2, 0x9aa8b8)),
  solid(placement("obj.shrine.pillar", 18, 4, 1, 2, 0x9aa8b8)),
  solid(placement("obj.shrine.column.broken", 11, 7, 1, 1, 0x8f8f8f)),
  solid(placement("obj.shrine.column.broken", 18, 7, 1, 1, 0x8f8f8f)),
  solid(placement("obj.cave.lamp", 12, 6, 1, 2, 0xe8d9a0)), // candle-lamp rows
  solid(placement("obj.cave.lamp", 17, 6, 1, 2, 0xe8d9a0)),

  // ── Mine statues flanking the exit corridor (col 15) ──────────────────────
  solid(placement("obj.cave.statue", 10, 20, 1, 2, 0x7d8a99)),
  solid(placement("obj.cave.statue", 13, 21, 1, 2, 0x7d8a99)),
];

export const CAVE_SCENERY: ZoneScenery = {
  placements: [...PROPS],
  isSolid(tx, ty) {
    return solidRects.some(
      (r) => tx >= r.tx && tx < r.tx + r.cols && ty >= r.ty && ty < r.ty + r.rows,
    );
  },
};

// Self-register so worldStore/ZoneSceneryRenderer resolve "cave" without
// importing this module back (avoids circular imports on the registry index).
registerZoneScenery("cave", CAVE_SCENERY);
