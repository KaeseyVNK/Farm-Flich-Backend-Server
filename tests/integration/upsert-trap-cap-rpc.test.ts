import { test, expect, describe, beforeAll, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { cleanDb } from "../helpers";

/**
 * upsert_trap RPC: cap 6 trap/farm + composite unique.
 * Atomic User FOR UPDATE + count (exclude slot upsert) → chặn RMW race
 * (2 upsert khác slot cùng đọc count=5 < 6 → 8 trap). Loop 9 fix.
 *
 * auth.uid() guard: Prisma direct connection không có Supabase auth context →
 * auth.uid()=NULL → IF NULL <> p_user = NULL (SQL 3-valued) = FALSE branch →
 * guard không fire. Test cap logic OK. Guard test qua E2E (server action cookie).
 *
 * Literal inline pattern (giống add-inventory-rpc.test.ts): test data controlled
 * (slot/tile int, kind enum) → KHÔNG SQL injection risk. Bound param Prisma infer
 * type unknown → function match fail (42883) → phải literal.
 */
async function trapCall(slot: number, kind: string, tile: number, dur: number, level: number) {
  const payload = JSON.stringify({ kind, tile, durability: dur, level });
  await db.$executeRaw`SELECT upsert_trap('owner_cap', ${slot}::int, ${payload}::jsonb)`;
}

describe("upsert_trap RPC cap (loop 9 fix)", () => {
  beforeAll(async () => {
    await cleanDb();
    await db.user.create({ data: { id: "owner_cap" } });
  });

  beforeEach(async () => {
    await db.defenseConfig.deleteMany({ where: { userId: "owner_cap" } });
  });

  test("insert 6 trap OK, slot 7 reject cap", async () => {
    for (let slot = 0; slot < 6; slot++) {
      await trapCall(slot, "spike", slot, 3, 1);
    }
    const count = await db.defenseConfig.count({
      where: { userId: "owner_cap", type: "trap" },
    });
    expect(count).toBe(6);

    // Slot 6 = trap thứ 7 → RAISE check_violation (cap 6).
    await expect(trapCall(6, "spike", 6, 3, 1)).rejects.toThrow();
  });

  test("upsert cùng slot KHÔNG tăng count (update thay vì insert)", async () => {
    await trapCall(0, "bear", 5, 2, 1);
    await trapCall(0, "alarm", 9, 4, 2);
    const traps = await db.defenseConfig.findMany({
      where: { userId: "owner_cap", type: "trap", slot: 0 },
    });
    expect(traps.length).toBe(1);
    expect(traps[0]?.payload).toMatchObject({ kind: "alarm", tile: 9, level: 2 });
  });

  test("cap exclude slot đang upsert — re-upsert slot đã có khi count=6 OK", async () => {
    for (let slot = 0; slot < 6; slot++) {
      await trapCall(slot, "spike", slot, 3, 1);
    }
    // Re-upsert slot 3 (đã có) → count exclude slot 3 = 5 < 6 → OK (update payload).
    await trapCall(3, "bear", 99, 5, 3);
    const t = await db.defenseConfig.findFirst({
      where: { userId: "owner_cap", type: "trap", slot: 3 },
    });
    expect(t?.payload).toMatchObject({ kind: "bear", tile: 99, level: 3 });
  });
});
