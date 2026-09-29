import { db } from "@/lib/db";

/**
 * Wallet service — server-authoritative gold + inventory (red-team #1, audit C1).
 * Dùng raw SQL atomic `UPDATE ... WHERE qty+delta>=0 RETURNING`:
 * - race-safe (loot finalize + owner save song song không over-deduct)
 * - chặn kết quả âm ở DB layer (không chỉ app-layer)
 *
 * Server Action `src/app/actions/wallet.ts` wrap: auth (session.user.id) + gọi service.
 */

/** Cộng/trừ gold atomic. Trả gold mới, hoặc throw nếu kết quả âm (0 row update). */
export async function addGold(userId: string, delta: number): Promise<number> {
  const rows = await db.$queryRaw<{ gold: number }[]>`
    UPDATE "User" SET gold = gold + ${delta}
    WHERE id = ${userId} AND gold + ${delta} >= 0
    RETURNING gold`;
  if (rows.length === 0) {
    throw new Error(`addGold reject: userId=${userId} delta=${delta} (kết quả âm hoặc user không tồn tại)`);
  }
  return Number(rows[0].gold);
}

/** Đọc gold hiện tại. */
export async function getGold(userId: string): Promise<number | null> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { gold: true } });
  return u?.gold ?? null;
}

/**
 * Update inventory atomic. Trả {ok, newQty}.
 * ok=false khi kết quả âm (insufficient qty) → caller KHÔNG áp dụng.
 */
export async function updateInventory(
  userId: string,
  itemId: string,
  delta: number,
): Promise<{ ok: boolean; newQty: number }> {
  // Upsert + atomic check trong 1 statement qua raw SQL.
  // INSERT ... ON CONFLICT DO UPDATE WHERE qty+delta>=0.
  const rows = await db.$queryRaw<{ qty: number }[]>`
    INSERT INTO "Inventory" ("id", "userId", "itemId", "qty")
    VALUES (gen_random_uuid(), ${userId}, ${itemId}, GREATEST(0, ${delta}))
    ON CONFLICT ("userId", "itemId")
    DO UPDATE SET qty = "Inventory"."qty" + ${delta}
    WHERE "Inventory"."qty" + ${delta} >= 0
    RETURNING qty`;
  if (rows.length === 0) {
    // 0 row: hoặc delta<0 làm INSERT GREATEST(0,...) nhưng row mới không trả khi ON CONFLICT rơi vào WHERE false.
    // Trường hợp INSERT mới luôn ok (delta>=0 → GREATEST 0). Chỉ 0 row khi UPDATE bị WHERE chặn.
    return { ok: false, newQty: 0 };
  }
  return { ok: true, newQty: Number(rows[0].qty) };
}

/** Đọc qty hiện tại của 1 item. */
export async function getInventoryQty(userId: string, itemId: string): Promise<number> {
  const r = await db.inventory.findUnique({
    where: { userId_itemId: { userId, itemId } },
    select: { qty: true },
  });
  return r?.qty ?? 0;
}
