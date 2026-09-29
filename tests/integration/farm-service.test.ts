import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { cleanDb } from "../helpers";
import { saveFarm, loadFarm, type FarmSaveData } from "@/lib/game/farm-service";

const OWNER = "test-farm-owner";
const THIEF = "test-farm-thief";
let farmId: string;

const SAMPLE: FarmSaveData = {
  terrain: new Array(900).fill(0),
  crops: { "5": { cropId: "wheat", stage: 2 } },
  objects: {},
  forage: {},
  shippingBoxes: {},
  gameMeta: { day: 3, season: "Spring", year: 1, timeMinutes: 600, energy: 200 },
};

beforeEach(async () => {
  await cleanDb();
  await db.user.createMany({ data: [{ id: OWNER, gold: 500 }, { id: THIEF }] });
  const f = await db.farm.create({
    data: { ownerId: OWNER, terrain: new Array(900).fill(0) },
  });
  farmId = f.id;
});

describe("saveFarm / loadFarm", () => {
  it("persist JSONB + bump version", async () => {
    const v1 = await saveFarm(OWNER, SAMPLE);
    expect(v1).toBe(1);
    const loaded = await loadFarm(OWNER);
    expect(loaded?.crops).toEqual({ "5": { cropId: "wheat", stage: 2 } });
    expect(loaded?.gameMeta).toMatchObject({ day: 3, season: "Spring" });
    const v2 = await saveFarm(OWNER, SAMPLE);
    expect(v2).toBe(2);
  });
  it("KHÔNG chứa gold trong gameMeta (audit C1)", async () => {
    await saveFarm(OWNER, { ...SAMPLE, gameMeta: { day: 1 } });
    const u = await db.user.findUnique({ where: { id: OWNER }, select: { gold: true } });
    expect(u?.gold).toBe(500); // gold vẫn ở User, không qua Farm
  });
});

describe("saveFarm lock-check (red-team #11)", () => {
  it("reject save khi RaidSession active", async () => {
    await db.raidSession.create({
      data: { farmId, ownerId: OWNER, thiefId: THIEF, status: "active" },
    });
    await expect(saveFarm(OWNER, SAMPLE)).rejects.toThrow(/locked/);
  });
  it("cho phép save khi raid resolved", async () => {
    await db.raidSession.create({
      data: { farmId, ownerId: OWNER, thiefId: THIEF, status: "resolved" },
    });
    const v = await saveFarm(OWNER, SAMPLE);
    expect(v).toBe(1);
  });
});

describe("partial unique index (audit M1 — 1 active raid/farm)", () => {
  it("reject 2 RaidSession active cùng farm", async () => {
    await db.raidSession.create({
      data: { farmId, ownerId: OWNER, thiefId: THIEF, status: "active" },
    });
    await expect(
      db.raidSession.create({
        data: { farmId, ownerId: OWNER, thiefId: THIEF, status: "active" },
      }),
    ).rejects.toThrow();
  });
});
