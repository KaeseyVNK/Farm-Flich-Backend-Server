// Beach MAX (40×26) — single source of truth for the resort coast.
// zones/beach.ts consumes BEACH_COLS/BEACH_ROWS; ZoneSceneryRenderer draws
// BEACH_SCENERY.placements; worldStore collides on isSolid.
//
// Layout logic (human-gate round 1 — "arrangement must be logical"):
// sea across rows 0–5 with the plank pier corridor (cols 19–21, terrain PATH)
// running to the mermaid rock; a paved promenade (row 12) from the pier base
// west to the beach club and east to the fishing wharf; beach club = one
// contiguous cluster around the umbrella pair (centroid (12,17) ON the club
// spur); wharf crates/barrel clustered within 3 tiles of Jack (32,13) who
// stands on his own paved spur; volleyball = two lifering net posts with the
// ball mid-way on a court link; coconut palm grove along the dune line
// (wilderness, exempt from prop-context); moai pair far-east landmark;
// dolphins mid-sea + seagull/pelican perched on the pier posts.
import { registerZoneScenery } from "./index";
import type { SpritePlacement, ZoneScenery } from "./types";

/** Beach zone dims — mirrored by src/lib/game/zones/beach.ts. */
export const BEACH_COLS = 40;
export const BEACH_ROWS = 26;

/** Long central pier: plank corridor cols 19–21, rows 0–9 (terrain PATH). */
export const BEACH_PIER = { tx: 19, ty: 0, cols: 3, rows: 10 } as const;

/** Beach-club cluster centroid — must sit on a PATH tile (club spur). */
export const BEACH_CLUB_CENTROID = { x: 12, y: 17 } as const;

/** Jack the retired pirate — wharf props cluster within 3 tiles of him. */
export const BEACH_JACK = { x: 32, y: 13 } as const;

export interface BeachProp {
  key: string;
  tx: number;
  ty: number;
  cols: number;
  rows: number;
}

/** 6 coconut palms (2×3, sway) along the dune line rows 8–10 (off paths). */
export const BEACH_PALMS: readonly BeachProp[] = [
  { key: "obj.beach.coconut", tx: 6, ty: 9, cols: 2, rows: 3 },
  { key: "obj.beach.coconut", tx: 11, ty: 9, cols: 2, rows: 3 },
  { key: "obj.beach.coconut", tx: 16, ty: 9, cols: 2, rows: 3 },
  { key: "obj.beach.coconut", tx: 26, ty: 9, cols: 2, rows: 3 },
  { key: "obj.beach.coconut", tx: 30, ty: 8, cols: 2, rows: 3 },
  { key: "obj.beach.coconut", tx: 36, ty: 8, cols: 2, rows: 3 },
];

interface SolidRect {
  tx: number;
  ty: number;
  cols: number;
  rows: number;
}

const solidRects: SolidRect[] = [];

/** Mark a placement's whole footprint solid (palms, crates, grills, moai). */
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
  opts: { sway?: boolean; depthOffset?: number } = {},
): SpritePlacement {
  return {
    key,
    tx,
    ty,
    cols,
    rows,
    fallbackColor,
    sway: opts.sway,
    depthOffset: opts.depthOffset,
  };
}

const PALM_PLACEMENTS: readonly SpritePlacement[] = BEACH_PALMS.map((p) =>
  solid(placement(p.key, p.tx, p.ty, p.cols, p.rows, 0x4a7c3f, { sway: true })),
);

const PROPS: readonly SpritePlacement[] = [
  // ── West beach club: one cluster around the umbrella pair ──────────────────
  solid(placement("obj.beach.umbrella", 9, 15, 2, 2, 0xd94f4f)),
  solid(placement("obj.beach.umbrella", 12, 15, 2, 2, 0xd94f4f)),
  placement("obj.beach.chair", 9, 17, 1, 1, 0x7fb2d9), // loungers — walkable
  placement("obj.beach.chair", 11, 17, 1, 1, 0x7fb2d9),
  placement("obj.beach.chair", 13, 17, 1, 1, 0x7fb2d9),
  placement("obj.beach.towel", 10, 18, 1, 1, 0xe87fb0), // towels — walkable
  placement("obj.beach.towel", 12, 18, 1, 1, 0xe87fb0),
  solid(placement("obj.beach.grill", 13, 18, 2, 2, 0x555f6b)),
  placement("obj.balloons", 10, 13, 1, 2, 0xe87fb0), // club balloons — walkable
  placement("obj.picnic", 6, 16, 3, 2, 0x8a6d3b), // picnic rug — meadow, walkable

  // ── Volleyball court: lifering net posts + ball mid-way ────────────────────
  placement("obj.beach.lifering", 20, 17, 1, 1, 0xe0a03c), // net post — walkable
  placement("obj.beach.lifering", 22, 17, 1, 1, 0xe0a03c),
  placement("obj.beach.volleyball", 21, 17, 1, 1, 0xf2f2f2), // ball — walkable

  // ── East fishing wharf: crates + barrel clustered around Jack (32,13) ─────
  solid(placement("obj.beach.fishcrate", 29, 11, 2, 2, 0x6d4c2f)),
  solid(placement("obj.beach.fishcrate", 30, 13, 2, 2, 0x6d4c2f)),
  solid(placement("obj.beach.fishcrate", 33, 12, 2, 2, 0x6d4c2f)),
  solid(placement("obj.beach.fishbarrel", 32, 11, 1, 2, 0x8a6d3b)),

  // ── Moai pair far-east (watching the sunrise) ──────────────────────────────
  solid(placement("obj.beach.moai", 37, 20, 2, 3, 0x9aa0a6)),
  solid(placement("obj.beach.moai", 36, 23, 2, 3, 0x9aa0a6)),

  // ── Dolphins mid-sea (green + pink), floating decor over water ────────────
  placement("animal.dolphin.green", 8, 2, 2, 1, 0x3f8f6f, { depthOffset: 40 }),
  placement("animal.dolphin.pink", 30, 3, 2, 1, 0xe88fb8, { depthOffset: 40 }),

  // ── Pier-post birds (non-solid — perched on the plank corridor) ───────────
  placement("animal.seagull", 21, 6, 1, 1, 0xd9d9d9),
  placement("animal.pelican", 19, 4, 1, 1, 0xa0784a),
];

export const BEACH_SCENERY: ZoneScenery = {
  placements: [...PALM_PLACEMENTS, ...PROPS],
  isSolid(tx, ty) {
    return solidRects.some(
      (r) => tx >= r.tx && tx < r.tx + r.cols && ty >= r.ty && ty < r.ty + r.rows,
    );
  },
};

// Self-register so worldStore/ZoneSceneryRenderer resolve "beach" without
// importing this module back (avoids circular imports on the registry index).
registerZoneScenery("beach", BEACH_SCENERY);
