import { T } from "@/lib/game/constants";
import { BEACH_COLS, BEACH_ROWS, BEACH_PIER } from "@/lib/game/scenery/beach-layout";
import { fillTerrain, stampRect, type ZoneLayout } from "./types";

/** Deterministic seed for per-tile variety — same values every build. */
function tileSeed(col: number, row: number): number {
  return Math.abs((col * 92821 + row * 68917 + 37) % 997);
}

/** Tidecrest shore — sand base, northern sea, plank pier to the mermaid rock. */
function build(): number[] {
  const terrain = fillTerrain(BEACH_COLS, BEACH_ROWS, T.SAND);

  // Sea across the north (rows 0–5), then carve the plank pier corridor
  // (cols 19–21, rows 0–9) through it — PATH terrain keeps the pier walkable.
  stampRect(terrain, BEACH_COLS, 0, 0, BEACH_COLS, 6, T.WATER);
  stampRect(terrain, BEACH_COLS, BEACH_PIER.tx, BEACH_PIER.ty, BEACH_PIER.cols, BEACH_PIER.rows, T.PATH);

  // Promenade (row 12) from the pier base west to the club and east to the
  // wharf; col 20 rows 10–11 links the pier foot to it.
  stampRect(terrain, BEACH_COLS, 6, 12, 22, 1, T.PATH);
  stampRect(terrain, BEACH_COLS, 20, 10, 1, 2, T.PATH);
  // Beach-club spur: col 11 down to the cluster centroid (12,17).
  stampRect(terrain, BEACH_COLS, 11, 13, 1, 5, T.PATH);
  terrain[17 * BEACH_COLS + 12] = T.PATH;
  // Volleyball court link: col 21 rows 13–17 (net posts flank row 17).
  stampRect(terrain, BEACH_COLS, 21, 13, 1, 5, T.PATH);
  // Wharf: col 27 down to the boardwalk (row 15) + Jack's spur at col 32.
  stampRect(terrain, BEACH_COLS, 27, 13, 1, 3, T.PATH);
  stampRect(terrain, BEACH_COLS, 28, 15, 9, 1, T.PATH);
  stampRect(terrain, BEACH_COLS, 32, 13, 1, 2, T.PATH);

  // Dune boardwalk: sparse plank checker along rows 8–9 (cols 4–36) via
  // tileSeed — only stamps SAND cells so the pier corridor stays clean.
  for (let row = 8; row <= 9; row++) {
    for (let col = 4; col <= 36; col++) {
      const s = tileSeed(col, row);
      const i = row * BEACH_COLS + col;
      if (s % 2 === 0 && terrain[i] === T.SAND) {
        terrain[i] = T.PATH;
      }
    }
  }

  return terrain;
}

export const BEACH_ZONE: ZoneLayout = {
  id: "beach",
  cols: BEACH_COLS,
  rows: BEACH_ROWS,
  spawn: { x: 20, y: 12 },
  terrain: build(),
  warps: [
    { x: 20, y: 11, to: "farm", spawn: { x: 20, y: 57 }, label: "VỀ TRẠI" },
  ],
  beds: [],
  wells: [],
  ponds: [],
  npcs: [
    { id: "elyria", x: 20, y: 1 }, // pier end (mermaid rock)
    { id: "jack", x: 32, y: 13 }, // fishing wharf
  ],
  rocks: [],
  slimes: [],
};
