import { test, expect, describe, beforeAll } from "vitest";
import { db } from "@/lib/db";
import { cleanDb } from "../helpers";

/**
 * add_inventory RPC (audit C3 fix). Atomic increment — KHÔNG overwrite.
 * Thief có 10 iron + steal 3 → 13 (không phải 3).
 */
describe("add_inventory RPC (C3 fix)", () => {
  beforeAll(async () => {
    await cleanDb();
    await db.user.create({ data: { id: "thief1" } });
  });

  test("INSERT mới khi chưa có row", async () => {
    await db.$executeRaw`SELECT add_inventory('thief1', 'wood', 5)`;
    const inv = await db.inventory.findUnique({
      where: { userId_itemId: { userId: "thief1", itemId: "wood" } },
    });
    expect(inv?.qty).toBe(5);
  });

  test("increment khi đã có row (KHÔNG overwrite)", async () => {
    // wood hiện 5, add 3 → 8
    await db.$executeRaw`SELECT add_inventory('thief1', 'wood', 3)`;
    const inv = await db.inventory.findUnique({
      where: { userId_itemId: { userId: "thief1", itemId: "wood" } },
    });
    expect(inv?.qty).toBe(8);
  });

  test("thief có 10 iron steal 3 → 13 (regression C3)", async () => {
    await db.inventory.create({ data: { userId: "thief1", itemId: "iron", qty: 10 } });
    await db.$executeRaw`SELECT add_inventory('thief1', 'iron', 3)`;
    const inv = await db.inventory.findUnique({
      where: { userId_itemId: { userId: "thief1", itemId: "iron" } },
    });
    expect(inv?.qty).toBe(13);
  });
});
