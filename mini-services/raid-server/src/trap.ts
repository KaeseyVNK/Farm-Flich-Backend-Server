import type { AlertState } from "./alert.js";

/**
 * Trap system (concept §3.2/§5/§10, audit H5 — trap hidden trong snapshot).
 * Owner đặt trap (DefenseConfig). Raider dẫm → effect. Cap 6/farm.
 * Trap = server-only field, KHÔNG trong snapshot. Chỉ `trap-sprung` event.
 *
 * 3 kind:
 * - bear: slow raider (move skip 50% trong slow window, tick-based)
 * - spike: alert bump 20, durability -1
 * - alarm: alert bump 40 + owner notify, durability -1
 *
 * Durability -1/spring, hết → remove trap.
 */
export type TrapKind = "bear" | "spike" | "alarm";

export interface Trap {
  id: string;
  kind: TrapKind;
  tile: number; // index y*MAP_COLS+x
  durability: number;
  level: 1 | 2 | 3;
}

/** Bear slow window (tick) — raider slow 2s @ 10Hz. */
export const BEAR_SLOW_TICKS = 20;
export const TRAP_CAP_PER_FARM = 6;
export const TRAP_DEFAULT_DURABILITY = 3;

/** Effect magnitude per kind. */
export const TRAP_EFFECT: Record<TrapKind, { alertBump: number }> = {
  bear: { alertBump: 0 },
  spike: { alertBump: 20 },
  alarm: { alertBump: 40 },
};

/** Room deps cần cho springTrap (mock-able cho test). */
export interface TrapRoomLike {
  tickN: number;
  raider: { slowUntilTick: number };
  alert: AlertState;
}

export interface SpringResult {
  removed: boolean;
  event: { tile: number; kind: TrapKind; damage: number };
}

/**
 * Spring trap khi raider dẫm. Áp effect, decay durability.
 * Trả removed=true nếu durability hết → room xóa trap.
 * Pure (trừ alert.bump side-effect — AlertState đã test riêng).
 */
export function springTrap(room: TrapRoomLike, trap: Trap): SpringResult {
  const mag = TRAP_EFFECT[trap.kind];
  switch (trap.kind) {
    case "bear":
      room.raider.slowUntilTick = room.tickN + BEAR_SLOW_TICKS;
      break;
    case "spike":
      room.alert.bump(mag.alertBump);
      break;
    case "alarm":
      room.alert.bump(mag.alertBump);
      break;
  }
  trap.durability -= 1;
  return {
    removed: trap.durability <= 0,
    event: { tile: trap.tile, kind: trap.kind, damage: mag.alertBump },
  };
}

/**
 * Kiểm tra trap tile hợp lệ để owner place.
 * - Trong range [0, MAP_COLS*MAP_ROWS)
 * - Non-solid (gọi solidFn)
 * - Không trùng tile đã có trap
 */
export function isValidTrapTile(
  tile: number,
  mapSize: number,
  solidFn: (t: number) => boolean,
  existingTiles: number[],
): boolean {
  if (tile < 0 || tile >= mapSize) return false;
  if (solidFn(tile)) return false;
  if (existingTiles.includes(tile)) return false;
  return true;
}

/** Cap check — reject nếu đã đạt TRAP_CAP_PER_FARM. */
export function canPlaceTrap(currentCount: number): boolean {
  return currentCount < TRAP_CAP_PER_FARM;
}
