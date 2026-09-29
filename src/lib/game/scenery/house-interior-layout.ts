// House interior (16×12) — single source of truth for the furnished cottage.
// zones/house.ts consumes HOUSE_COLS/HOUSE_ROWS; ZoneSceneryRenderer draws
// HOUSE_SCENERY.placements via the generic away-zone path in
// FarmSceneryRenderer (Task 8 — the old graphics drawHouseInterior is
// retired); worldStore.isSolid collides on isSolid for every zone.
//
// Layout logic: sleeping loft west — bed 2×3 against the north wall with the
// bed interact tile (zones/house.ts beds entry) on the bed's south foot at
// (4,3), approached from the carpet; stone hearth centered on the north wall
// (7,1,2×2) with the sofa angled by the west wall (1,5); storage row along
// the north-east wall (closet 10,1 + dresser 12,1) with the kitchen corner
// (kitchenpot 12,4) and a candle at (11,6); dining block (chairs+table
// 6,5,2×2) sits on the woven carpet rug (4,4,4×3 non-solid, depth −1 — the
// rug runs under the table, so it is allowed to overlap the solid dining
// footprint; only solid-vs-solid overlaps are forbidden). South door warp
// at (8,11) with spawn (8,9) — col 8 rows 7–11 stays prop-free.
//
// Deviation from the task-7 brief (forced by gameplay binding):
// - beds interact tile (8,4)→(4,3): the interact entry must sit inside the
//   int.bed footprint (the sleep interaction triggers on the faced bed
//   tile). (4,3) is the bed's south foot, faced from the carpet tile (4,4).
import { registerZoneScenery } from "./index";
import type { SpritePlacement, ZoneScenery } from "./types";

/** House zone dims — mirrored by src/lib/game/zones/house.ts. */
export const HOUSE_COLS = 16;
export const HOUSE_ROWS = 12;

/** Bed 2×3 against the north wall — beds[] interact tile is the south foot. */
export const HOUSE_BED = { tx: 3, ty: 1, cols: 2, rows: 3 } as const;

interface SolidRect {
  tx: number;
  ty: number;
  cols: number;
  rows: number;
}

const solidRects: SolidRect[] = [];

/** Mark a placement's whole footprint solid (bed, hearth, furniture…). */
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
  // ── Sleeping loft west: bed against the north wall ────────────────────────
  solid(placement("int.bed", HOUSE_BED.tx, HOUSE_BED.ty, HOUSE_BED.cols, HOUSE_BED.rows, 0xb8907a)),

  // ── Hearth centered on the north wall; sofa by the west wall ──────────────
  solid(placement("int.fireplace", 7, 1, 2, 2, 0x8f5a3b)),
  solid(placement("int.sofa", 1, 5, 2, 1, 0x7fb2d9)),

  // ── Storage row + kitchen corner along the east wall ──────────────────────
  solid(placement("int.closet", 10, 1, 1, 2, 0x8a6d3b)),
  solid(placement("int.dresser", 12, 1, 1, 1, 0x9a7d4b)),
  solid(placement("int.kitchenpot", 12, 4, 1, 1, 0x555f6b)),

  // ── Dining block centered on the woven carpet rug (rug runs under) ─────────
  solid(placement("int.chairs", 5, 5, 2, 2, 0xc9a06a)),
  placement("int.carpet", 4, 4, 4, 3, 0xa04545, { depthOffset: -1 }), // rug — walkable

  // ── Candles: bedside nook + flanking the hearth (non-solid) ────────────────
  placement("int.candle", 2, 4, 1, 1, 0xe8d9a0),
  placement("int.candle", 6, 2, 1, 1, 0xe8d9a0),
  placement("int.candle", 9, 2, 1, 1, 0xe8d9a0),
];

export const HOUSE_SCENERY: ZoneScenery = {
  placements: [...PROPS],
  isSolid(tx, ty) {
    return solidRects.some(
      (r) => tx >= r.tx && tx < r.tx + r.cols && ty >= r.ty && ty < r.ty + r.rows,
    );
  },
};

// Self-register so worldStore/ZoneSceneryRenderer resolve "house" without
// importing this module back (avoids circular imports on the registry index).
registerZoneScenery("house", HOUSE_SCENERY);
