// Zone Manager: handles zone map layouts, warp points, decor, and zone transitions

import { T, ZONES, type ZoneId, type ZoneConfig } from "./constants";

export interface WarpPoint {
  x: number; // tile x
  y: number; // tile y
  targetZone: ZoneId;
  targetX: number; // target tile x
  targetY: number; // target tile y
}

export type DecorType =
  | "tree"
  | "rock"
  | "flower_bush"
  | "stump"
  | "bush"
  | "lantern"
  | "crate"
  | "barrel"
  | "haystack"
  | "mushroom"
  | "tombstone"
  | "ruin_pillar";

export interface DecorEntry {
  type: DecorType;
  x: number; // tile x
  y: number; // tile y
}

export interface ZoneData {
  config: ZoneConfig;
  terrain: number[][];
  warps: WarpPoint[];
  decor: DecorEntry[];
}

// Deterministic PRNG (mulberry32) for reproducible map decor
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isBlockedForDecor(r: number, c: number, terrain: number[][], reserved: Set<string>): boolean {
  if (reserved.has(`${c},${r}`)) return true;
  const t = terrain[r][c];
  // Don't place decor on water/path/bridge/tilled/fence/sand
  return (
    t === T.WATER ||
    t === T.PATH ||
    t === T.BRIDGE ||
    t === T.TILLED ||
    t === T.TILLED_WET ||
    t === T.FENCE ||
    t === T.SAND ||
    t === T.STONE_EMPTY
  );
}

// Scatter decor items using PRNG, respecting reserved tiles & spacing.
function scatterDecor(
  rng: () => number,
  terrain: number[][],
  rows: number,
  cols: number,
  reserved: Set<string>,
  items: { type: DecorType; weight: number }[],
  count: number,
  spacing = 2,
): DecorEntry[] {
  const decor: DecorEntry[] = [];
  const placed = new Set<string>();
  let attempts = 0;
  while (decor.length < count && attempts < count * 12) {
    attempts++;
    const r = Math.floor(rng() * rows);
    const c = Math.floor(rng() * cols);
    if (isBlockedForDecor(r, c, terrain, reserved)) continue;
    // spacing check
    let tooClose = false;
    for (const p of placed) {
      const [pc, pr] = p.split(",").map(Number);
      if (Math.abs(pc - c) <= spacing && Math.abs(pr - r) <= spacing) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    // weighted pick
    const totalWeight = items.reduce((s, it) => s + it.weight, 0);
    let roll = rng() * totalWeight;
    let chosen = items[0].type;
    for (const it of items) {
      roll -= it.weight;
      if (roll <= 0) {
        chosen = it.type;
        break;
      }
    }
    decor.push({ type: chosen, x: c, y: r });
    placed.add(`${c},${r}`);
  }
  return decor;
}

// Generate base terrain grid + decor for zones dynamically
export function generateZoneMap(zoneId: ZoneId): ZoneData {
  const config = ZONES[zoneId];
  const cols = config.cols;
  const rows = config.rows;
  const terrain: number[][] = Array.from({ length: rows }, () => Array(cols).fill(T.GRASS));
  const warps: WarpPoint[] = [];
  const decor: DecorEntry[] = [];
  const reserved = new Set<string>(); // tiles where decor must NOT go

  if (zoneId === "farm") {
    // Farm layout (60x60)
    // River along the east side
    for (let r = 0; r < rows; r++) {
      terrain[r][52] = T.WATER;
      terrain[r][53] = T.WATER;
      terrain[r][54] = T.WATER;
    }
    // Bridge across river
    terrain[25][52] = T.BRIDGE;
    terrain[25][53] = T.BRIDGE;
    terrain[25][54] = T.BRIDGE;

    // Dirt paths (main cross)
    for (let c = 10; c < 50; c++) terrain[25][c] = T.PATH;
    for (let r = 10; r < 50; r++) terrain[r][25] = T.PATH;

    // Reserve building footprints (house 16-20 x 14-17, shop, barn)
    for (let r = 14; r <= 19; r++) for (let c = 16; c <= 21; c++) reserved.add(`${c},${r}`);
    for (let r = 14; r <= 19; r++) for (let c = 2; c <= 6; c++) reserved.add(`${c},${r}`);
    for (let r = 14; r <= 19; r++) for (let c = 22; c <= 28; c++) reserved.add(`${c},${r}`);

    // Sand/beach along the riverbank
    for (let r = 0; r < rows; r++) {
      if (terrain[r][51] === T.GRASS) terrain[r][51] = T.SAND;
      if (terrain[r][55] === T.GRASS) terrain[r][55] = T.SAND;
    }

    // Reserve warp tile + 1 buffer
    reserved.add(`59,25`);
    reserved.add(`58,25`);

    // Scatter farm decor: trees on perimeter, flowers, rocks, bushes
    const rng = mulberry32(12345);
    const farmDecor = scatterDecor(
      rng,
      terrain,
      rows,
      cols,
      reserved,
      [
        { type: "tree", weight: 5 },
        { type: "flower_bush", weight: 4 },
        { type: "bush", weight: 3 },
        { type: "rock", weight: 2 },
        { type: "stump", weight: 1 },
      ],
      Math.floor(rows * cols * 0.08),
      3,
    );
    decor.push(...farmDecor);

    // Farm-specific props near buildings
    decor.push({ type: "haystack", x: 8, y: 18 });
    decor.push({ type: "haystack", x: 8, y: 20 });
    decor.push({ type: "crate", x: 14, y: 18 });
    decor.push({ type: "barrel", x: 14, y: 20 });
    // Lantern cạnh path chính thập giá — KHÔNG đặt lên path (col 25/row 25)
    decor.push({ type: "lantern", x: 24, y: 13 });
    decor.push({ type: "lantern", x: 26, y: 37 });

    // Warp to Village at east gate (col 59, row 25)
    warps.push({ x: 59, y: 25, targetZone: "village", targetX: 2, targetY: 20 });
  } else if (zoneId === "village") {
    // Village layout (40x40)
    // Paved stone/path center square (market plaza)
    for (let r = 15; r <= 25; r++) {
      for (let c = 15; c <= 25; c++) {
        terrain[r][c] = T.PATH;
      }
    }
    // Paths radiating out
    for (let c = 0; c < 15; c++) terrain[20][c] = T.PATH;
    for (let c = 26; c < cols; c++) terrain[20][c] = T.PATH;
    for (let r = 0; r < 15; r++) terrain[r][20] = T.PATH;
    for (let r = 26; r < rows; r++) terrain[r][20] = T.PATH;

    // Pond at top-right
    for (let r = 5; r <= 10; r++) {
      for (let c = 28; c <= 33; c++) {
        terrain[r][c] = T.WATER;
      }
    }
    // Sand around pond
    for (let r = 4; r <= 11; r++) {
      for (let c = 27; c <= 34; c++) {
        if (terrain[r][c] === T.GRASS) terrain[r][c] = T.SAND;
      }
    }

    // Reserve plaza & pond area
    for (let r = 15; r <= 25; r++) for (let c = 15; c <= 25; c++) reserved.add(`${c},${r}`);

    // Scatter village decor: lanterns along paths, bushes, flowers
    const rng = mulberry32(54321);
    const villageDecor = scatterDecor(
      rng,
      terrain,
      rows,
      cols,
      reserved,
      [
        { type: "tree", weight: 3 },
        { type: "flower_bush", weight: 4 },
        { type: "bush", weight: 3 },
        { type: "lantern", weight: 2 },
      ],
      Math.floor(rows * cols * 0.06),
      3,
    );
    decor.push(...villageDecor);

    // Village-specific props: lanterns lining the plaza
    decor.push({ type: "lantern", x: 14, y: 15 });
    decor.push({ type: "lantern", x: 14, y: 25 });
    decor.push({ type: "lantern", x: 26, y: 15 });
    decor.push({ type: "lantern", x: 26, y: 25 });
    decor.push({ type: "crate", x: 18, y: 18 });
    decor.push({ type: "barrel", x: 22, y: 22 });

    // Warp back to Farm at west gate (col 0, row 20)
    warps.push({ x: 0, y: 20, targetZone: "farm", targetX: 58, targetY: 25 });
  } else {
    // Raid zones layout
    // Central path
    for (let r = 5; r < rows - 5; r++) {
      terrain[r][10] = T.PATH;
      terrain[r][30] = T.PATH;
    }
    for (let c = 10; c <= 30; c++) terrain[20][c] = T.PATH;

    // Scatter raid-zone decor by type
    const rng = mulberry32(zoneId.length * 99991 + 7);
    let raidItems: { type: DecorType; weight: number }[];
    if (zoneId === "raid_forest") {
      raidItems = [
        { type: "tree", weight: 8 },
        { type: "bush", weight: 4 },
        { type: "mushroom", weight: 3 },
        { type: "rock", weight: 2 },
        { type: "stump", weight: 2 },
      ];
    } else if (zoneId === "raid_fortress") {
      raidItems = [
        { type: "ruin_pillar", weight: 5 },
        { type: "rock", weight: 3 },
        { type: "crate", weight: 3 },
        { type: "barrel", weight: 2 },
        { type: "tree", weight: 1 },
      ];
    } else {
      // crypt
      raidItems = [
        { type: "tombstone", weight: 5 },
        { type: "ruin_pillar", weight: 4 },
        { type: "rock", weight: 3 },
        { type: "mushroom", weight: 2 },
      ];
    }
    const raidDecor = scatterDecor(
      rng,
      terrain,
      rows,
      cols,
      reserved,
      raidItems,
      Math.floor(rows * cols * 0.1),
      2,
    );
    decor.push(...raidDecor);
  }

  return { config, terrain, warps, decor };
}
