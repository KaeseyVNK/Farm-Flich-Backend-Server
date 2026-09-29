// Single source of truth for Green Hill Dairy & Orchard landmarks.
// FarmSceneryRenderer draws these tiles; FarmScene collides on the same boxes.
import {
  FARM_LAKE,
  FARM_POND,
  FARM_RIVER_TILES,
  farmLakeWaterTiles,
  farmPondWaterTiles,
  isFarmLakeTile,
  isFarmPondTile,
  isFarmRiverTile,
  isFarmWaterTile,
} from "@/lib/game/farm-water-layout";

export {
  FARM_LAKE,
  FARM_POND,
  FARM_RIVER_TILES,
  farmLakeWaterTiles,
  farmPondWaterTiles,
  isFarmLakeTile,
  isFarmPondTile,
  isFarmRiverTile,
  isFarmWaterTile,
} from "@/lib/game/farm-water-layout";
export { FARM_LAKE_SHORE, FARM_POND_SHORE } from "@/lib/game/farm-water-layout";

export interface TileRect {
  tx: number;
  ty: number;
  cols: number;
  rows: number;
}

export function inFilled(tx: number, ty: number, r: TileRect): boolean {
  return tx >= r.tx && tx < r.tx + r.cols && ty >= r.ty && ty < r.ty + r.rows;
}

function onRing(tx: number, ty: number, r: TileRect): boolean {
  if (!inFilled(tx, ty, r)) return false;
  return tx === r.tx || tx === r.tx + r.cols - 1 || ty === r.ty || ty === r.ty + r.rows - 1;
}

function southSolid(tx: number, ty: number, r: TileRect, foot = 2): boolean {
  return inFilled(tx, ty, r) && ty >= r.ty + r.rows - foot;
}

/** Wide red-roof farmhouse (`obj.house.3` 128×112). */
export const FARM_HOUSE: TileRect = { tx: 8, ty: 4, cols: 8, rows: 6 };
export const FARM_HOUSE_DOOR = { tx0: 11, tx1: 12, ty: 10 } as const;
export const FARM_WELL: TileRect = { tx: 6, ty: 10, cols: 2, rows: 2 };
export const FARM_HOUSE_PATIO: TileRect = { tx: 8, ty: 10, cols: 10, rows: 5 };

/** Pasture cottage + small coop + hay shed. */
export const FARM_BARN: TileRect = { tx: 19, ty: 6, cols: 6, rows: 4 };
export const FARM_COOP: TileRect = { tx: 30, ty: 6, cols: 5, rows: 4 };
export const FARM_HAY_SHED: TileRect = { tx: 34, ty: 3, cols: 3, rows: 2 };

export const FARM_BARNYARD_FENCES: readonly TileRect[] = [
  { tx: 18, ty: 3, cols: 20, rows: 1 },
  { tx: 18, ty: 3, cols: 1, rows: 9 },
  { tx: 37, ty: 3, cols: 1, rows: 9 },
  { tx: 18, ty: 11, cols: 8, rows: 1 },
  { tx: 28, ty: 11, cols: 10, rows: 1 },
];
export const FARM_BARNYARD_GATE = { tx0: 26, tx1: 27, ty: 11 } as const;

export const FARM_BRIDGE_NORTH: TileRect = { tx: 21, ty: 23, cols: 5, rows: 2 };
export const FARM_BRIDGE_SOUTH: TileRect = { tx: 15, ty: 35, cols: 3, rows: 2 };
export const FARM_PIER: TileRect = { tx: 12, ty: 23, cols: 2, rows: 1 };

export const FARM_EMPTY_FIELD: TileRect = { tx: 5, ty: 27, cols: 6, rows: 6 };
/** Vành lối đi đất bao quanh luống trồng — khung vườn có chủ ý. */
export const FARM_GARDEN_WALK: readonly TileRect[] = [
  { tx: 5, ty: 27, cols: 6, rows: 1 },
  { tx: 5, ty: 32, cols: 6, rows: 1 },
  { tx: 5, ty: 28, cols: 1, rows: 4 },
  { tx: 10, ty: 28, cols: 1, rows: 4 },
];
export const FARM_SHRINE: TileRect = { tx: 2, ty: 50, cols: 6, rows: 6 };
export const FARM_GREENHOUSE: TileRect = { tx: 53, ty: 15, cols: 5, rows: 6 };
export const FARM_STABLE: TileRect = { tx: 50, ty: 46, cols: 5, rows: 3 };

export const FARM_PLOT_FENCE: TileRect = { tx: 3, ty: 11, cols: 6, rows: 5 };
export const FARM_PLOT_GATE = { tx0: 5, tx1: 6, ty: 15 } as const;

export const FARM_SW_PICNIC_FENCE: readonly TileRect[] = [
  { tx: 2, ty: 17, cols: 5, rows: 1 },
  { tx: 2, ty: 17, cols: 1, rows: 4 },
  { tx: 6, ty: 17, cols: 1, rows: 4 },
  { tx: 2, ty: 20, cols: 5, rows: 1 },
];

export const FARM_GREENHOUSE_FENCE: readonly TileRect[] = [
  { tx: 51, ty: 14, cols: 8, rows: 1 },
  { tx: 51, ty: 14, cols: 1, rows: 4 },
  { tx: 51, ty: 19, cols: 1, rows: 4 },
  { tx: 58, ty: 14, cols: 1, rows: 9 },
  { tx: 51, ty: 22, cols: 8, rows: 1 },
];
export const FARM_GREENHOUSE_GATE = { tx: 51, ty: 18 } as const;

export const FARM_ORCHARD_FENCES: readonly TileRect[] = [
  { tx: 24, ty: 31, cols: 1, rows: 13 },
  { tx: 41, ty: 31, cols: 1, rows: 13 },
  { tx: 24, ty: 43, cols: 18, rows: 1 },
];

export const FARM_FENCES: readonly TileRect[] = [];
export const FARM_FIELDS: readonly TileRect[] = [];

/** Interactive crop plots: 4×4 empty field south of the west pond. */
export const FARM_PLOTS: readonly { tx: number; ty: number; unlockLevel: number }[] = [
  { tx: 6, ty: 28, unlockLevel: 1 },
  { tx: 7, ty: 28, unlockLevel: 1 },
  { tx: 8, ty: 28, unlockLevel: 1 },
  { tx: 6, ty: 29, unlockLevel: 1 },
  { tx: 7, ty: 29, unlockLevel: 1 },
  { tx: 8, ty: 29, unlockLevel: 1 },
  { tx: 6, ty: 30, unlockLevel: 2 },
  { tx: 7, ty: 30, unlockLevel: 2 },
  { tx: 8, ty: 30, unlockLevel: 2 },
  { tx: 9, ty: 28, unlockLevel: 3 },
  { tx: 9, ty: 29, unlockLevel: 3 },
  { tx: 9, ty: 30, unlockLevel: 3 },
  { tx: 6, ty: 31, unlockLevel: 4 },
  { tx: 7, ty: 31, unlockLevel: 4 },
  { tx: 8, ty: 31, unlockLevel: 4 },
  { tx: 9, ty: 31, unlockLevel: 4 },
];

export const ORCHARD_TREES: ReadonlyArray<{ tx: number; ty: number }> = [
  { tx: 26, ty: 32 }, { tx: 30, ty: 32 }, { tx: 34, ty: 32 }, { tx: 38, ty: 32 },
  { tx: 26, ty: 36 }, { tx: 30, ty: 36 }, { tx: 34, ty: 36 }, { tx: 38, ty: 36 },
  { tx: 26, ty: 40 }, { tx: 30, ty: 40 }, { tx: 34, ty: 40 }, { tx: 38, ty: 40 },
];

export interface FarmTreeSpot {
  tx: number;
  ty: number;
  pine?: boolean;
}

export const FARM_PATH_RECTS: readonly TileRect[] = [
  FARM_HOUSE_PATIO,
  { tx: 19, ty: 0, cols: 2, rows: 12 },
  { tx: 49, ty: 0, cols: 3, rows: 50 },
  { tx: 51, ty: 10, cols: 8, rows: 1 },
  { tx: 16, ty: 15, cols: 8, rows: 5 },
  { tx: 20, ty: 18, cols: 2, rows: 6 },
  { tx: 26, ty: 21, cols: 2, rows: 14 },
  { tx: 20, ty: 34, cols: 32, rows: 1 },
  { tx: 25, ty: 38, cols: 16, rows: 1 },
  { tx: 25, ty: 42, cols: 16, rows: 1 },
  { tx: 20, ty: 50, cols: 2, rows: 9 },
  { tx: 3, ty: 48, cols: 18, rows: 2 },
  { tx: 3, ty: 50, cols: 2, rows: 6 },
  { tx: 50, ty: 16, cols: 4, rows: 1 },
  { tx: 42, ty: 13, cols: 8, rows: 2 },
  { tx: 42, ty: 0, cols: 8, rows: 2 },
  { tx: 34, ty: 22, cols: 16, rows: 2 },
  { tx: 36, ty: 22, cols: 1, rows: 13 },
  { tx: 4, ty: 16, cols: 4, rows: 11 },
  { tx: 4, ty: 26, cols: 16, rows: 2 },
  { tx: 50, ty: 45, cols: 6, rows: 2 },
];

function onPathStamp(tx: number, ty: number): boolean {
  return FARM_PATH_RECTS.some((r) => inFilled(tx, ty, r));
}

function nearWater(tx: number, ty: number): boolean {
  return (
    isFarmWaterTile(tx + 1, ty) ||
    isFarmWaterTile(tx - 1, ty) ||
    isFarmWaterTile(tx, ty + 1) ||
    isFarmWaterTile(tx, ty - 1)
  );
}

function treeBlocked(tx: number, ty: number): boolean {
  for (let dy = 0; dy <= 1; dy++) {
    for (let dx = 0; dx <= 1; dx++) {
      const x = tx + dx;
      const y = ty + dy;
      if (isFarmWaterTile(x, y) || onPathStamp(x, y) || nearWater(x, y)) return true;
      if (inFilled(x, y, FARM_HOUSE) || inFilled(x, y, FARM_BARN) || inFilled(x, y, FARM_COOP)) return true;
      if (inFilled(x, y, FARM_GREENHOUSE) || inFilled(x, y, FARM_STABLE) || inFilled(x, y, FARM_SHRINE)) return true;
      if (inFilled(x, y, FARM_PLOT_FENCE) || inFilled(x, y, FARM_EMPTY_FIELD) || inFilled(x, y, FARM_WELL)) return true;
      if (FARM_PLOTS.some((p) => p.tx === x && p.ty === y)) return true;
    }
  }
  return false;
}

function scatterForest(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  gap: number,
  pine: boolean,
): FarmTreeSpot[] {
  const out: FarmTreeSpot[] = [];
  for (let y = y0; y <= y1; y += gap) {
    const stagger = (Math.floor((y - y0) / gap) % 2) * Math.floor(gap / 2);
    for (let x = x0 + stagger; x <= x1; x += gap) {
      if (treeBlocked(x, y)) continue;
      out.push({ tx: x, ty: y, pine });
    }
  }
  return out;
}

export const FARM_TREES: readonly FarmTreeSpot[] = [
  { tx: 32, ty: 15 },
  ...scatterForest(0, 0, 2, 58, 2, false),
  ...scatterForest(3, 0, 16, 2, 3, false),
  ...scatterForest(42, 0, 58, 11, 2, true),
  ...scatterForest(54, 12, 58, 44, 2, true),
  ...scatterForest(44, 24, 52, 32, 3, true),
  ...scatterForest(44, 48, 58, 58, 2, true),
  ...scatterForest(22, 54, 48, 58, 3, false),
  ...scatterForest(0, 44, 10, 49, 3, false),
];

export const FARM_STUMPS: ReadonlyArray<{ tx: number; ty: number }> = [
  { tx: 45, ty: 4 },
  { tx: 48, ty: 7 },
  { tx: 52, ty: 3 },
  { tx: 46, ty: 15 },
  { tx: 50, ty: 26 },
  { tx: 44, ty: 28 },
  { tx: 1, ty: 46 },
];

export const FARM_ANVIL: { tx: number; ty: number } = { tx: 14, ty: 12 };

export interface FarmPropSpot {
  key: string;
  tx: number;
  ty: number;
}

export const FARM_BARNYARD_PROPS: readonly FarmPropSpot[] = [
  { key: "obj.farm.trough", tx: 33, ty: 4 },
  { key: "obj.farm.waterbuckets", tx: 32, ty: 4 },
  { key: "obj.farm.haybale", tx: 27, ty: 5 },
  { key: "obj.farm.haybale", tx: 28, ty: 5 },
  { key: "obj.farm.barrels", tx: 26, ty: 8 },
];

export const FARM_CRAFT_PROPS: readonly FarmPropSpot[] = [
  { key: "obj.farm.anvil", tx: 14, ty: 12 },
  { key: "obj.farm.churn", tx: 15, ty: 13 },
  { key: "obj.farm.jammaker", tx: 16, ty: 13 },
  { key: "obj.farm.barrels", tx: 17, ty: 12 },
  { key: "obj.farm.shippingbox", tx: 16, ty: 11 },
];

export const FARM_YARD_PROPS: readonly FarmPropSpot[] = [
  { key: "obj.farm.scarecrow", tx: 4, ty: 13 },
  { key: "obj.farm.mailbox", tx: 15, ty: 10 },
  { key: "obj.streetlamp", tx: 17, ty: 10 },
  { key: "obj.farm.waterbuckets", tx: 8, ty: 11 },
  { key: "obj.farm.scarecrow", tx: 10, ty: 27 },
];

export const FARM_SHORE_PROPS: readonly FarmPropSpot[] = [
  { key: "obj.farm.waterbuckets", tx: 12, ty: 21 },
  { key: "obj.decor.bench", tx: 28, ty: 12 },
];

export const FARM_LOGGING_PROPS: readonly FarmPropSpot[] = [
  { key: "obj.workbench", tx: 46, ty: 14 },
];

export const FARM_MEADOW_PROPS: readonly FarmPropSpot[] = [
  { key: "obj.picnic", tx: 3, ty: 18 },
  { key: "obj.picnic", tx: 36, ty: 23 },
  { key: "obj.decor.bench", tx: 37, ty: 24 },
  { key: "obj.decor.bench", tx: 39, ty: 24 },
];

export const FARM_ORCHARD_BEEHIVES: readonly FarmPropSpot[] = [
  { key: "obj.farm.beehive", tx: 28, ty: 31 },
  { key: "obj.farm.beehive", tx: 32, ty: 31 },
  { key: "obj.farm.beehive", tx: 36, ty: 31 },
  { key: "obj.farm.beehive", tx: 28, ty: 35 },
  { key: "obj.farm.beehive", tx: 32, ty: 35 },
  { key: "obj.farm.beehive", tx: 36, ty: 35 },
];

export const FARM_GREENHOUSE_PROPS: readonly FarmPropSpot[] = [
  { key: "obj.farm.beehive", tx: 52, ty: 16 },
  { key: "obj.farm.beehive", tx: 52, ty: 18 },
  { key: "obj.farm.beehive", tx: 52, ty: 20 },
];

export const FARM_SHRINE_PROPS: readonly FarmPropSpot[] = [
  { key: "obj.shrine.altar", tx: 4, ty: 53 },
  { key: "obj.shrine.pillar", tx: 2, ty: 51 },
  { key: "obj.shrine.column.broken", tx: 6, ty: 51 },
  { key: "obj.shrine.pillar", tx: 2, ty: 55 },
  { key: "obj.shrine.column.broken", tx: 6, ty: 55 },
];

export const FARM_SHOWCASE_CROPS: readonly { tx: number; ty: number; key: string }[] = [
  { tx: 4, ty: 12, key: "crop.tomato" }, { tx: 5, ty: 12, key: "crop.tomato" }, { tx: 6, ty: 12, key: "crop.tomato" },
  { tx: 4, ty: 13, key: "crop.tomato" }, { tx: 5, ty: 13, key: "crop.tomato" }, { tx: 6, ty: 13, key: "crop.tomato" },
  { tx: 4, ty: 14, key: "crop.tomato" }, { tx: 5, ty: 14, key: "crop.tomato" }, { tx: 6, ty: 14, key: "crop.tomato" },
  { tx: 16, ty: 13, key: "crop.carrot" }, { tx: 17, ty: 13, key: "crop.carrot" }, { tx: 18, ty: 13, key: "crop.carrot" }, { tx: 19, ty: 13, key: "crop.carrot" },
  { tx: 16, ty: 14, key: "crop.carrot" }, { tx: 17, ty: 14, key: "crop.carrot" }, { tx: 18, ty: 14, key: "crop.carrot" }, { tx: 19, ty: 14, key: "crop.carrot" },
  { tx: 20, ty: 13, key: "crop.corn" }, { tx: 21, ty: 13, key: "crop.corn" },
  { tx: 20, ty: 14, key: "crop.corn" }, { tx: 21, ty: 14, key: "crop.corn" },
  { tx: 16, ty: 16, key: "crop.cabbage" }, { tx: 17, ty: 16, key: "crop.cabbage" }, { tx: 18, ty: 16, key: "crop.cabbage" },
  { tx: 16, ty: 17, key: "crop.cabbage" }, { tx: 17, ty: 17, key: "crop.cabbage" }, { tx: 18, ty: 17, key: "crop.cabbage" },
  { tx: 20, ty: 16, key: "crop.pumpkin" }, { tx: 21, ty: 16, key: "crop.pumpkin" }, { tx: 22, ty: 16, key: "crop.pumpkin" },
  { tx: 16, ty: 21, key: "crop.carrot" }, { tx: 17, ty: 21, key: "crop.carrot" }, { tx: 18, ty: 21, key: "crop.carrot" },
  { tx: 16, ty: 22, key: "crop.carrot" }, { tx: 17, ty: 22, key: "crop.carrot" }, { tx: 18, ty: 22, key: "crop.carrot" },
];

export const FARM_DECOR_ANIMALS: readonly [string, number, number, number, number][] = [
  ["animal.cow", 21, 4, 32, 32],
  ["animal.cow", 24, 5, 32, 32],
  ["animal.cow", 28, 4, 32, 32],
  ["animal.sheep", 22, 7, 32, 32],
  ["animal.sheep", 26, 6, 32, 32],
  ["animal.sheep", 31, 5, 32, 32],
  ["animal.sheep", 33, 8, 32, 32],
  ["animal.goat", 29, 8, 32, 32],
  ["animal.chicken", 16, 11, 16, 16],
  ["animal.duck", 28, 13, 16, 16],
  ["animal.duck", 35, 14, 16, 16],
];

export const FARM_YARD_SIGNS: ReadonlyArray<{ tx: number; ty: number; label: string }> = [];

function isBridgeTile(tx: number, ty: number): boolean {
  return inFilled(tx, ty, FARM_BRIDGE_NORTH) || inFilled(tx, ty, FARM_BRIDGE_SOUTH) || inFilled(tx, ty, FARM_PIER);
}

export function isFarmScenerySolid(tx: number, ty: number): boolean {
  if (isBridgeTile(tx, ty)) return false;

  if (southSolid(tx, ty, FARM_HOUSE)) return true;
  if (southSolid(tx, ty, FARM_BARN)) return true;
  if (southSolid(tx, ty, FARM_COOP)) return true;
  if (inFilled(tx, ty, FARM_HAY_SHED)) return true;
  if (southSolid(tx, ty, FARM_GREENHOUSE, 3)) return true;
  if (inFilled(tx, ty, FARM_STABLE)) return true;
  if (inFilled(tx, ty, FARM_WELL)) return true;

  if (isFarmWaterTile(tx, ty)) return true;
  if (tx === FARM_ANVIL.tx && ty === FARM_ANVIL.ty) return true;

  for (const tree of FARM_TREES) {
    if (tx >= tree.tx && tx <= tree.tx + 1 && ty >= tree.ty && ty <= tree.ty + 1) return true;
  }
  for (const tree of ORCHARD_TREES) {
    if (tx === tree.tx && ty === tree.ty + 1) return true;
  }

  for (const fence of FARM_BARNYARD_FENCES) {
    if (onRing(tx, ty, fence)) {
      const gate = ty === FARM_BARNYARD_GATE.ty && tx >= FARM_BARNYARD_GATE.tx0 && tx <= FARM_BARNYARD_GATE.tx1;
      if (!gate) return true;
    }
  }
  if (onRing(tx, ty, FARM_PLOT_FENCE)) {
    const gate = ty === FARM_PLOT_GATE.ty && tx >= FARM_PLOT_GATE.tx0 && tx <= FARM_PLOT_GATE.tx1;
    if (!gate) return true;
  }
  for (const fence of FARM_ORCHARD_FENCES) {
    if (onRing(tx, ty, fence)) return true;
  }
  for (const fence of FARM_SW_PICNIC_FENCE) {
    if (onRing(tx, ty, fence)) return true;
  }
  for (const fence of FARM_GREENHOUSE_FENCE) {
    if (onRing(tx, ty, fence) && !(tx === FARM_GREENHOUSE_GATE.tx && ty === FARM_GREENHOUSE_GATE.ty)) return true;
  }

  return false;
}
