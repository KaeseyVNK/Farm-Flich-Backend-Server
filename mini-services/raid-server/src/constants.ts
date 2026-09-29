// Masked Farm raid-server constants.
// DUPLICATE từ src/lib/game/constants.ts (service độc lập — red-team #19).
// Runtime assert khi load farm: MAP_COLS*MAP_ROWS === terrain.length (drift check, không CI).

// TILE_SIZE synced với client (phase 3: 32→48). Entity coord = tile index (không pixel),
// nên đổi TILE_SIZE KHÔNG ảnh hưởng raid logic — chỉ render client scale. Spike verified.
export const TILE_SIZE = 48;
export const MAP_COLS = 30;
export const MAP_ROWS = 22;
export const MAP_AREA = MAP_COLS * MAP_ROWS; // 660

// Tile types (layer: terrain) — đồng bộ src/lib/game/constants.ts
export const T = {
  GRASS: 0,
  GRASS_FLOWER: 1,
  PATH: 2,
  WATER: 3,
  TILLED: 4,
  TILLED_WET: 5,
  TREE: 6,
  STUMP: 7,
  ROCK: 8,
  STONE_EMPTY: 9,
  FENCE: 10,
  FLOWER_BUSH: 11,
  SAND: 12,
  BRIDGE: 13,
} as const;

export const SOLID_TILES = new Set<number>([T.WATER, T.TREE, T.ROCK, T.FENCE, T.FLOWER_BUSH]);

// Raid tick
export const TICK_HZ = 10;
export const TICK_MS = 1000 / TICK_HZ;
export const SNAPSHOT_EVERY_N_TICKS = 2; // 5 Hz

// Alert FSM
export const ALERT_STEALTH = 25;
export const ALERT_CAUTION = 60;
export const ALERT_ALARM = 80;
export const ALERT_DECAY_PER_SEC = 5;
export const ALERT_DECAY_GRACE_MS = 4000;

// Bite (concept §10.1)
export const MAX_BITES = 3;

/**
 * Review H3: hard cap thời lượng raid — 21000 tick = 35 phút @10Hz. > replay
 * cap 33ph (20000 events) một chút; đủ dài cho mọi raid hợp lệ, chặn idle raider
 * giữ farm active vĩnh viễn.
 */
export const MAX_RAID_TICKS = 21_000;

// Defense upgrade (phase 3) — level effect + cost.
export const DEFENSE_MAX_LEVEL = 3;
export const DEFENSE_UPGRADE_COST_PER_LEVEL = 50; // XP cost = level * 50
/** Dog level → vision/hearing +1/level. */
export function dogVisionForLevel(level: number, base: number): number {
  return base + (level - 1);
}
export function dogHearingForLevel(level: number, base: number): number {
  return base + (level - 1);
}
/** Trap level → durability +1/level. */
export function trapDurabilityForLevel(level: number, base: number): number {
  return base + (level - 1);
}

// Dog
export const DOG_VISION_TILES = 6;
export const DOG_HEARING_TILES = 3;

// Daily raid cap (audit H6)
export const DAILY_RAID_CAP = 3;

/** Lockdown escalation (phase 9 F9.3): dog chase tăng tốc ×1.4 (tick-skip -1). */
export const DOG_CHASE_SPEED_MUL = 1.4;

// Alt-F4 grace (red-team #10): disconnect < 5s → reconnect session cũ (dog không reset).
export const GRACE_ABORT_MS = 5000;
/** Periodic in-flight replay flush (red-team #10): mỗi 5s = 50 ticks @10Hz. */
export const SNAPSHOT_FLUSH_EVERY_TICKS = 50;
/** Rate-limit join (audit M10): tối đa JOIN_ATTEMPTS_WINDOW trong 30s / user. */
export const JOIN_RATE_MAX = 5;
export const JOIN_RATE_WINDOW_MS = 30_000;

/**
 * Finalize retry cap. Khi finalize_raid RPC fail lặp lại (DB down/mạng) → sau
 * FINALIZE_RETRY_MAX lần, force-resolve DB + xóa room chặn retry loop 10Hz mãi
 * mãi + memory leak. Ponytail: backoff (exponential) thay fixed — thêm khi DB
 * incidents kéo dài observed. Watchdog §D (setInterval) backstop riêng.
 */
export const FINALIZE_RETRY_MAX = 5;

/**
 * Watchdog: poll session active > STALE_SESSION_MS → force-resolve. Backstop khi
 * process crash giữa finalize (session stuck active → partial unique idx chặn farm).
 * 40 phút > max raid length 33ph (replay cap 20000 events / 10Hz) → không dọn
 * session đang chạy.
 */
export const STALE_SESSION_MS = 40 * 60 * 1000;
/** Watchdog poll interval. */
export const WATCHDOG_INTERVAL_MS = 60 * 1000;

/** Assert map size khớp khi load farm (drift check — red-team #19). */
export function assertMapSize(terrainLength: number): void {
  if (terrainLength !== MAP_AREA) {
    throw new Error(`map drift: terrain ${terrainLength} ≠ MAP_AREA ${MAP_AREA}`);
  }
}

// W7d-P1: guard-rep ≥ 50 → dog vision +1 tile (§14).
// SYNC-COMMENT: duplicate client src/lib/raid/constants.ts REPUTATION_EFFECTS.GUARD_VISION_AT
// (raid-server không import src/). % +5% bị floor nuốt ở tầm 6 tile → flat +1 tile.
export const GUARD_REP_VISION_BONUS_AT = 50;
