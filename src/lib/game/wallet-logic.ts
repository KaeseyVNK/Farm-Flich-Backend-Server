/**
 * Wallet logic thuần (server-authoritative — audit C1, red-team #1).
 * Gold + Inventory = server. Client gửi delta, server validate vs giá trị thật.
 * Pure functions — dễ test, không phụ thuộc Prisma/Next context.
 */

/**
 * Validate gold delta. Throw nếu kết quả âm (cheat hoặc race loot).
 * Server Action gọi trước khi UPDATE User.gold.
 */
export function validateGoldDelta(current: number, delta: number): number {
  const next = current + delta;
  if (next < 0) throw new Error(`gold delta ${delta} làm gold âm (${current} → ${next})`);
  return next;
}

/**
 * Compute inventory delta. Trả ok=false nếu kết quả âm (loot race, owner save đè).
 * Server Action dùng newQty cho `UPDATE ... WHERE qty+delta>=0 RETURNING` — rowcount=0 → ok=false.
 */
export function computeInventoryDelta(
  currentQty: number,
  delta: number,
): { ok: boolean; newQty: number } {
  const next = currentQty + delta;
  if (next < 0) return { ok: false, newQty: currentQty };
  return { ok: true, newQty: next };
}
