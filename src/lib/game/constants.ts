// Core game constants

// Native asset pixel size (Farm RPG Tiny Pack = 16px tiles/sprites).
export const ASSET_TILE = 16;
// Render scale: 16 * 3 = 48px on screen. ADR-013.
export const SCALE = 3;
// Tile size in rendered pixels. Sync toàn cục client ↔ raid-server.
// MAP_COLS/MAP_ROWS = FARM zone dims (60×60). Raid arena dims tách rời ở
// src/lib/raid/constants.ts (MAP_COLS=30, MAP_ROWS=22 — authoritative cho raid
// instance, đồng bộ raid-server). ZONES raid_* dưới đây = zone-manager explore
// map (40×40), KHÔNG dùng cho raid gameplay.
export const TILE_SIZE = ASSET_TILE * SCALE; // 48

// Multi-Zone Definitions & Sizes
export type ZoneId = "farm" | "village" | "raid_forest" | "raid_fortress" | "raid_crypt";

export interface ZoneConfig {
  id: ZoneId;
  name: string;
  cols: number;
  rows: number;
}

export const ZONES: Record<ZoneId, ZoneConfig> = {
  farm: { id: "farm", name: "Farm Homestead", cols: 60, rows: 60 },
  village: { id: "village", name: "Sun Valley Village", cols: 40, rows: 40 },
  raid_forest: { id: "raid_forest", name: "Whispering Forest", cols: 40, rows: 40 },
  raid_fortress: { id: "raid_fortress", name: "Iron Fortress", cols: 40, rows: 40 },
  raid_crypt: { id: "raid_crypt", name: "Shadow Crypt", cols: 40, rows: 40 },
};

// Default Legacy dimensions (Farm Zone)
export const MAP_COLS = ZONES.farm.cols; // 60
export const MAP_ROWS = ZONES.farm.rows; // 60
export const WORLD_WIDTH = MAP_COLS * TILE_SIZE; // 2880 (48 × 60)
export const WORLD_HEIGHT = MAP_ROWS * TILE_SIZE; // 2880

// Game viewport (Phaser internal resolution) — a window into the world.
// Design docs specify 960×704 (15:11) canvas; raid canvas uses the same
// aspect. The Phaser camera pans across the world; this is NOT the world size.
export const GAME_VIEW_WIDTH = 960;
export const GAME_VIEW_HEIGHT = 704;

// Time system
export const MINUTES_PER_GAME_HOUR = 1; // 1 real second = 1 in-game minute roughly via tick
export const DAY_START_HOUR = 6; // 6:00 AM
export const DAY_END_HOUR = 26; // 2:00 AM next day -> forces sleep
export const SEASONS = ["Spring", "Summer", "Fall", "Winter"] as const;
export type Season = (typeof SEASONS)[number];
export const DAYS_PER_SEASON = 28;

// Energy
export const MAX_ENERGY = 270;

// Tile types (layer: terrain)
export const T = {
  GRASS: 0,
  GRASS_FLOWER: 1,
  PATH: 2,
  WATER: 3,
  TILLED: 4, // dry tilled soil
  TILLED_WET: 5, // watered tilled soil
  TREE: 6,
  STUMP: 7,
  ROCK: 8,
  STONE_EMPTY: 9,
  FENCE: 10,
  FLOWER_BUSH: 11,
  SAND: 12,
  BRIDGE: 13,
  FALLOW: 14,
} as const;

export type TileType = (typeof T)[keyof typeof T];

// Whether a tile blocks movement
export const SOLID_TILES = new Set<number>([T.WATER, T.TREE, T.ROCK, T.FENCE, T.FLOWER_BUSH]);

// Whether a tile is tillable (can be hoed into farmland)
export const TILLABLE_TILES = new Set<number>([T.FALLOW]);

// Colors per season (top HUD + theming accents)
export const SEASON_THEME: Record<
  Season,
  { accent: string; sky: string; ground: string; label: string; emoji: string }
> = {
  Spring: { accent: "#7cc36b", sky: "#bfe3ff", ground: "#6fb84a", label: "Spring", emoji: "🌸" },
  Summer: { accent: "#f0b84a", sky: "#8fd3ff", ground: "#8fce4a", label: "Summer", emoji: "☀️" },
  Fall: { accent: "#d97742", sky: "#ffd9a8", ground: "#c98a3a", label: "Fall", emoji: "🍂" },
  Winter: { accent: "#9ec9e8", sky: "#eaf4ff", ground: "#dfeaf2", label: "Winter", emoji: "❄️" },
};
