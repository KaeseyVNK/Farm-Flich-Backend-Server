import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { cleanDb } from "../helpers";

const SELLER = "exp-seller";
const BUYER = "exp-buyer";
let expiredId = "";
let activeId = "";

beforeEach(async () => {
  await cleanDb();
  await db.user.createMany({ data: [{ id: SELLER, gold: 500 }, { id: BUYER, gold: 500 }] });
  const e = await db.listing.create({
    data: {
      sellerId: SELLER,
      itemId: "wood",
      qty: 5,
      priceUnit: 5,
      expiresAt: new Date(Date.now() - 1000), // hết hạn
    },
  });
  const a = await db.listing.create({
    data: {
      sellerId: SELLER,
      itemId: "stone",
      qty: 3,
      priceUnit: 8,
      expiresAt: new Date(Date.now() + 86400_000), // còn hạn
    },
  });
  expiredId = e.id;
  activeId = a.id;
  // Seller có inventory để verify refund
  await db.inventory.createMany({
    data: [
      { userId: SELLER, itemId: "wood", qty: 2 },
      { userId: SELLER, itemId: "stone", qty: 1 },
    ],
  });
});

describe("expire_listing RPC (phase 6 F6.5)", () => {
  it("expired listing → status expired + refund inventory", async () => {
    const result = await db.$queryRaw<{ expire_listing: number }[]>`SELECT expire_listing(100)`;
    expect(Number(result[0]?.expire_listing)).toBe(1);
    const e = await db.listing.findUnique({ where: { id: expiredId } });
    expect(e?.status).toBe("expired");
    const wood = await db.inventory.findFirst({ where: { userId: SELLER, itemId: "wood" } });
    expect(wood?.qty).toBe(7); // 2 + 5 refund
  });
  it("active listing KHÔNG bị đụng", async () => {
    await db.$executeRaw`SELECT expire_listing(100)`;
    const a = await db.listing.findUnique({ where: { id: activeId } });
    expect(a?.status).toBe("active");
    const stone = await db.inventory.findFirst({ where: { userId: SELLER, itemId: "stone" } });
    expect(stone?.qty).toBe(1); // không refund
  });
  it("sold listing KHÔNG refund (status filter)", async () => {
    await db.listing.update({ where: { id: expiredId }, data: { status: "sold" } });
    await db.$executeRaw`SELECT expire_listing(100)`;
    const wood = await db.inventory.findFirst({ where: { userId: SELLER, itemId: "wood" } });
    expect(wood?.qty).toBe(2); // không refund
  });
  it("limit p — chỉ sweep đúng số lượng", async () => {
    const result = await db.$queryRaw<{ expire_listing: number }[]>`SELECT expire_listing(1)`;
    expect(Number(result[0]?.expire_listing)).toBe(1);
  });
});
