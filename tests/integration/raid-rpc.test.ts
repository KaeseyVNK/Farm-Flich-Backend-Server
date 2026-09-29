import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { cleanDb } from "../helpers";

/**
 * Integration test RPC finalize (phase 7). Docker postgres :5433.
 * Test deduct_inventory atomic + finalize_raid transaction.
 */
const OWNER = "rpc-owner";
const THIEF = "rpc-thief";
const FARM_ID = "rpc-farm-1";
const SESSION_ID = "rpc-session-1";
const MASK = "rogue";

beforeEach(async () => {
  await cleanDb();
  await db.user.create({ data: { id: OWNER, gold: 500 } });
  await db.user.create({ data: { id: THIEF, gold: 500 } });
  await db.farm.create({
    data: {
      id: FARM_ID,
      ownerId: OWNER,
      terrain: new Array(660).fill(0),
    },
  });
  await db.mask.create({ data: { userId: THIEF, maskId: MASK, durability: 10 } });
  await db.inventory.create({ data: { userId: OWNER, itemId: "wood", qty: 100 } });
  await db.raidSession.create({
    data: {
      id: SESSION_ID,
      farmId: FARM_ID,
      ownerId: OWNER,
      thiefId: THIEF,
      status: "active",
      startedAt: new Date(),
    },
  });
});

describe("deduct_inventory RPC", () => {
  it("trừ đủ → trả qty mới", async () => {
    const rows = (await db.$queryRaw`SELECT deduct_inventory(${OWNER}, 'wood', 30) AS q`) as {
      q: number | null
    }[];
    expect(rows[0]?.q).toBe(70);
  });
  it("không đủ → NULL (atomic reject, qty nguyên vẹn)", async () => {
    const rows = (await db.$queryRaw`SELECT deduct_inventory(${OWNER}, 'wood', 999) AS q`) as {
      q: number | null
    }[];
    expect(rows[0]?.q).toBeNull();
    const inv = await db.inventory.findUnique({
      where: { userId_itemId: { userId: OWNER, itemId: "wood" } },
    });
    expect(inv?.qty).toBe(100);
  });
});

describe("spend_defense_xp RPC (phase 3)", () => {
  it("happy — đủ XP → deduct + upsert DefenseConfig", async () => {
    await db.user.update({ where: { id: OWNER }, data: { defenseXp: 200 } });
    await db.$executeRaw`SELECT spend_defense_xp(${OWNER}, 'dog', 0, 2)`;
    const u = await db.user.findUnique({ where: { id: OWNER } });
    expect(u?.defenseXp).toBe(100); // 200 - 2*50
    const def = await db.defenseConfig.findUnique({
      where: { userId_slot_type: { userId: OWNER, slot: 0, type: "dog" } },
    });
    expect(def?.type).toBe("dog");
    expect((def?.payload as { level?: number }).level).toBe(2);
  });
  it("insufficient XP → reject rollback (không trừ)", async () => {
    await db.user.update({ where: { id: OWNER }, data: { defenseXp: 30 } });
    await expect(
      db.$executeRaw`SELECT spend_defense_xp(${OWNER}, 'trap', 1, 2)`,
    ).rejects.toThrow();
    const u = await db.user.findUnique({ where: { id: OWNER } });
    expect(u?.defenseXp).toBe(30); // nguyên vẹn
  });
});

describe("finalize_raid RPC", () => {
  it("set shield + bump daily count + mask -1 + defense XP + resolved", async () => {
    const shieldUntil = new Date(Date.now() + 7200_000).toISOString();
    await db.$executeRaw`SELECT finalize_raid(
      ${SESSION_ID}, ${FARM_ID}, ${OWNER}, ${THIEF}, ${MASK},
      ${shieldUntil}::timestamptz, 1::int, 'exit',
      ${JSON.stringify({ reason: "exit" })}::jsonb, 3::int
    )`;
    const farm = await db.farm.findUnique({ where: { id: FARM_ID } });
    expect(farm?.dailyRaidCount).toBe(1);
    expect(farm?.shieldUntil).not.toBeNull();
    const mask = await db.mask.findUnique({
      where: { userId_maskId: { userId: THIEF, maskId: MASK } },
    });
    expect(mask?.durability).toBe(9);
    const owner = await db.user.findUnique({ where: { id: OWNER } });
    expect(owner?.defenseXp).toBe(1);
    const session = await db.raidSession.findUnique({ where: { id: SESSION_ID } });
    expect(session?.status).toBe("resolved");
    expect(session?.endedAt).not.toBeNull();
  });
  it("daily count reset khi > 24h", async () => {
    await db.farm.update({
      where: { id: FARM_ID },
      data: { dailyRaidCount: 3, dailyRaidResetAt: new Date(Date.now() - 25 * 3600_000) },
    });
    const shieldUntil = new Date(Date.now() + 7200_000).toISOString();
    await db.$executeRaw`SELECT finalize_raid(
      ${SESSION_ID}, ${FARM_ID}, ${OWNER}, ${THIEF}, ${MASK},
      ${shieldUntil}::timestamptz, 0::int, 'caught',
      ${JSON.stringify({ reason: "caught" })}::jsonb, 3::int
    )`;
    const farm = await db.farm.findUnique({ where: { id: FARM_ID } });
    expect(farm?.dailyRaidCount).toBe(1); // reset từ 3 → 0 → +1
  });
  it("idempotent — re-run session đã resolved → rollback, không double bump (code-review F3)", async () => {
    const shieldUntil = new Date(Date.now() + 7200_000).toISOString();
    // Lần 1: OK
    await db.$executeRaw`SELECT finalize_raid(
      ${SESSION_ID}, ${FARM_ID}, ${OWNER}, ${THIEF}, ${MASK},
      ${shieldUntil}::timestamptz, 1::int, 'exit',
      ${JSON.stringify({ reason: "exit" })}::jsonb, 3::int
    )`;
    const maskAfter1 = await db.mask.findUnique({
      where: { userId_maskId: { userId: THIEF, maskId: MASK } },
    });
    expect(maskAfter1?.durability).toBe(9);
    // Lần 2: session đã resolved → RAISE → rollback transaction
    await expect(
      db.$executeRaw`SELECT finalize_raid(
        ${SESSION_ID}, ${FARM_ID}, ${OWNER}, ${THIEF}, ${MASK},
        ${shieldUntil}::timestamptz, 1::int, 'exit',
        ${JSON.stringify({ reason: "exit" })}::jsonb, 3::int
      )`,
    ).rejects.toThrow();
    // Mask không bị trừ thêm lần 2
    const maskAfter2 = await db.mask.findUnique({
      where: { userId_maskId: { userId: THIEF, maskId: MASK } },
    });
    expect(maskAfter2?.durability).toBe(9);
  });
});
