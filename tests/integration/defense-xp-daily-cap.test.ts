import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { cleanDb } from "../helpers";

const OWNER = "cap-owner";
const THIEF = "cap-thief";
const FARM_ID = "cap-farm-1";

function sessionId(i: number) {
  return `cap-session-${i}`;
}

beforeEach(async () => {
  await cleanDb();
  await db.user.createMany({ data: [{ id: OWNER, gold: 500 }, { id: THIEF, gold: 500 }] });
  await db.farm.create({
    data: { id: FARM_ID, ownerId: OWNER, terrain: new Array(660).fill(0) },
  });
  await db.mask.create({ data: { userId: THIEF, maskId: "rogue", durability: 10 } });
  await db.inventory.create({ data: { userId: OWNER, itemId: "wood", qty: 100 } });
});

/** Chạy finalize_raid với defenseXp amount. Truyền p_defense_xp_daily_cap = 100. */
async function runFinalize(i: number, xp: number) {
  const shield = new Date(Date.now() + 7200_000).toISOString();
  await db.raidSession.create({
    data: {
      id: sessionId(i),
      farmId: FARM_ID,
      ownerId: OWNER,
      thiefId: THIEF,
      status: "active",
      startedAt: new Date(),
    },
  });
  await db.$executeRaw`SELECT finalize_raid(
    ${sessionId(i)}, ${FARM_ID}, ${OWNER}, ${THIEF}, 'rogue',
    ${shield}::timestamptz, ${xp}::int, 'exit',
    ${JSON.stringify({ reason: "exit" })}::jsonb, 3::int, 100::int
  )`;
}

describe("defense XP daily cap 100 (phase 3 F3.3)", () => {
  it("tích lũy trong ngày: 60 + 60 → 120 nhưng chỉ grant 100", async () => {
    await runFinalize(1, 60);
    await runFinalize(2, 60);
    const owner = await db.user.findUnique({ where: { id: OWNER } });
    expect(owner?.defenseXp).toBe(100); // cap 100, không phải 120
    expect(owner?.defenseXpToday).toBe(100);
    expect(owner?.defenseXpDate).not.toBeNull();
  });
  it("grant phần còn quota khi vượt (90 + 30 → +10)", async () => {
    await runFinalize(1, 90);
    await runFinalize(2, 30);
    const owner = await db.user.findUnique({ where: { id: OWNER } });
    expect(owner?.defenseXp).toBe(100); // 90 + 10
    expect(owner?.defenseXpToday).toBe(100);
  });
  it("đã đạt cap → raid tiếp không grant thêm", async () => {
    await runFinalize(1, 100);
    await runFinalize(2, 100);
    const owner = await db.user.findUnique({ where: { id: OWNER } });
    expect(owner?.defenseXp).toBe(100); // 100 + 0
  });
  it("reset theo ngày mới (defenseXpDate đổi ngày → reset counter)", async () => {
    await runFinalize(1, 100);
    // Mô phỏng ngày mới: set defenseXpDate về hôm qua.
    await db.user.update({
      where: { id: OWNER },
      data: { defenseXpDate: new Date(Date.now() - 86400_000) },
    });
    await runFinalize(2, 30);
    const owner = await db.user.findUnique({ where: { id: OWNER } });
    expect(owner?.defenseXp).toBe(130); // reset → 100 + 30
    expect(owner?.defenseXpToday).toBe(30);
  });
});
