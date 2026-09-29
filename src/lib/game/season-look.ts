// Visual frames/colors per season. Renderers consume this; stores stay authoritative.
import type { Season } from "./constants";

/** Maple `objects/tree.png` is a 32×48 grid (288×192 = 9×4). Row 1 = mature
 *  seasonal canopies. A 48×48 crop grabs two trees and clips both. */
export const MAPLE_SEASON_FRAME: Record<
  Season,
  { sx: number; sy: number; sw: number; sh: number; frame: string }
> = {
  Spring: { sx: 0, sy: 48, sw: 32, sh: 48, frame: "maple32-spring" },
  Summer: { sx: 32, sy: 48, sw: 32, sh: 48, frame: "maple32-summer" },
  Fall: { sx: 64, sy: 48, sw: 32, sh: 48, frame: "maple32-fall" },
  Winter: { sx: 96, sy: 48, sw: 32, sh: 48, frame: "maple32-winter" },
};

export const PINE_SEASON_FRAME: Record<Season, { sx: number; sy: number; frame: string }> = {
  Spring: { sx: 96, sy: 0, frame: "pine-green" },
  Summer: { sx: 96, sy: 0, frame: "pine-green" },
  Fall: { sx: 96, sy: 0, frame: "pine-green" },
  Winter: { sx: 128, sy: 0, frame: "pine-snow" },
};

export const SEASON_TREE_GFX: Record<Season, { shade: number; leaf: number }> = {
  Spring: { shade: 0x5aa453, leaf: 0xf4a7c3 },
  Summer: { shade: 0x3f7c43, leaf: 0x5aa453 },
  Fall: { shade: 0xb85a1e, leaf: 0xe07a2a },
  Winter: { shade: 0xc5d4e0, leaf: 0xf4f8fc },
};

export const SEASON_GRASS_FALLBACK: Record<Season, { grass: number; grassAlt: number; path: number; water: number }> = {
  Spring: { grass: 0x79bf56, grassAlt: 0x32ad53, path: 0x9a7048, water: 0x2e82ba },
  Summer: { grass: 0x4fad3a, grassAlt: 0x2e9a32, path: 0x8a6238, water: 0x1a7ad4 },
  Fall: { grass: 0xc98a3a, grassAlt: 0xb86a2a, path: 0x7a4f2b, water: 0x3a7ec9 },
  Winter: { grass: 0xe8f0f6, grassAlt: 0xd5e3ee, path: 0x9aa8b4, water: 0xb9d4e8 },
};

/** 16px cells on `ui.weather` (160×48). Middle row = four seasons. */
export const WEATHER_SEASON_CELL: Record<Season, { sx: number; sy: number }> = {
  Spring: { sx: 0, sy: 16 },
  Summer: { sx: 16, sy: 16 },
  Fall: { sx: 32, sy: 16 },
  Winter: { sx: 48, sy: 16 },
};

export const WINTER_WATER_TINT = 0xc5dcec;
