import { T } from "@/lib/game/constants";
import { VILLAGE_COLS, VILLAGE_ROWS } from "@/lib/game/scenery/village-layout";
import { fillTerrain, stampRect, type ZoneLayout } from "./types";

/** Deterministic seed for per-tile variety — same values every build. */
function tileSeed(col: number, row: number): number {
  return Math.abs((col * 92821 + row * 68917 + 37) % 997);
}

/** Sun Valley market town — grass base, grand stone plaza, market street. */
function build(): number[] {
  const terrain = fillTerrain(VILLAGE_COLS, VILLAGE_ROWS, T.GRASS);

  // Grand plaza corridor: cols 19–23, rows 4–26 (kept clear of buildings).
  stampRect(terrain, VILLAGE_COLS, 19, 4, 5, 23, T.PATH);
  // Town hall forecourt at the north end — reaches the door row 8.
  stampRect(terrain, VILLAGE_COLS, 14, 3, 16, 6, T.PATH);
  // Market street (rows 22–24) running the full resident row; carts at row 22.
  stampRect(terrain, VILLAGE_COLS, 8, 22, 28, 3, T.PATH);
  // West gate road to the farm warp + the bus bay beside it.
  stampRect(terrain, VILLAGE_COLS, 0, 13, 7, 1, T.PATH);
  stampRect(terrain, VILLAGE_COLS, 0, 14, 5, 4, T.PATH);
  // Row-14 cross-road: forge (west) and kitchen (east) door connectors.
  stampRect(terrain, VILLAGE_COLS, 5, 14, 14, 1, T.PATH);
  stampRect(terrain, VILLAGE_COLS, 24, 14, 10, 1, T.PATH);
  // Door stubs: forge (west) + kitchen (east) NPC homes.
  stampRect(terrain, VILLAGE_COLS, 10, 14, 1, 2, T.PATH);
  stampRect(terrain, VILLAGE_COLS, 33, 14, 1, 2, T.PATH);
  // Resident-row door approaches on the market street's north lip (row 21).
  for (const col of [8, 15, 28, 35]) {
    terrain[21 * VILLAGE_COLS + col] = T.PATH;
  }
  // Playground lane through the NW meadow, joining the forecourt at (14,6).
  stampRect(terrain, VILLAGE_COLS, 3, 6, 11, 1, T.PATH);

  // Scatter wildflowers on remaining grass for texture variety.
  for (let row = 0; row < VILLAGE_ROWS; row++) {
    for (let col = 0; col < VILLAGE_COLS; col++) {
      const s = tileSeed(col, row);
      const i = row * VILLAGE_COLS + col;
      if (s % 18 === 0 && terrain[i] === T.GRASS) {
        terrain[i] = T.GRASS_FLOWER;
      }
    }
  }

  return terrain;
}

export const VILLAGE_ZONE: ZoneLayout = {
  id: "village",
  cols: VILLAGE_COLS,
  rows: VILLAGE_ROWS,
  spawn: { x: 5, y: 13 },
  terrain: build(),
  warps: [
    { x: 1, y: 13, to: "farm", spawn: { x: 37, y: 22 }, label: "VỀ TRẠI" },
  ],
  beds: [],
  wells: [],
  ponds: [],
  npcs: [
    { id: "alaric", x: 10, y: 15 }, // forge door
    { id: "gaston", x: 33, y: 15 }, // kitchen door
  ],
  rocks: [],
  slimes: [],
};
