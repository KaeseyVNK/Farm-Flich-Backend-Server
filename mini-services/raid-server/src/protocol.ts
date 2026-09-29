// WS message protocol (discriminated union on `t`).
// PAYLOAD KHÔNG chứa jwt — auth qua cookie ở fetch upgrade (red-team #3).
// Snapshot KHÔNG chứa trap (audit H5/§3.2). Entity kèm velocity dx,dy (audit C3).

import type { AlertLevel } from "./types.js";

// ===== Client → Server =====
export type ClientMsg =
  | { t: "join"; farmId: string; maskId: string } // KHÔNG jwt
  | { t: "move"; dx: -1 | 0 | 1; dy: -1 | 0 | 1 }
  | { t: "interact-chest"; chestId: string }
  | { t: "puzzle-input"; chestId: string; attempt: number[] }
  | { t: "use-item"; itemId: string; targetTile?: number }
  | { t: "use-tool"; toolId: "lockpick" | "smoke"; chestId?: string } // W7d-P2 chợ đen
  | { t: "exit" };

// ===== Server → Client =====
export type ServerMsg =
  | { t: "snapshot"; snap: SnapshotMsg }
  | { t: "alert-level"; level: AlertLevel; score: number; reason: string }
  // W7c: thêm 3 kind mới (circuit/lock-rotate/jigsaw) — payload kèm theo từng loại.
  | { t: "puzzle-start"; chestId: string; kind: "memory" | "timing" | "sequence" | "circuit" | "lock-rotate" | "jigsaw"; seq?: number[]; deadlineMs: number; lo?: number; hi?: number; size?: number; shapes?: number[]; rot?: number[]; offsets?: number[]; sizes?: number[]; perm?: number[] }
  | { t: "puzzle-result"; chestId: string; ok: boolean; loot?: { itemId: string; qty: number }[] }
  | { t: "trap-sprung"; tile: number; kind: "bear" | "spike" | "alarm"; damage: number } // trap chỉ khi trigger (KHÔNG trong snapshot)
  | { t: "lockdown"; gateCloseTick: number }
  | { t: "deadline-ext"; chestId: string; deadlineMs: number } // W7d-P2 lockpick +2s
  | { t: "raid-end"; reason: "exit" | "caught" | "timeout"; keptLoot: { itemId: string; qty: number }[]; maskDurabilityLoss: number }
  | { t: "error"; code: string; msg: string };

export interface EntityMsg {
  id: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  facing: "up" | "down" | "left" | "right";
}

export interface SnapshotMsg {
  tick: number;
  you: EntityMsg;
  dogs: EntityMsg[];
  chests: { id: string; x: number; y: number; open: boolean }[];
  alert: { level: AlertLevel; score: number };
  lockdown: boolean;
  mapBiome?: string;
  exitDeadlineMs?: number;
  /** Phase 7 blood-moon raid — client render FX (đỏ tối + dog mạnh). */
  bloodMoon?: boolean;
  /** W7b-P3: mồi đang nằm trên sân (công khai — item của thief). */
  placedItems?: { itemId: string; x: number; y: number }[];
}
