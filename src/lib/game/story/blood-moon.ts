// Blood-moon determinism (ADR phase 7 + I12). isBloodMoon(day, flags) deterministic.
// Seed = hash(serverUserId + day) — KHÔNG hash(day + saveId) (saveId differs across devices).
// Blood-moon window: ~1/7 ngày (cửa sổ 1 đêm).
//
// W9P3: DETACH chapter — story 5-chapter retired. Trước đây gate `chapter >= 2`
// (post-tutorial); giờ TRIGGER MỞ NGAY từ day 1 (W7 raid endgame là nội dung chính,
// không chờ story — chapter cũ chỉ tồn tại vì demo). Raid-server copy sync-comment
// dưới đây phải giữ đồng bộ (pattern constants.ts).

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
 * Blood-moon xảy ra khi: hash(serverUserId+day) % 7 === 0.
 * Deterministic across devices (serverUserId stable). Window = 1 đêm.
 * KHÔNG còn gate chapter (W9P3 — story retired).
 */
export function isBloodMoon(day: number, serverUserId: string): boolean {
  const seed = hashSeed(`${serverUserId}:${day}`);
  return seed % 7 === 0;
}

/** Blood-moon gameplay effects (read bởi raid start + main-map combat phase 7). */
export interface BloodMoonEffects {
  enemyDamageMul: number;
  lootMul: number;
  dogVisionBonus: number;
  alertMod: number; // alert tăng nhanh hơn
}

export function bloodMoonEffects(active: boolean): BloodMoonEffects {
  if (!active) return { enemyDamageMul: 1, lootMul: 1, dogVisionBonus: 0, alertMod: 0 };
  return {
    enemyDamageMul: 1.5,
    lootMul: 2,
    dogVisionBonus: 2,
    alertMod: 10,
  };
}

/** Property test helper: determinism — cùng (day, userId) → cùng kết quả. */
export function bloodMoonDeterministic(day: number, serverUserId: string, runs = 100): boolean {
  const first = isBloodMoon(day, serverUserId);
  for (let i = 0; i < runs; i++) {
    if (isBloodMoon(day, serverUserId) !== first) return false;
  }
  return true;
}
