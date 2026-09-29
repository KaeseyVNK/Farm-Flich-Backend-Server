/** Raid shared types (dùng cho client UI + server snapshot boundary). */

/** 3 cấp alert UI (design §Raid HUD). Internal FSM 4 state (Stealth/Suspicious/Warning/Alarm) map xuống 3 này. */
export type AlertLevel = "stealth" | "caution" | "alarm";

/** Snapshot entity — server gửi (audit C3: kèm velocity dx,dy cho client interpolation). */
export interface RaidEntity {
  id: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  facing: "up" | "down" | "left" | "right";
}

/** Snapshot 5Hz từ raid-server. */
export interface RaidSnapshot {
  tick: number;
  you: RaidEntity;
  dogs: RaidEntity[];
  chests: { id: string; x: number; y: number; open: boolean }[];
  alert: { level: AlertLevel; score: number };
  lockdown: boolean;
  mapBiome?: string;
  exitDeadlineMs?: number;
  /** Phase 7 blood-moon raid — client render FX (đỏ tối + dog mạnh). */
  bloodMoon?: boolean;
  /** W7b-P3: mồi đang nằm trên sân (item công khai của thief). */
  placedItems?: { itemId: string; x: number; y: number }[];
}

// ===== Client-side protocol (mirror raid-server/src/protocol.ts) =====
/** W7c: 6 puzzle kind — mỗi tier chest 2 puzzle (mirror raid-server chest-puzzle-kind.ts). */
export type RaidPuzzleKind =
  | "memory"
  | "circuit"
  | "timing"
  | "lock-rotate"
  | "sequence"
  | "jigsaw";
export type ClientMsg =
  | { t: "move"; dx: -1 | 0 | 1; dy: -1 | 0 | 1 }
  | { t: "interact-chest"; chestId: string }
  | { t: "puzzle-input"; chestId: string; attempt: number[] }
  | { t: "use-item"; itemId: string } // W7b-P3: mồi dụ — server đặt tại tile thief đứng
  | { t: "use-tool"; toolId: "lockpick" | "smoke"; chestId?: string } // W7d-P2 chợ đen
  | { t: "exit" };

export type ServerMsg =
  | { t: "snapshot"; snap: RaidSnapshot }
  | { t: "alert-level"; level: AlertLevel; score: number; reason: string }
  // W7c: 6 kind (mỗi tier 2 puzzle). Payload kèm: circuit shapes+rot, lock-rotate
  // offsets+sizes, jigsaw perm. Mirror mini-services/raid-server/src/protocol.ts.
  | { t: "puzzle-start"; chestId: string; kind: "memory" | "timing" | "sequence" | "circuit" | "lock-rotate" | "jigsaw"; seq?: number[]; deadlineMs: number; lo?: number; hi?: number; size?: number; shapes?: number[]; rot?: number[]; offsets?: number[]; sizes?: number[]; perm?: number[] }
  | { t: "puzzle-result"; chestId: string; ok: boolean; loot?: { itemId: string; qty: number }[] }
  | { t: "deadline-ext"; chestId: string; deadlineMs: number } // W7d-P2 lockpick +2s
  | { t: "trap-sprung"; tile: number; kind: "bear" | "spike" | "alarm"; damage: number }
  | { t: "lockdown"; gateCloseTick: number }
  | { t: "raid-end"; reason: "exit" | "caught" | "timeout"; keptLoot: { itemId: string; qty: number }[]; maskDurabilityLoss: number }
  | { t: "error"; code: string; msg: string };
