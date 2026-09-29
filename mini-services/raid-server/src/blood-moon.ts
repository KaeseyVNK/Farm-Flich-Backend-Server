// Blood-moon determinism (phase 7 — W9P3) — SERVER copy của
// `src/lib/game/story/blood-moon.ts` (raid-server isolated, không import client —
// pattern constants.ts). Seed = hash(ownerId + day) — KHÔNG hash(day + saveId)
// (saveId differs across devices). W9P3: story retired → KHÔNG gate chapter.
//
// Review H3b fix: day = UTC calendar date (server clock), KHÔNG Farm.gameMeta.day.
// gameMeta.day do owner save ghi — owner set day khớp collision value → blood-moon
// vĩnh viễn (loot ×2 farm). UTC date không client-controllable. Client-side
// isBloodMoon(day, userId) giờ dùng CÙNG key shape `${userId}:${YYYYMMDD}` —
// client truyền day-in-game vẫn lệch server; sync-comment giữ cho FX preview,
// authoritative flag luôn từ snapshot.bloodMoon (server-driven từ trước).

/** FNV-1a hash (deterministic, no Math.random). */
export function hashSeed(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Blood-moon khi: hash(ownerId + utcDayKey) % 7 === 0 (~1/7 ngày).
 * utcDayKey dạng YYYYMMDD — cùng format dayKey() social (social-rules.ts).
 * Deterministic trong cả ngày UTC; không tham số client nào đổi được.
 */
export function isBloodMoon(utcDayKey: number | string, serverUserId: string): boolean {
  const seed = hashSeed(`${serverUserId}:${utcDayKey}`);
  return seed % 7 === 0;
}

/** YYYYMMDD UTC hiện tại (server clock). */
export function currentUtcDayKey(nowMs: number = Date.now()): number {
  const d = new Date(nowMs);
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}
