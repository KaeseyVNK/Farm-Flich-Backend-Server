import { T } from "@/lib/game/constants";
import {
  CAVE_COLS,
  CAVE_ROWS,
  CAVE_KEEP_FLOOR,
  CAVE_ORE,
  CAVE_SCENERY,
} from "@/lib/game/scenery/cave-layout";
import { fillTerrain, stampRect, zoneIdx, type ZoneLayout } from "./types";

/** Deterministic seed for per-tile variety — same values every build. */
function tileSeed(col: number, row: number): number {
  return Math.abs((col * 92821 + row * 68917 + 37) % 997);
}

/** Structural rects + every scenery footprint the carve must leave alone. */
const KEEP_RECTS = [
  ...CAVE_KEEP_FLOOR,
  ...CAVE_SCENERY.placements.map((p) => ({
    tx: p.tx,
    ty: p.ty,
    cols: p.cols,
    rows: p.rows,
  })),
];

function keep(tx: number, ty: number): boolean {
  return KEEP_RECTS.some(
    (r) => tx >= r.tx && tx < r.tx + r.cols && ty >= r.ty && ty < r.ty + r.rows,
  );
}

/** Old quarry mine (MAX) — ROCK shell, irregular PATH floor, hidden shrine. */
function build(): number[] {
  const terrain = fillTerrain(CAVE_COLS, CAVE_ROWS, T.ROCK);

  // Wide middle gallery, then the south entry chamber and the exit corridor
  // (col 15, rows 20–23) punched through the 2-tile border to the warp.
  stampRect(terrain, CAVE_COLS, 4, 10, 24, 8, T.PATH);
  stampRect(terrain, CAVE_COLS, 8, 18, 16, 4, T.PATH);
  stampRect(terrain, CAVE_COLS, 15, 20, 1, 4, T.PATH);

  // North shrine chamber (rows 2–8 cols 10–20) + the two floor links to it:
  // the shrine mouth (row 9, cols 11–19) and the west slime gallery passage
  // (rows 4–9) that keeps the preserved ore/slime coords connected.
  stampRect(terrain, CAVE_COLS, 10, 2, 11, 7, T.PATH);
  stampRect(terrain, CAVE_COLS, 4, 4, 6, 4, T.PATH);
  stampRect(terrain, CAVE_COLS, 5, 8, 4, 2, T.PATH);
  stampRect(terrain, CAVE_COLS, 11, 9, 9, 1, T.PATH);

  // Subterranean pool west (animated cave water) — cols 3–8 rows 16–19.
  stampRect(terrain, CAVE_COLS, 3, 16, 6, 4, T.WATER);

  // Jagged gallery ceiling via tileSeed: bump floor into row 9, dent row 10
  // back where the wall above is untouched (never under a connector/keep).
  for (let col = 4; col <= 27; col++) {
    const bump = tileSeed(col, 9) % 4 === 1;
    const dent = tileSeed(col, 10) % 4 === 0;
    if (bump && terrain[zoneIdx(col, 9, CAVE_COLS)] === T.ROCK) {
      terrain[zoneIdx(col, 9, CAVE_COLS)] = T.PATH;
    } else if (
      dent &&
      terrain[zoneIdx(col, 10, CAVE_COLS)] === T.PATH &&
      terrain[zoneIdx(col, 9, CAVE_COLS)] === T.ROCK &&
      !keep(col, 10)
    ) {
      terrain[zoneIdx(col, 10, CAVE_COLS)] = T.ROCK;
    }
  }

  // Sparse rock outcrops inside the wide floors (irregular mine look).
  // Regions sit inside ≥5-tile-wide floor so single tiles can never sever
  // a connection; keep-rects guard camp/corridor/scenery/ore approaches.
  const outcrops = [
    { tx: 5, ty: 11, cols: 5, rows: 6 }, // west gallery
    { tx: 21, ty: 11, cols: 6, rows: 6 }, // east gallery
    { tx: 16, ty: 18, cols: 8, rows: 3 }, // entry chamber east
  ];
  for (const r of outcrops) {
    for (let ty = r.ty; ty < r.ty + r.rows; ty++) {
      for (let tx = r.tx; tx < r.tx + r.cols; tx++) {
        const i = zoneIdx(tx, ty, CAVE_COLS);
        if (tileSeed(tx, ty) % 6 === 0 && terrain[i] === T.PATH && !keep(tx, ty)) {
          terrain[i] = T.ROCK;
        }
      }
    }
  }

  // Ore nodes sit on authored ROCK tiles (cozy-zones contract — solid until
  // mined, walkable after). Stamped last so no carve reopens them.
  for (const o of CAVE_ORE) {
    terrain[zoneIdx(o.x, o.y, CAVE_COLS)] = T.ROCK;
  }

  return terrain;
}

export const CAVE_ZONE: ZoneLayout = {
  id: "cave",
  cols: CAVE_COLS,
  rows: CAVE_ROWS,
  spawn: { x: 15, y: 20 },
  terrain: build(),
  warps: [
    { x: 15, y: 23, to: "farm", spawn: { x: 20, y: 9 }, label: "Ra miệng hang" },
  ],
  beds: [],
  wells: [],
  ponds: [],
  npcs: [],
  rocks: CAVE_ORE.map((o) => ({ ...o })),
  slimes: [
    { id: "slime-a", x: 6, y: 10 },
    { id: "slime-b", x: 15, y: 7 },
    { id: "slime-c", x: 12, y: 11 },
  ],
};
