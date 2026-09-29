import { test, expect, describe, beforeAll } from "vitest";
import { db } from "@/lib/db";
import { cleanDb } from "../helpers";

/**
 * spend_defense_xp + DefenseConfig composite unique (audit C4 fix).
 * Upgrade trap level KHÔNG wipe kind/tile/durability. Monotonic guard.
 */
describe("spend_defense_xp RPC (C4 fix)", () => {
  beforeAll(async () => {
    await cleanDb();
    await db.user.create({ data: { id: "owner1", defenseXp: 500 } });
  });

  test("composite unique: dog@slot=0 + trap@slot=0 cùng tồn tại", async () => {
    await db.defenseConfig.create({
      data: { userId: "owner1", slot: 0, type: "dog", payload: { level: 1 } },
    });
    await db.defenseConfig.create({
      data: {
        userId: "owner1",
        slot: 0,
        type: "trap",
        payload: { kind: "spike", tile: 42, durability: 3, level: 1 },
      },
    });
    const rows = await db.defenseConfig.findMany({ where: { userId: "owner1" } });
    expect(rows.length).toBe(2);
  });

  test("upgrade trap L3 KHÔNG wipe kind/tile/durability (payload merge)", async () => {
    await db.$executeRaw`SELECT spend_defense_xp('owner1', 'trap', 0, 3)`;
    const trap = await db.defenseConfig.findFirst({
      where: { userId: "owner1", type: "trap", slot: 0 },
    });
    expect(trap?.payload).toMatchObject({ kind: "spike", tile: 42, durability: 3, level: 3 });
  });

  test("monotonic: reject upgrade trap L2 khi đã L3", async () => {
    await expect(
      db.$executeRaw`SELECT spend_defense_xp('owner1', 'trap', 0, 2)`,
    ).rejects.toThrow();
  });

  test("XP bị trừ khi upgrade thành công", async () => {
    const u = await db.user.findUnique({ where: { id: "owner1" } });
    // 500 - 150 (trap L3)
    expect(u?.defenseXp).toBe(350);
  });
});
