import { RaidRoom } from "./room.js";
import { TICK_MS, SNAPSHOT_EVERY_N_TICKS } from "./constants.js";
import type { RaidEventRow } from "./replay-types.js";
import type { SnapshotMsg } from "./protocol.js";
import type { Trap } from "./trap.js";
import type { Tile } from "./types.js";

/**
 * Full re-sim replay (phase 9 F9.5).
 * Load RaidEvent[] ordered (tick, seq) → new RaidRoom headless → loop applyEvent + tick
 * → capture snapshot mỗi N tick → return SnapshotMsg[] cho client scrub/play.
 *
 * Determinism: tick-based (KHÔNG Date.now()), mulberry32(hashStr(seed)) cho puzzle/patrol,
 * loot seeded. Trap sprung deterministic qua tick() checkTrapCollision.
 */
export interface ReplayConfig {
  terrain: number[];
  enterTile: Tile;
  /** breed/patrol optional — khớp RaidRoom opts (re-sim dùng breed stats + patrol). */
  dogs: { x: number; y: number; breed?: string; patrol?: { x: number; y: number }[] }[];
  chests: { id: string; x: number; y: number; kind?: "wood" | "iron" | "safe" }[];
  seed: string;
  traps?: Trap[];
  dogLevel?: number;
  trapLevel?: number;
  maskId?: string;
  mapId?: string;
  /** Blood-moon flag — replay re-sim biome override (vision/hearing/decay). */
  bloodMoon?: boolean;
  /** W7d-P1: truyền thẳng vào RaidRoom — dog vision +1 tile khi true. */
  guardBonus?: boolean;
}

export function replayEvents(opts: {
  config: ReplayConfig;
  events: RaidEventRow[];
}): SnapshotMsg[] {
  // bloodMoon trong ReplayConfig truyền thẳng vào RaidRoom constructor →
  // biome override deterministic (cùng flag → cùng biome → cùng vision/decay).
  const room = new RaidRoom(opts.config);
  const snaps: SnapshotMsg[] = [room.snapshot()];
  const events = [...opts.events].sort((a, b) => a.tick - b.tick || a.seq - b.seq);
  for (const ev of events) {
    if (ev.type === "tick") {
      room.tick(TICK_MS);
      if (room.tickN % SNAPSHOT_EVERY_N_TICKS === 0) snaps.push(room.snapshot());
      if (room.ended) break;
    } else {
      room.applyEvent(ev);
    }
  }
  // Đảm bảo snapshot cuối khớp live (dù không tròn N tick)
  snaps.push(room.snapshot());
  return snaps;
}
