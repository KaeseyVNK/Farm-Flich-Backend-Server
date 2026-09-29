// Building collision footprints (tile coords) — Canvas2D engine + village.
// Inclusive x1/y1. Must match farm-scenery-layout FARM_HOUSE / FARM_BARN / FARM_COOP.

interface Footprint {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export const BUILDING_FOOTPRINTS: Footprint[] = [
  { x0: 8, x1: 15, y0: 8, y1: 9 }, // Farmhouse south foot
  { x0: 19, x1: 24, y0: 8, y1: 9 }, // Pasture cottage
  { x0: 30, x1: 34, y0: 8, y1: 9 }, // Coop
];

/** Tile có phải building footprint không? (collision check) */
export function isBuildingTile(tx: number, ty: number): boolean {
  for (const f of BUILDING_FOOTPRINTS) {
    if (tx >= f.x0 && tx <= f.x1 && ty >= f.y0 && ty <= f.y1) return true;
  }
  return false;
}
