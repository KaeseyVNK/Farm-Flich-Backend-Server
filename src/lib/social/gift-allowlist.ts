// Gift whitelist (phase 5, concept §7). Chỉ resources + crops — chặn tool/quest/ket/gold.
// RPC cũng enforce server-side (belt + suspenders).

const BLOCKED_PREFIX = ["tool_", "quest_", "ket_", "gold"];

export function isGiftable(itemId: string): boolean {
  return !BLOCKED_PREFIX.some((p) => itemId.startsWith(p));
}
