import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { cleanDb } from "../helpers";
import { dayKey, isStickerId, sanitizeGuestbookMessage } from "@/lib/social/social-rules";

// W4 — data-layer contract cho FarmLike/VisitLog (migration 20260819120000).
// Service layer (supabase auth + RLS) không test được ở đây — Prisma bypass RLS;
// auth/friendship gate nằm unit (social-rules) + service review. DB-gated:
// fail environmental khi mạng không tới Supabase direct (như raid-rpc).

const A = "social-a"; // visitor
const B = "social-b"; // farm owner

beforeEach(async () => {
  await cleanDb();
  await db.user.createMany({ data: [{ id: A, gold: 100 }, { id: B, gold: 100 }] });
});

describe("FarmLike unique (owner, visitor, day) — dedupe 1 like/ngày (W4)", () => {
  it("like thứ 2 cùng ngày → P2002 (unique index chặn)", async () => {
    await db.farmLike.create({ data: { farmOwnerId: B, visitorId: A, day: dayKey() } });
    await expect(
      db.farmLike.create({ data: { farmOwnerId: B, visitorId: A, day: dayKey() } }),
    ).rejects.toThrow(/Unique constraint/i);
  });

  it("khác NGÀY hoặc khác VISITOR → hợp lệ", async () => {
    await db.farmLike.create({ data: { farmOwnerId: B, visitorId: A, day: dayKey() } });
    await db.farmLike.create({ data: { farmOwnerId: B, visitorId: A, day: dayKey() - 1 } }); // hôm qua
    await db.farmLike.create({ data: { farmOwnerId: B, visitorId: "other", day: dayKey() } });
    expect(await db.farmLike.count()).toBe(3);
  });

  it("count theo owner đúng (tổng like)", async () => {
    await db.farmLike.createMany({
      data: [
        { farmOwnerId: B, visitorId: A, day: dayKey() },
        { farmOwnerId: B, visitorId: "v2", day: dayKey() },
        { farmOwnerId: B, visitorId: "v3", day: dayKey() - 1 },
        { farmOwnerId: "owner-khac", visitorId: A, day: dayKey() },
      ],
    });
    expect(await db.farmLike.count({ where: { farmOwnerId: B } })).toBe(3);
  });
});

describe("VisitLog kinds + guestbook query (W4)", () => {
  it("ghi 4 kind + query guestbook 10 gần nhất theo createdAt desc", async () => {
    const day = dayKey();
    await db.visitLog.createMany({
      data: [
        { farmOwnerId: B, visitorId: A, kind: "visit", day },
        { farmOwnerId: B, visitorId: A, kind: "like", day },
        { farmOwnerId: B, visitorId: A, kind: "sticker", stickerId: "heart", day },
        { farmOwnerId: B, visitorId: A, kind: "guestbook", message: "farm đẹp!", day },
        { farmOwnerId: B, visitorId: "v2", kind: "guestbook", message: "ghé thăm!", day },
      ],
    });
    expect(await db.visitLog.count({ where: { farmOwnerId: B, kind: "visit" } })).toBe(1);
    const gb = await db.visitLog.findMany({
      where: { farmOwnerId: B, kind: "guestbook" },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    expect(gb).toHaveLength(2);
    expect(gb.every((g) => g.message !== null)).toBe(true);
    // sticker tally query pattern (service tally client-side trên rows kind=sticker)
    const stickers = await db.visitLog.findMany({ where: { farmOwnerId: B, kind: "sticker" } });
    expect(stickers[0].stickerId).toBe("heart");
    expect(isStickerId(stickers[0].stickerId!)).toBe(true);
  });

  it("message 200 ký tự sanitize nằm ở service — DB nhận Text dài ok", async () => {
    const msg = sanitizeGuestbookMessage("x".repeat(300))!;
    expect(msg).toHaveLength(200);
    await db.visitLog.create({
      data: { farmOwnerId: B, visitorId: A, kind: "guestbook", message: msg, day: dayKey() },
    });
    expect(await db.visitLog.count({ where: { kind: "guestbook" } })).toBe(1);
  });
});
