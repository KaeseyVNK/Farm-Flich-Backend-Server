import { MAP_COLS, MAP_ROWS, T } from "@/lib/game/constants";
import {
  FARM_BRIDGE_NORTH,
  FARM_BRIDGE_SOUTH,
  FARM_EMPTY_FIELD,
  FARM_GARDEN_WALK,
  FARM_HOUSE_PATIO,
  FARM_PATH_RECTS,
  FARM_PIER,
  FARM_PLOTS,
  FARM_RIVER_TILES,
  farmLakeWaterTiles,
  farmPondWaterTiles,
} from "@/lib/game/farm-scenery-layout";
import { fillTerrain, stampRect, type ZoneLayout } from "./types";

function tileSeed(col: number, row: number): number {
  return Math.abs((col * 92821 + row * 68917 + 37) % 997);
}

/** Authored Green Hill Dairy & Orchard terrain. */
export function buildFarmTerrain(): number[] {
  const out = fillTerrain(MAP_COLS, MAP_ROWS, T.GRASS);

  for (const r of FARM_PATH_RECTS) {
    stampRect(out, MAP_COLS, r.tx, r.ty, r.cols, r.rows, T.PATH);
  }
  stampRect(out, MAP_COLS, FARM_HOUSE_PATIO.tx, FARM_HOUSE_PATIO.ty, FARM_HOUSE_PATIO.cols, FARM_HOUSE_PATIO.rows, T.PATH);

  for (const t of farmPondWaterTiles()) {
    out[t.y * MAP_COLS + t.x] = T.WATER;
  }
  for (const t of farmLakeWaterTiles()) {
    out[t.y * MAP_COLS + t.x] = T.WATER;
  }
  for (const t of FARM_RIVER_TILES) {
    if (t.tx >= 0 && t.tx < MAP_COLS && t.ty >= 0 && t.ty < MAP_ROWS) {
      out[t.ty * MAP_COLS + t.tx] = T.WATER;
    }
  }

  stampRect(out, MAP_COLS, FARM_BRIDGE_NORTH.tx, FARM_BRIDGE_NORTH.ty, FARM_BRIDGE_NORTH.cols, FARM_BRIDGE_NORTH.rows, T.PATH);
  stampRect(out, MAP_COLS, FARM_BRIDGE_SOUTH.tx, FARM_BRIDGE_SOUTH.ty, FARM_BRIDGE_SOUTH.cols, FARM_BRIDGE_SOUTH.rows, T.PATH);
  stampRect(out, MAP_COLS, FARM_PIER.tx, FARM_PIER.ty, FARM_PIER.cols, FARM_PIER.rows, T.PATH);
  stampWaterShores(out);
  stampPathLand(out, 20, 22, 2, 3);
  stampPathLand(out, 26, 24, 2, 12);
  stampPathLand(out, 20, 34, 32, 1);
  stampPathLand(out, 36, 22, 1, 13);
  stampPathLand(out, 49, 0, 3, 50);
  stampPathLand(out, 42, 0, 8, 2);
  stampPathLand(out, 20, 50, 2, 9);

  stampRect(out, MAP_COLS, FARM_EMPTY_FIELD.tx, FARM_EMPTY_FIELD.ty, FARM_EMPTY_FIELD.cols, FARM_EMPTY_FIELD.rows, T.FALLOW);
  for (const p of FARM_PLOTS) {
    out[p.ty * MAP_COLS + p.tx] = T.FALLOW;
  }
  for (const r of FARM_GARDEN_WALK) {
    stampRect(out, MAP_COLS, r.tx, r.ty, r.cols, r.rows, T.PATH);
  }

  for (let row = 0; row < MAP_ROWS; row++) {
    for (let col = 0; col < MAP_COLS; col++) {
      const s = tileSeed(col, row);
      const i = row * MAP_COLS + col;
      if (s % 14 === 0 && out[i] === T.GRASS) out[i] = T.GRASS_FLOWER;
    }
  }

  stampFlowerBed(out, 3, 8, 4, 2);
  stampFlowerBed(out, 10, 16, 4, 1);
  stampFlowerBed(out, 35, 21, 3, 1);
  stampFlowerBed(out, 51, 13, 3, 1);

  return out;
}

function stampWaterShores(out: number[]): void {
  const island = new Set(["32,15", "33,15", "32,16", "33,16"]);
  const add: number[] = [];
  for (let i = 0; i < out.length; i++) {
    if (out[i] !== T.WATER) continue;
    const x = i % MAP_COLS;
    const y = Math.floor(i / MAP_COLS);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= MAP_COLS || ny >= MAP_ROWS) continue;
      if (island.has(`${nx},${ny}`)) continue;
      const j = ny * MAP_COLS + nx;
      if (out[j] === T.GRASS || out[j] === T.GRASS_FLOWER) add.push(j);
    }
  }
  for (const j of add) out[j] = T.PATH;
}

function stampPathLand(out: number[], tx: number, ty: number, cols: number, rows: number): void {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = tx + c;
      const y = ty + r;
      if (x < 0 || x >= MAP_COLS || y < 0 || y >= MAP_ROWS) continue;
      const i = y * MAP_COLS + x;
      if (out[i] !== T.WATER) out[i] = T.PATH;
    }
  }
}

function stampFlowerBed(out: number[], tx: number, ty: number, cols: number, rows: number): void {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = tx + c;
      const y = ty + r;
      if (x < 0 || x >= MAP_COLS || y < 0 || y >= MAP_ROWS) continue;
      const i = y * MAP_COLS + x;
      if (out[i] === T.GRASS) out[i] = T.GRASS_FLOWER;
    }
  }
}

const POND_TILES = farmPondWaterTiles();
const LAKE_TILES = farmLakeWaterTiles();

export const FARM_ZONE: ZoneLayout = {
  id: "farm",
  cols: MAP_COLS,
  rows: MAP_ROWS,
  spawn: { x: 12, y: 12 },
  terrain: buildFarmTerrain(),
  warps: [
    { x: 11, y: 10, to: "house", spawn: { x: 8, y: 9 }, label: "Nhà Tidecrest" },
    { x: 12, y: 10, to: "house", spawn: { x: 8, y: 9 }, label: "Nhà Tidecrest" },
    { x: 51, y: 0, to: "village", spawn: { x: 2, y: 13 }, label: "Cổng làng" },
    { x: 20, y: 0, to: "cave", spawn: { x: 15, y: 20 }, label: "Miệng hang" },
    { x: 57, y: 10, to: "deepforest", spawn: { x: 3, y: 14 }, label: "Rừng sâu" },
    { x: 20, y: 58, to: "beach", spawn: { x: 20, y: 12 }, label: "Đường biển" },
  ],
  beds: [],
  wells: [
    { x: 6, y: 10 },
    { x: 7, y: 10 },
    { x: 6, y: 11 },
    { x: 7, y: 11 },
  ],
  ponds: [...POND_TILES, ...LAKE_TILES, ...FARM_RIVER_TILES.map((t) => ({ x: t.tx, y: t.ty }))],
  npcs: [],
  rocks: [],
  slimes: [],
};
