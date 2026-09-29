// Authored water for "Trại Sữa & Trái Cây Đồi Xanh": west pond, central lake, winding river.

const COLS = 60;
const ROWS = 60;

function inBounds(tx: number, ty: number): boolean {
  return tx >= 0 && ty >= 0 && tx < COLS && ty < ROWS;
}

function paintDisk(set: Set<string>, cx: number, cy: number, r: number): void {
  const r2 = r * r;
  const y0 = Math.floor(cy - r);
  const y1 = Math.ceil(cy + r);
  const x0 = Math.floor(cx - r);
  const x1 = Math.ceil(cx + r);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (!inBounds(tx, ty)) continue;
      const dx = tx - cx;
      const dy = ty - cy;
      if (dx * dx + dy * dy <= r2) set.add(`${tx},${ty}`);
    }
  }
}

function paintEllipse(set: Set<string>, cx: number, cy: number, rx: number, ry: number): void {
  const y0 = Math.floor(cy - ry);
  const y1 = Math.ceil(cy + ry);
  const x0 = Math.floor(cx - rx);
  const x1 = Math.ceil(cx + rx);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (!inBounds(tx, ty)) continue;
      const nx = (tx - cx) / rx;
      const ny = (ty - cy) / ry;
      if (nx * nx + ny * ny <= 1) set.add(`${tx},${ty}`);
    }
  }
}

function paintSegment(
  set: Set<string>,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  r: number,
): void {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(dist * 2));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    paintDisk(set, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r);
  }
}

function parseTiles(set: Set<string>): { tx: number; ty: number }[] {
  return [...set]
    .map((k) => {
      const [tx, ty] = k.split(",").map(Number);
      return { tx, ty };
    })
    .sort((a, b) => a.ty - b.ty || a.tx - b.tx);
}

const pondSet = new Set<string>();
// Pond organic: 2 ellipse lệch tâm hợp nhất (tránh bờ đối xứng cứng).
paintEllipse(pondSet, 8.6, 23.4, 3.2, 2.3);
paintEllipse(pondSet, 10.0, 23.0, 3.0, 2.5);

const lakeSet = new Set<string>();
// Lake: lệch tâm + bán kính lẻ để bờ không trùng hàng/cột grid.
paintEllipse(lakeSet, 33.1, 16.3, 8.5, 5.4);
paintEllipse(lakeSet, 38.1, 17.7, 4.5, 3.5);

const riverSet = new Set<string>();
// Spine ít điểm gãy hơn, bán kính tối thiểu tăng → đường cong mềm.
// Đuôi sông uốn S nhẹ (không thẳng đứng như ống): mỗi ~6 hàng lệch 1 cột.
const riverSpine: ReadonlyArray<[number, number, number]> = [
  [41.8, 0.0, 1.7],
  [39.6, 4.6, 1.75],
  [38.2, 9.6, 1.9],
  [36.6, 12.0, 2.1],
  [27.2, 19.4, 1.85],
  [23.0, 24.0, 1.7],
  [19.2, 30.4, 1.65],
  [16.6, 37.4, 1.65],
  [18.2, 43.5, 1.7], // cong phải
  [15.8, 49.5, 1.7], // cong trái
  [17.8, 54.5, 1.7],
  [16.2, 59.0, 1.75],
];
for (let i = 0; i < riverSpine.length - 1; i++) {
  const [x0, y0, r0] = riverSpine[i];
  const [x1, y1, r1] = riverSpine[i + 1];
  paintSegment(riverSet, x0, y0, x1, y1, (r0 + r1) / 2);
}
for (const k of lakeSet) riverSet.delete(k);
for (const k of pondSet) riverSet.delete(k);
for (const hole of ["32,15", "33,15", "32,16", "33,16"]) {
  lakeSet.delete(hole);
  riverSet.delete(hole);
}

export const FARM_POND_TILES: readonly { tx: number; ty: number }[] = parseTiles(pondSet);
export const FARM_LAKE_TILES: readonly { tx: number; ty: number }[] = parseTiles(lakeSet);
export const FARM_RIVER_TILES: readonly { tx: number; ty: number }[] = parseTiles(riverSet);

function bounds(tiles: readonly { tx: number; ty: number }[]): {
  tx: number;
  ty: number;
  cols: number;
  rows: number;
} {
  let minX = COLS;
  let minY = ROWS;
  let maxX = 0;
  let maxY = 0;
  for (const t of tiles) {
    minX = Math.min(minX, t.tx);
    minY = Math.min(minY, t.ty);
    maxX = Math.max(maxX, t.tx);
    maxY = Math.max(maxY, t.ty);
  }
  return { tx: minX, ty: minY, cols: maxX - minX + 1, rows: maxY - minY + 1 };
}

export const FARM_POND = bounds(FARM_POND_TILES);
export const FARM_LAKE = bounds(FARM_LAKE_TILES);

export function isFarmPondTile(tx: number, ty: number): boolean {
  return pondSet.has(`${tx},${ty}`);
}

export function isFarmLakeTile(tx: number, ty: number): boolean {
  return lakeSet.has(`${tx},${ty}`);
}

export function isFarmRiverTile(tx: number, ty: number): boolean {
  return riverSet.has(`${tx},${ty}`);
}

export function isFarmWaterTile(tx: number, ty: number): boolean {
  return isFarmPondTile(tx, ty) || isFarmLakeTile(tx, ty) || isFarmRiverTile(tx, ty);
}

export function farmPondWaterTiles(): { x: number; y: number }[] {
  return FARM_POND_TILES.map((t) => ({ x: t.tx, y: t.ty }));
}

export function farmLakeWaterTiles(): { x: number; y: number }[] {
  return FARM_LAKE_TILES.map((t) => ({ x: t.tx, y: t.ty }));
}

/** Land tile north of the west pond — fishing / watering standpoint. */
export const FARM_POND_SHORE = { x: 9, y: 20 } as const;
/** Land tile west of the central lake. */
export const FARM_LAKE_SHORE = { x: 24, y: 16 } as const;
