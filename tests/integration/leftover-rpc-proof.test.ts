import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { db } from "@/lib/db";
import { cleanDb, setAuthUid } from "../helpers";

const SELF = "fest-self";
const FRIEND = "fest-friend";
const STRANGER = "fest-stranger";

beforeEach(async () => {
  await cleanDb();
  await setAuthUid(SELF);
  const day = Number(
    new Date().toISOString().slice(0, 10).replace(/-/g, ""),
  );
  await db.user.createMany({
    data: [
      { id: SELF, displayName: "Me", gold: 10 },
      { id: FRIEND, displayName: "Pal", gold: 9999 },
      { id: STRANGER, displayName: "Nope", gold: 1 },
    ],
  });
  await db.farm.create({
    data: {
      id: "fest-farm-self",
      ownerId: SELF,
      terrain: [0],
      placedDecor: [{ defId: "fence_wood", zone: "farm" }],
      gameMeta: { gold: 1 },
      shippingBoxes: { a: 1 },
    },
  });
  await db.farm.create({
    data: {
      id: "fest-farm-friend",
      ownerId: FRIEND,
      terrain: [0],
      placedDecor: [
        { defId: "fence_wood", zone: "farm" },
        { defId: "fence_wood", zone: "house" },
      ],
    },
  });
  await db.farm.create({
    data: {
      id: "fest-farm-stranger",
      ownerId: STRANGER,
      terrain: [0],
      placedDecor: [{ defId: "fence_wood", zone: "farm" }],
    },
  });
  await db.friendship.create({
    data: {
      userAId: FRIEND < SELF ? FRIEND : SELF,
      userBId: FRIEND < SELF ? SELF : FRIEND,
      status: "accepted",
      initiatorId: SELF,
    },
  });
  await db.farmLike.create({
    data: { farmOwnerId: FRIEND, visitorId: SELF, day },
  });
});

afterEach(async () => {
  await setAuthUid(null);
});

describe("festival_friend_contest live RPC", () => {
  it("returns self + accepted friends only; placedDecor defId/zone; no gold", async () => {
    const rows = await db.$queryRaw<{ festival_friend_contest: unknown }[]>`
      SELECT festival_friend_contest() AS festival_friend_contest
    `;
    const board = rows[0]?.festival_friend_contest as {
      userId: string;
      displayName: string | null;
      likes: number;
      placedDecor: { defId: string; zone: string }[];
    }[];
    expect(Array.isArray(board)).toBe(true);
    const ids = board.map((r) => r.userId).sort();
    expect(ids).toEqual([FRIEND, SELF].sort());
    expect(ids.includes(STRANGER)).toBe(false);
    const pal = board.find((r) => r.userId === FRIEND)!;
    expect(pal.likes).toBe(1);
    expect(pal.placedDecor).toEqual([
      { defId: "fence_wood", zone: "farm" },
      { defId: "fence_wood", zone: "house" },
    ]);
    expect(JSON.stringify(board).includes("9999")).toBe(false);
    expect(JSON.stringify(board).includes("gameMeta")).toBe(false);
    expect(JSON.stringify(board).includes("shippingBoxes")).toBe(false);
  });

  it("unauthenticated raises", async () => {
    await setAuthUid(null);
    await expect(
      db.$executeRaw`SELECT festival_friend_contest()`,
    ).rejects.toThrow();
  });
});

describe("listing + visit live RPC", () => {
  it("list_raidable_farms omits self and banned columns", async () => {
    const farms = await db.$queryRaw<
      { id: string; ownerId: string; displayName: string | null }[]
    >`SELECT * FROM list_raidable_farms()`;
    expect(farms.some((f) => f.ownerId === SELF)).toBe(false);
    expect(farms.some((f) => f.ownerId === FRIEND)).toBe(true);
    expect(JSON.stringify(farms).includes("gameMeta")).toBe(false);
    expect(JSON.stringify(farms).includes("shippingBoxes")).toBe(false);
  });

  it("visit_friend_farm returns VISIT keys for a friend and rejects stranger", async () => {
    const ok = await db.$queryRaw<{ visit_friend_farm: Record<string, unknown> }[]>`
      SELECT visit_friend_farm(${FRIEND}) AS visit_friend_farm
    `;
    const farm = ok[0]?.visit_friend_farm;
    expect(farm).toHaveProperty("placedDecor");
    expect(farm).toHaveProperty("pondFish");
    expect(farm).not.toHaveProperty("gold");
    expect(farm).not.toHaveProperty("gameMeta");
    await expect(db.$executeRaw`SELECT visit_friend_farm(${STRANGER})`).rejects.toThrow();
  });
});
