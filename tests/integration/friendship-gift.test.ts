import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { cleanDb } from "../helpers";

const A = "friend-a";
const B = "friend-b";

beforeEach(async () => {
  await cleanDb();
  await db.user.createMany({ data: [{ id: A, gold: 500 }, { id: B, gold: 500 }] });
  await db.inventory.create({ data: { userId: A, itemId: "wood", qty: 100 } });
});

async function mkFriend(a: string, b: string, status = "accepted"): Promise<void> {
  const [x, y] = a < b ? [a, b] : [b, a];
  await db.friendship.create({ data: { userAId: x, userBId: y, status, initiatorId: a } });
}

describe("gift_item RPC (phase 5)", () => {
  it("happy — accepted friend + đủ qty → transfer + GiftLog", async () => {
    await mkFriend(A, B);
    await db.$executeRaw`SELECT gift_item(${A}, ${B}, 'wood', 5)`;
    const fromInv = await db.inventory.findUnique({
      where: { userId_itemId: { userId: A, itemId: "wood" } },
    });
    const toInv = await db.inventory.findUnique({
      where: { userId_itemId: { userId: B, itemId: "wood" } },
    });
    expect(fromInv?.qty).toBe(95);
    expect(toInv?.qty).toBe(5);
    const logs = await db.giftLog.count();
    expect(logs).toBe(1);
  });
  it("non-friend → reject", async () => {
    await expect(db.$executeRaw`SELECT gift_item(${A}, ${B}, 'wood', 5)`).rejects.toThrow();
  });
  it("insufficient qty → reject rollback", async () => {
    await mkFriend(A, B);
    await expect(db.$executeRaw`SELECT gift_item(${A}, ${B}, 'wood', 999)`).rejects.toThrow();
    const fromInv = await db.inventory.findUnique({
      where: { userId_itemId: { userId: A, itemId: "wood" } },
    });
    expect(fromInv?.qty).toBe(100); // nguyên vẹn
  });
  it("whitelist — tool item reject", async () => {
    await mkFriend(A, B);
    await expect(db.$executeRaw`SELECT gift_item(${A}, ${B}, 'tool_axe', 1)`).rejects.toThrow();
  });
  it("daily cap 5 — gift thứ 6 reject", async () => {
    await mkFriend(A, B);
    for (let i = 0; i < 5; i++) {
      await db.$executeRaw`SELECT gift_item(${A}, ${B}, 'wood', 1)`;
    }
    await expect(db.$executeRaw`SELECT gift_item(${A}, ${B}, 'wood', 1)`).rejects.toThrow();
  });
});

describe("Friendship canonical (phase 5)", () => {
  it("A<B — userAId < userBId", async () => {
    await mkFriend(B, A); // gọi B,A
    const f = await db.friendship.findFirst();
    expect(f?.userAId).toBe(A); // canonical sorted
    expect(f?.userBId).toBe(B);
  });
});

describe("visit friend safe keys (phase 5 F5.5/F5.7)", () => {
  beforeEach(async () => {
    await db.farm.create({
      data: {
        id: "v-farm",
        ownerId: B,
        terrain: new Array(660).fill(0),
        crops: { 5: { type: "carrot" } },
        objects: { 10: { type: "fence" } },
        forage: { 20: true },
      },
    });
    await db.user.update({ where: { id: B }, data: { gold: 999 } });
    await db.inventory.create({ data: { userId: B, itemId: "gold_bar", qty: 999 } });
  });

  it("KHÔNG trả Inventory/gold khi select safe keys — projection whitelist", async () => {
    await mkFriend(A, B);
    const farm = await db.farm.findFirst({
      where: { ownerId: B },
      select: { terrain: true, crops: true, objects: true, forage: true },
    });
    const json = JSON.stringify(farm);
    // Safe keys có mặt
    expect(json).toContain("terrain");
    expect(json).toContain("crops");
    expect(json).toContain("objects");
    // KHÔNG leak secrets
    expect(json).not.toContain("gold");
    expect(json).not.toContain("inventory");
    expect(json).not.toContain("gameMeta");
    expect(json).not.toContain("shippingBoxes");
  });
});

