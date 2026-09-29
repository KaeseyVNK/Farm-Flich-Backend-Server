import { T } from "@/lib/game/constants";
import { HOUSE_COLS, HOUSE_ROWS } from "@/lib/game/scenery/house-interior-layout";
import { fillTerrain, stampInterior, type ZoneLayout } from "./types";

const COLS = HOUSE_COLS;
const ROWS = HOUSE_ROWS;

function build(): number[] {
  const terrain = fillTerrain(COLS, ROWS, T.ROCK);
  stampInterior(terrain, COLS, ROWS, T.PATH, T.ROCK);
  return terrain;
}

export const HOUSE_ZONE: ZoneLayout = {
  id: "house",
  cols: COLS,
  rows: ROWS,
  spawn: { x: 8, y: 9 },
  terrain: build(),
  warps: [
    { x: 8, y: 11, to: "farm", spawn: { x: 12, y: 11 }, label: "Ra sân" },
  ],
  // South foot of the int.bed 2×3 at (3,1) — faced from the carpet tile (4,4).
  beds: [{ x: 4, y: 3 }],
  wells: [],
  ponds: [],
  npcs: [],
  rocks: [],
  slimes: [],
};
