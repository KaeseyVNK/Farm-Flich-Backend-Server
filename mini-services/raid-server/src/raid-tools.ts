import type { RaidRoom } from "./room.js";

/**
 * W7d-P2 — Tools chợ đen (§14). Mỗi tool 1 lần/raid (toolUses set do caller giữ):
 * - lockpick: +2s deadline puzzle chest đang mở (caller lưu deadline map).
 * - smoke: mọi chó stagger 3s (30 tick @10Hz) — thoát thân 1 lần.
 * Toy KHÔNG ở đây — dùng path useItem/mồi sẵn (room.ts: busy 100 tick thay 60).
 */

export type ToolId = "lockpick" | "smoke";

export const LOCKPICK_BONUS_MS = 2000;
export const SMOKE_STAGGER_TICKS = 30; // 3s @10Hz

export interface ToolResult {
  ok: boolean;
  /** lockpick thành công → deadline MỚI (ms epoch) để client cập nhật đếm ngược. */
  deadlineMs?: number;
  error?: string;
}

/** Áp tool — pure trên room + các state caller truyền vào (dễ test, không WS). */
export function applyToolUse(
  room: RaidRoom,
  toolUses: Set<string>,
  deadlines: Map<string, number>,
  toolId: string,
  chestId: string | undefined,
): ToolResult {
  if (toolId !== "lockpick" && toolId !== "smoke") return { ok: false, error: "tool_unknown" };
  if (toolUses.has(toolId)) return { ok: false, error: "tool_used" };

  if (toolId === "lockpick") {
    if (!chestId) return { ok: false, error: "tool_no_chest" };
    const dl = deadlines.get(chestId);
    if (dl == null) return { ok: false, error: "tool_no_puzzle" };
    const next = dl + LOCKPICK_BONUS_MS;
    deadlines.set(chestId, next);
    toolUses.add(toolId);
    return { ok: true, deadlineMs: next };
  }

  // smoke: stagger mọi chó 3s (busy chồng → max, không reset mồi đang ăn).
  for (const dog of room.dogs) {
    dog.busyUntilTick = Math.max(dog.busyUntilTick, room.tickN + SMOKE_STAGGER_TICKS);
  }
  toolUses.add(toolId);
  return { ok: true };
}
