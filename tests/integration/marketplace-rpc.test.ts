import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { cleanDb } from "../helpers";

const SELLER = "mp-seller";
const BUYER = "mp-buyer";
let listingId = "";

beforeEach(async () => {
  await cleanDb();
  await db.user.createMany({ data: [{ id: SELLER, gold: 500 }, { id: BUYER, gold: 500 }] });
  const l = await db.listing.create({
    data: {
      sellerId: SELLER,
      itemId: "wood",
      qty: 10,
      priceUnit: 5,
      expiresAt: new Date(Date.now() + 7 * 86400_000),
    },
  });
  listingId = l.id;
});

describe("marketplace_buy RPC (phase 6)", () => {
  it("partial buy — qty decrement + trade log", async () => {
    await db.$executeRaw`SELECT marketplace_buy(${BUYER}, ${listingId}, 3)`;
    const l = await db.listing.findUnique({ where: { id: listingId } });
    expect(l?.qty).toBe(7);
    expect(l?.status).toBe("active");
    const buyer = await db.user.findUnique({ where: { id: BUYER } });
    expect(buyer?.gold).toBe(485); // 500 - 3*5
  });
  it("full buy — status sold", async () => {
    await db.$executeRaw`SELECT marketplace_buy(${BUYER}, ${listingId}, 10)`;
    const l = await db.listing.findUnique({ where: { id: listingId } });
    expect(l?.status).toBe("sold");
  });
  it("fee 5% — seller receive total×0.95", async () => {
    await db.$executeRaw`SELECT marketplace_buy(${BUYER}, ${listingId}, 10)`;
    const seller = await db.user.findUnique({ where: { id: SELLER } });
    // total = 10*5 = 50, fee = floor(50/20)=2, receive = 48
    expect(seller?.gold).toBe(548); // 500 + 48
    const trade = await db.trade.findFirst();
    expect(trade?.fee).toBe(2);
  });
  it("self-buy — reject", async () => {
    await expect(
      db.$executeRaw`SELECT marketplace_buy(${SELLER}, ${listingId}, 1)`,
    ).rejects.toThrow();
  });
  it("insufficient gold — rollback (listing nguyên vẹn)", async () => {
    await expect(
      db.$executeRaw`SELECT marketplace_buy(${BUYER}, ${listingId}, 100)`,
    ).rejects.toThrow();
    const l = await db.listing.findUnique({ where: { id: listingId } });
    expect(l?.qty).toBe(10); // nguyên
    const buyer = await db.user.findUnique({ where: { id: BUYER } });
    expect(buyer?.gold).toBe(500);
  });
  it("expired listing — reject", async () => {
    await db.listing.update({
      where: { id: listingId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(
      db.$executeRaw`SELECT marketplace_buy(${BUYER}, ${listingId}, 1)`,
    ).rejects.toThrow();
  });
});
