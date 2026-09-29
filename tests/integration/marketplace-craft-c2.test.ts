import { test, expect, describe, beforeAll } from "vitest";
import { db } from "@/lib/db";
import { cleanDb } from "../helpers";

/**
 * C2 atomic RPCs: create_listing, cancel_listing, craft_mask.
 * Non-atomic app-side 2-step trước đó → fail giữa chừng mất item/refund phantom.
 */
describe("create_listing + cancel_listing RPC (C2)", () => {
  beforeAll(async () => {
    await cleanDb();
    await db.user.create({ data: { id: "seller1", gold: 1000 } });
    await db.inventory.create({ data: { userId: "seller1", itemId: "wood", qty: 50 } });
  });

  test("create_listing: deduct inventory + insert Listing atomic", async () => {
    const expires = new Date(Date.now() + 7 * 86400_000).toISOString();
    const id = await db.$queryRaw<{ create_listing: string }[]>`
      SELECT create_listing('seller1', 'wood', 10, 5, ${expires}::timestamptz)
    `;
    expect(id[0].create_listing).toBeTruthy();
    const inv = await db.inventory.findUnique({
      where: { userId_itemId: { userId: "seller1", itemId: "wood" } },
    });
    expect(inv?.qty).toBe(40);
    const listings = await db.listing.count({ where: { sellerId: "seller1", status: "active" } });
    expect(listings).toBe(1);
  });

  test("create_listing: insufficient inventory → reject, inventory nguyên vẹn", async () => {
    const expires = new Date(Date.now() + 7 * 86400_000).toISOString();
    await expect(
      db.$executeRaw`SELECT create_listing('seller1', 'wood', 9999, 5, ${expires}::timestamptz)`,
    ).rejects.toThrow();
    const inv = await db.inventory.findUnique({
      where: { userId_itemId: { userId: "seller1", itemId: "wood" } },
    });
    expect(inv?.qty).toBe(40); // không trừ
  });

  test("cancel_listing: refund + status cancelled atomic", async () => {
    const listing = await db.listing.findFirst({ where: { sellerId: "seller1" } });
    await db.$executeRaw`SELECT cancel_listing(${listing!.id}, 'seller1')`;
    const inv = await db.inventory.findUnique({
      where: { userId_itemId: { userId: "seller1", itemId: "wood" } },
    });
    expect(inv?.qty).toBe(50); // refund 10
    const l = await db.listing.findUnique({ where: { id: listing!.id } });
    expect(l?.status).toBe("cancelled");
  });

  test("cancel_listing: forbidden (không phải seller)", async () => {
    await db.user.create({ data: { id: "other" } });
    const listing = await db.listing.findFirst({ where: { sellerId: "seller1" } });
    await expect(
      db.$executeRaw`SELECT cancel_listing(${listing!.id}, 'other')`,
    ).rejects.toThrow();
  });
});

describe("craft_mask atomic (C2)", () => {
  beforeAll(async () => {
    await cleanDb();
    await db.user.create({ data: { id: "c1", gold: 500 } });
    await db.inventory.create({ data: { userId: "c1", itemId: "wood", qty: 10 } });
  });

  test("craft_mask: deduct gold + ingredients + INSERT Mask atomic", async () => {
    await db.$executeRaw`
      SELECT craft_mask('c1', 'rogue', 1, 99, '{"wood": 1}'::jsonb)
    `;
    const u = await db.user.findUnique({ where: { id: "c1" } });
    expect(u?.gold).toBe(400); // catalog gold 100, ignores client p_gold_cost=1
    const inv = await db.inventory.findUnique({
      where: { userId_itemId: { userId: "c1", itemId: "wood" } },
    });
    expect(inv?.qty).toBe(0); // catalog wood 10, ignores client ingredients
    const mask = await db.mask.findUnique({
      where: { userId_maskId: { userId: "c1", maskId: "rogue" } },
    });
    expect(mask?.durability).toBe(10);
  });

  test("craft_mask: insufficient ingredient → reject, rollback toàn bộ (gold nguyên)", async () => {
    await expect(
      db.$executeRaw`SELECT craft_mask('c1', 'phantom', 1, 10, '{"wood": 999}'::jsonb)`,
    ).rejects.toThrow();
    const u = await db.user.findUnique({ where: { id: "c1" } });
    expect(u?.gold).toBe(400);
    const inv = await db.inventory.findUnique({
      where: { userId_itemId: { userId: "c1", itemId: "wood" } },
    });
    expect(inv?.qty).toBe(0);
  });

  test("craft_mask: duplicate mask → reject (không mất ingredients)", async () => {
    await expect(
      db.$executeRaw`SELECT craft_mask('c1', 'rogue', 100, 10, '{"wood": 1}'::jsonb)`,
    ).rejects.toThrow();
    const inv = await db.inventory.findUnique({
      where: { userId_itemId: { userId: "c1", itemId: "wood" } },
    });
    expect(inv?.qty).toBe(0);
  });
});
