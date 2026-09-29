import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { cleanDb } from "../helpers";

const SELLER = "c-buyer-seller";
const B1 = "c-buyer-1";
const B2 = "c-buyer-2";
let listingId = "";

beforeEach(async () => {
  await cleanDb();
  await db.user.createMany({
    data: [
      { id: SELLER, gold: 500 },
      { id: B1, gold: 500 },
      { id: B2, gold: 500 },
    ],
  });
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

describe("marketplace_buy concurrent (phase 6 F6.4)", () => {
  it("concurrent 2-buyer full buy → chỉ 1 win (sold), 1 fail; tổng qty 10", async () => {
    const results = await Promise.allSettled([
      db.$executeRaw`SELECT marketplace_buy(${B1}, ${listingId}, 10)`,
      db.$executeRaw`SELECT marketplace_buy(${B2}, ${listingId}, 10)`,
    ]);
    const okCount = results.filter((r) => r.status === "fulfilled").length;
    expect(okCount).toBe(1); // chỉ 1 mua được full 10

    const l = await db.listing.findUnique({ where: { id: listingId } });
    expect(l?.status).toBe("sold");
    expect(l?.qty).toBe(0);

    // Chỉ winner bị trừ gold, loser giữ nguyên.
    const loser = (results.find((r) => r.status === "rejected") !== undefined);
    const golds = await db.user.findMany({
      where: { id: { in: [B1, B2] } },
      select: { id: true, gold: true },
    });
    const totalLoserGold = golds.filter((u) => u.gold === 500).length;
    expect(totalLoserGold).toBe(1); // loser không bị trừ
  });

  it("partial buy race — tổng qty không vượt listing", async () => {
    const results = await Promise.allSettled([
      db.$executeRaw`SELECT marketplace_buy(${B1}, ${listingId}, 7)`,
      db.$executeRaw`SELECT marketplace_buy(${B2}, ${listingId}, 7)`,
    ]);
    const okCount = results.filter((r) => r.status === "fulfilled").length;
    expect(okCount).toBe(1); // chỉ 1 người mua được 7 (vì chỉ có 10)

    const l = await db.listing.findUnique({ where: { id: listingId } });
    expect(l?.qty).toBe(3); // 10 - 7
  });
});
