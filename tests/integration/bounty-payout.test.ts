import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { db } from "@/lib/db";
import { cleanDb, setAuthUid } from "../helpers";

const CATCHER = "bounty-catcher";
const THIEF = "bounty-thief";
const PLACER = "bounty-placer";
const FARM_ID = "bounty-farm";
const SESSION_ID = "bounty-session";

beforeEach(async () => {
  await cleanDb();
  await setAuthUid(null);
  await db.user.createMany({
    data: [
      { id: CATCHER, gold: 100 },
      { id: THIEF, gold: 0 },
      { id: PLACER, gold: 0 },
    ],
  });
  await db.farm.create({
    data: { id: FARM_ID, ownerId: CATCHER, terrain: [0] },
  });
  await db.mask.create({ data: { userId: THIEF, maskId: "rogue", durability: 10 } });
  await db.raidSession.create({
    data: {
      id: SESSION_ID,
      farmId: FARM_ID,
      ownerId: CATCHER,
      thiefId: THIEF,
      status: "active",
      startedAt: new Date(),
    },
  });
  await db.bounty.create({
    data: { id: "bounty-1", ownerId: PLACER, thiefId: THIEF, gold: 80, status: "active" },
  });
});

afterEach(async () => {
  await setAuthUid(null);
});

describe("bounty payout on catch (live RPC)", () => {
  it("finalize_raid caught pays catcher and marks bounty paid", async () => {
    const shieldUntil = new Date(Date.now() + 7200_000).toISOString();
    await db.$executeRaw`SELECT finalize_raid(
      ${SESSION_ID}, ${FARM_ID}, ${CATCHER}, ${THIEF}, ${"rogue"},
      ${shieldUntil}::timestamptz, 0::int, 'caught',
      ${JSON.stringify({ reason: "caught" })}::jsonb, 3::int
    )`;
    const catcher = await db.user.findUnique({ where: { id: CATCHER } });
    expect(catcher?.gold).toBe(180);
    const b = await db.bounty.findUnique({ where: { id: "bounty-1" } });
    expect(b?.status).toBe("paid");
  });

  it("self-catch pays nothing", async () => {
    const n = await db.$queryRaw<{ payout_bounties_on_catch: number }[]>`
      SELECT payout_bounties_on_catch(${THIEF}, ${THIEF})
    `;
    expect(n[0]?.payout_bounties_on_catch).toBe(0);
    const b = await db.bounty.findUnique({ where: { id: "bounty-1" } });
    expect(b?.status).toBe("active");
  });
});

describe("bump_reputation return (live RPC)", () => {
  it("returns jsonb row when auth.uid is NULL (service-role)", async () => {
    const rows = await db.$queryRaw<{ bump_reputation: { farmer: number; thief: number; guard: number } }[]>`
      SELECT bump_reputation(${CATCHER}, 2, 0, 1) AS bump_reputation
    `;
    expect(rows[0]?.bump_reputation).toMatchObject({ farmer: 2, thief: 0, guard: 1 });
  });
});
