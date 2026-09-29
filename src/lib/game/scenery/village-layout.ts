// Village MAX (40×28) — single source of truth for market-town landmarks.
// Zones/village.ts consumes VILLAGE_COLS/VILLAGE_ROWS; ZoneSceneryRenderer
// (Task 8) draws VILLAGE_SCENERY.placements; worldStore collides on isSolid.
//
// Layout logic (human-gate round 1 — "arrangement must be logical"):
// grand plaza corridor cols 19–23 (kept clear of buildings), town hall at the
// north-east head with a forecourt reaching its door, forge west + kitchen
// east flanking the corridor on a cross-road at row 14, ONE resident row
// (rows 16–20, four houses) facing the market street (rows 22–24) so every
// door opens onto paved tiles, market carts in a single row with even gaps,
// playground as one contiguous cluster on its own lane in the NW meadow,
// bus bay at the west gate beside the farm warp.
//
// Door-approach contract (tests/unit/village-layout.test.ts): the south-face
// center tile of every building is T.PATH and paved-reachable from the spawn.
import { registerZoneScenery } from "./index";
import type { SpritePlacement, ZoneScenery } from "./types";

/** Village zone dims — mirrored by src/lib/game/zones/village.ts. */
export const VILLAGE_COLS = 40;
export const VILLAGE_ROWS = 28;

export interface VillageBuilding {
  key: string;
  tx: number;
  ty: number;
  cols: number;
  rows: number;
}

/** 7 buildings — none may overlap the plaza corridor cols 19–23. */
export const VILLAGE_HOUSES: readonly VillageBuilding[] = [
  { key: "obj.house.9", tx: 24, ty: 3, cols: 6, rows: 5 }, // town hall (north head)
  { key: "obj.house.2", tx: 7, ty: 9, cols: 6, rows: 5 }, // forge (west flank)
  { key: "obj.house.5", tx: 30, ty: 9, cols: 6, rows: 5 }, // kitchen (east flank)
  { key: "obj.house.3", tx: 5, ty: 16, cols: 6, rows: 5 }, // resident row (west pair)
  { key: "obj.house.4", tx: 12, ty: 16, cols: 6, rows: 5 },
  { key: "obj.house.6", tx: 25, ty: 16, cols: 6, rows: 5 }, // resident row (east pair)
  { key: "obj.house.7", tx: 32, ty: 16, cols: 6, rows: 5 },
];

/** South-face door approach tiles — must be T.PATH and paved-reachable. */
export const VILLAGE_DOOR_TILES: ReadonlyArray<{ x: number; y: number }> =
  VILLAGE_HOUSES.map((h) => ({ x: h.tx + Math.floor(h.cols / 2), y: h.ty + h.rows }));

/** Market carts — one row (ty 22) on the street, even 3-tile gaps. */
export const VILLAGE_CARTS: ReadonlyArray<{ key: string; tx: number }> = [
  { key: "obj.popcorn.cart", tx: 16 },
  { key: "obj.icecream.cart", tx: 21 },
  { key: "obj.cottoncandy.cart", tx: 26 },
];

/** Playground cluster — every prop within 3 tiles of the centroid (7,6). */
export const VILLAGE_PLAYGROUND_CENTROID = { x: 7, y: 6 } as const;

interface SolidRect {
  tx: number;
  ty: number;
  cols: number;
  rows: number;
}

const solidRects: SolidRect[] = [];

/** Mark a placement's whole footprint solid (buildings, carts, big props). */
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
  opts: { sway?: boolean } = {},
): SpritePlacement {
  return { key, tx, ty, cols, rows, fallbackColor, sway: opts.sway };
}

const HOUSE_PLACEMENTS: readonly SpritePlacement[] = VILLAGE_HOUSES.map((h) =>
  solid(placement(h.key, h.tx, h.ty, h.cols, h.rows, 0x8a6d3b)),
);

const CART_PLACEMENTS: readonly SpritePlacement[] = VILLAGE_CARTS.map((c, i) =>
  solid(placement(c.key, c.tx, 22, 2, 2, [0xd9a441, 0xf2c9e0, 0xe87fb0][i])),
);

const PROPS: readonly SpritePlacement[] = [
  // ── Plaza centrepieces ─────────────────────────────────────────────────────
  solid(placement("obj.fountain", 20, 14, 3, 3, 0x3a7ec9)),
  solid(placement("obj.oldtree", 19, 6, 3, 3, 0x4a7c3f, { sway: true })),
  solid(placement("obj.stone.statue", 16, 9, 1, 2, 0x9aa0a6)),
  solid(placement("obj.stone.statue", 25, 9, 1, 2, 0x9aa0a6)),
  // Lamps ON the corridor edge columns (19/23) at regular 10-row intervals.
  solid(placement("obj.streetlamp", 19, 10, 1, 2, 0x555f6b)),
  solid(placement("obj.streetlamp", 23, 10, 1, 2, 0x555f6b)),
  solid(placement("obj.streetlamp", 19, 20, 1, 2, 0x555f6b)),
  solid(placement("obj.streetlamp", 23, 20, 1, 2, 0x555f6b)),
  solid(placement("obj.streetlamp", 19, 26, 1, 2, 0x555f6b)),
  solid(placement("obj.streetlamp", 23, 26, 1, 2, 0x555f6b)),

  // ── Market street (rows 22–24): carts in one row + corner stands ──────────
  ...CART_PLACEMENTS,
  solid(placement("obj.noticeboard", 12, 22, 2, 2, 0x6b4f2e)),
  solid(placement("obj.newsstand", 29, 22, 2, 2, 0x6d4c2f)),
  placement("obj.village.clothesline", 16, 25, 8, 1, 0x7fb2d9), // banners — walkable

  // ── Playground: one contiguous cluster on the NW meadow lane (row 6) ──────
  solid(placement("obj.playground.slide", 5, 3, 2, 3, 0xe0a03c)),
  solid(placement("obj.playground.swing", 7, 3, 3, 2, 0x8b5a2b)),
  solid(placement("obj.playground.seesaw", 4, 7, 2, 1, 0xc06040)),
  placement("obj.playground.sandbox", 8, 7, 2, 2, 0xc8a06a), // sand — walkable

  // ── Gate furniture + bus bay ───────────────────────────────────────────────
  placement("obj.birdhouse", 14, 10, 1, 1, 0x8a6d3b),
  solid(placement("obj.bus", 1, 15, 4, 3, 0x3f6fb5)), // parked clear of warp row 13

  // ── Pets (static sprite data only — roaming AI out of scope) ───────────────
  placement("animal.cat", 32, 15, 1, 1, 0x2b2b2b),
  placement("animal.dog", 30, 21, 1, 1, 0xa0784a),
];

/**
 * W8 — festival overlay (§2/§14): balloons + carts thêm quanh plaza ngày 13/24.
 * Toàn NON-SOLID (decorative, đứng mép walkable) — collision KHÔNG đổi theo lễ
 * (tránh pathing khác giữa ngày thường/lễ + replay không liên quan).
 */
const FESTIVAL_PROPS: readonly SpritePlacement[] = [
  placement("obj.balloons", 14, 8, 2, 1, 0xe87ba0, { sway: true }),
  placement("obj.balloons", 25, 8, 2, 1, 0xe87ba0, { sway: true }),
  placement("obj.balloons", 20, 12, 2, 1, 0xe87ba0, { sway: true }),
  placement("obj.cottoncandy.cart", 13, 11, 2, 2, 0xf2a8c8), // x13-14: ngay mép đông forge (7-12) — không đè solid
  placement("obj.popcorn.cart", 27, 11, 2, 2, 0xe8c078),
  placement("obj.icecream.cart", 20, 20, 2, 2, 0xbfe4f0),
  placement("obj.village.clothesline", 19, 24, 6, 1, 0xd9694e),
];

/** Festival switch — farm-scene set theo isFestivalDay trước khi render village. */
let festivalOn = false;
export function enableVillageFestival(enabled: boolean): void {
  festivalOn = enabled;
}
export function isVillageFestivalOn(): boolean {
  return festivalOn;
}

export const VILLAGE_SCENERY: ZoneScenery = {
  // W8: placements là getter — festival bật/tắt không cần re-register.
  get placements() {
    return festivalOn
      ? [...HOUSE_PLACEMENTS, ...PROPS, ...FESTIVAL_PROPS]
      : [...HOUSE_PLACEMENTS, ...PROPS];
  },
  isSolid(tx, ty) {
    return solidRects.some(
      (r) => tx >= r.tx && tx < r.tx + r.cols && ty >= r.ty && ty < r.ty + r.rows,
    );
  },
};

// Self-register so worldStore/ZoneSceneryRenderer resolve "village" without
// importing this module back (avoids circular imports on the registry index).
registerZoneScenery("village", VILLAGE_SCENERY);
