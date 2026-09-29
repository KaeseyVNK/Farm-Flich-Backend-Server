// TilesetMapper — 16px cells on Maeve seasonal sheets.
// Grass fill is the solid interior (144,32), never autotile edge/shrub cells.
import { T, type TileType, type Season } from "../constants";

export interface TileSourceRect {
  /** Asset manifest key (seasonal sheet). */
  sheet: string;
  /** Source x/y trong sheet (native px, 16-grid). */
  sx: number;
  sy: number;
}

// Season → sheet key (4 mùa grass atlas đã copy phase 1).
const SEASON_SHEET: Record<Season, string> = {
  Spring: "tile.grass.spring",
  Summer: "tile.grass.summer",
  Fall: "tile.grass.fall",
  Winter: "tile.grass.winter",
};

/**
 * Map TileType → source rect. `zone` swaps house/cave/beach sheets so those
 * maps are not a cropped meadow.
 */
export function tileSourceRect(
  type: TileType,
  season: Season,
  zone: string = "farm",
): TileSourceRect {
  const grass = SEASON_SHEET[season];
  if (zone === "house") {
    if (type === T.ROCK) return { sheet: "tile.house", sx: 0, sy: 32 };
    return { sheet: "tile.house", sx: 64, sy: 0 };
  }
  if (zone === "cave") {
    if (type === T.ROCK) return { sheet: "tile.caves", sx: 0, sy: 0 };
    return { sheet: "tile.caves", sx: 16, sy: 16 };
  }
  if (zone === "beach") {
    if (type === T.WATER) return { sheet: "tile.water.base", sx: 0, sy: 0 };
    // Pier planks — pixel-verified on tile.beach.bridge (208×144 = 13×9 cells
    // of 16×16): cell (2,3) at px(32,48) is 256/256 opaque with a repeating
    // horizontal plank stripe [lum 76,76,94,47] and zero column variance, so
    // it tiles seamlessly in both axes. Row-1 cells like px(32,16) share the
    // stripe but carry 3 transparent top rows (208/256) — avoid those.
    if (type === T.PATH) return { sheet: "tile.beach.bridge", sx: 32, sy: 48 };
    return { sheet: "tile.beach", sx: 0, sy: 48 };
  }
  switch (type) {
    case T.GRASS:
      // Solid interior meadow — atlas (0,0)/(32,16) are shrub/edge cells
      // with punched-out black, which tiled as giant bushes.
      return { sheet: grass, sx: 144, sy: 32 };
    case T.GRASS_FLOWER:
      return { sheet: grass, sx: 80, sy: 16 };
    case T.PATH:
      // Golden dirt fill on the seasonal grass sheet — `tile.path` (0,0) is
      // dungeon brick and made the farm roads look like a cellar.
      return { sheet: grass, sx: 144, sy: 128 };
    case T.WATER:
      return { sheet: "tile.water.base", sx: 0, sy: 0 };
    case T.TILLED:
      return { sheet: "tile.tilled", sx: 64, sy: 0 };
    case T.TILLED_WET:
      return { sheet: "tile.tilled", sx: 272, sy: 16 };
    case T.FALLOW:
      // Cell (0,0) có 54/256 px trong suốt → lộ cỏ lệch dưới, tạo hiệu ứng
      // ô vuông nối lởm chởm. Dùng cell đất hoang fully-opaque thay thế.
      return { sheet: "tile.tilled", sx: 112, sy: 0 };
    case T.SAND:
      return { sheet: grass, sx: 144, sy: 128 };
    case T.ROCK:
      return { sheet: "tile.caves", sx: 0, sy: 0 };
    case T.TREE:
    case T.STONE_EMPTY:
    case T.STUMP:
    case T.FENCE:
    case T.FLOWER_BUSH:
      return { sheet: grass, sx: 144, sy: 32 };
    case T.BRIDGE:
      return { sheet: grass, sx: 144, sy: 128 };
    default:
      return { sheet: grass, sx: 144, sy: 32 };
  }
}

/**
 * 4 frame animation nước nội địa (plain interior) trên sheet tile.water.anim.
 * Sheet layout (verified pixel-wise): 4 band theo mùa × 6 khối 4 cột; khối nước
 * xanh ở cols 16–19 band 0 có 4 ô interior (rows 1–2 × cols 17–18) ≈95% flat
 * blue với sparkle đi vòng 4 góc — r1c17 là mirror dọc CHÍNH XÁC của r2c17
 * (cặp frame vẽ đối xứng). Row 0/3 mang thanh sóng bờ → không phải interior.
 * Thứ tự frame: TL → TR → BR → BL (sparkle quay theo chiều kim đồng hồ).
 */
export const WATER_ANIM_FRAMES = [
  { sx: 272, sy: 16 },
  { sx: 288, sy: 16 },
  { sx: 288, sy: 32 },
  { sx: 272, sy: 32 },
];

/**
 * 9-slice pond shore on `tile.water.anim` band 0.
 * Pixel-verified 4×4 blob at cols 16–19, rows 0–3 (16px cells).
 * Interior / puddles keep the animated 2×2 at cols 17–18, rows 1–2.
 */
export const WATER_SHORE_CELLS = {
  "corner-nw": { sx: 256, sy: 0 },
  "edge-n": { sx: 272, sy: 0 },
  "corner-ne": { sx: 304, sy: 0 },
  "edge-w": { sx: 256, sy: 16 },
  "edge-e": { sx: 304, sy: 16 },
  "corner-sw": { sx: 256, sy: 48 },
  "edge-s": { sx: 272, sy: 48 },
  "corner-se": { sx: 304, sy: 48 },
} as const;

/** Season → base grass sheet key. */
export function seasonSheet(season: Season): string {
  return SEASON_SHEET[season];
}
