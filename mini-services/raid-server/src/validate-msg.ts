import type { ClientMsg } from "./protocol.js";

/**
 * Review C7: runtime validation cho ClientMsg — TS types chỉ compile-time.
 * JSON.parse cast as ClientMsg không chặn dx=1e9 (wall-clip) hay chestId rác.
 * Pure functions — unit test trực tiếp.
 */

/** Move vector hợp lệ: integer trong [-1, 1]. */
export function isValidMoveVector(dx: unknown, dy: unknown): boolean {
  return (
    Number.isInteger(dx) && Number.isInteger(dy) &&
    (dx as number) >= -1 && (dx as number) <= 1 &&
    (dy as number) >= -1 && (dy as number) <= 1
  );
}

/** Chest/tool id phải khớp rương thật (caller truyền danh sách id hợp lệ). */
export function isKnownChestId(chestId: string | undefined, validIds: string[]): boolean {
  if (chestId == null) return true; // use-tool smoke không cần chestId
  return typeof chestId === "string" && validIds.includes(chestId);
}

/**
 * Validate 1 ClientMsg đã parse. Trả msg nếu hợp lệ, null nếu drop.
 * Chỉ validate các field server dùng — không reject thêm (forward-compat).
 */
export function validateClientMsg(
  msg: ClientMsg,
  validChestIds: string[],
): ClientMsg | null {
  switch (msg.t) {
    case "move":
      return isValidMoveVector(msg.dx, msg.dy) ? msg : null;
    case "interact-chest":
      return isKnownChestId(msg.chestId, validChestIds) ? msg : null;
    case "use-tool":
      return isKnownChestId(msg.chestId, validChestIds) ? msg : null;
    case "puzzle-input": {
      if (!isKnownChestId(msg.chestId, validChestIds)) return null;
      if (!Array.isArray(msg.attempt) || msg.attempt.length > 64) return null;
      if (!msg.attempt.every((v) => Number.isInteger(v))) return null;
      return msg;
    }
    case "use-item":
      return typeof msg.itemId === "string" && msg.itemId.length > 0 && msg.itemId.length <= 40
        ? msg
        : null;
    case "exit":
      return msg;
    default:
      return null;
  }
}
