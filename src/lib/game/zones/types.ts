import { T } from "@/lib/game/constants";

export type ZoneId = "farm" | "house" | "village" | "cave" | "beach" | "deepforest";

export interface TilePos {
  x: number;
  y: number;
}

export interface Warp {
  x: number;
  y: number;
  to: ZoneId;
  spawn: TilePos;
  label: string;
}

export interface ZoneNpc {
  id: string;
  x: number;
  y: number;
}

export interface ZoneRock {
  x: number;
  y: number;
}

export interface ZoneSlime {
  id: string;
  x: number;
  y: number;
}

export interface ZoneLayout {
  id: ZoneId;
  cols: number;
  rows: number;
  spawn: TilePos;
  terrain: number[];
  warps: Warp[];
  beds: TilePos[];
  wells: TilePos[];
  ponds: TilePos[];
  npcs: ZoneNpc[];
  rocks: ZoneRock[];
  slimes: ZoneSlime[];
}

export function zoneIdx(x: number, y: number, cols: number): number {
  return y * cols + x;
}

export function fillTerrain(cols: number, rows: number, tile: number): number[] {
  return new Array(cols * rows).fill(tile);
}

export function stampRect(
  terrain: number[],
  cols: number,
  x: number,
  y: number,
  w: number,
  h: number,
  tile: number,
): void {
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const tx = x + c;
      const ty = y + r;
      if (tx < 0 || ty < 0) continue;
      const rows = Math.floor(terrain.length / cols);
      if (tx >= cols || ty >= rows) continue;
      terrain[zoneIdx(tx, ty, cols)] = tile;
    }
  }
}

/** Carve an interior floor, leaving a 1-tile solid border. Opens a south door. */
export function stampInterior(
  terrain: number[],
  cols: number,
  rows: number,
  floor = T.PATH,
  wall = T.ROCK,
): void {
  terrain.fill(wall);
  stampRect(terrain, cols, 1, 1, cols - 2, rows - 2, floor);
  const doorX = Math.floor(cols / 2);
  terrain[zoneIdx(doorX, rows - 1, cols)] = floor;
}

export function inZone(layout: ZoneLayout, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < layout.cols && y < layout.rows;
}
