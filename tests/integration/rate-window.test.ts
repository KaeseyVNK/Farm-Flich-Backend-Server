import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { cleanDb } from "../helpers";
import { checkRateLimitDb, resetRateWindowsForTest } from "@/lib/social/db-rate-limit";

/**
 * RateWindow DB-backed rate limit (review F6) — atomic window counter.
 * Multi-instance an toàn (không còn Map per-process), restart không reset.
 */
describe("checkRateLimitDb (DB-backed window counter)", () => {
  const U = "rate-user-1";
  const V = "rate-user-2";

  beforeAll(async () => {
    await cleanDb();
    await db.user.create({ data: { id: U } });
    await db.user.create({ data: { id: V } });
    await resetRateWindowsForTest();
  });

  afterAll(async () => {
    await resetRateWindowsForTest();
    await cleanDb();
  });

  it("cho đến max rồi chặn (chat = 10/phút)", async () => {
    for (let i = 0; i < 10; i++) {
      expect(await checkRateLimitDb(U, "chat")).toBe(true);
    }
    expect(await checkRateLimitDb(U, "chat")).toBe(false);
    // User khác độc lập.
    expect(await checkRateLimitDb(V, "chat")).toBe(true);
  });

  it("kind độc lập — guestbook cap 3 riêng chat", async () => {
    expect(await checkRateLimitDb(U, "guestbook")).toBe(true);
    expect(await checkRateLimitDb(U, "guestbook")).toBe(true);
    expect(await checkRateLimitDb(U, "guestbook")).toBe(true);
    expect(await checkRateLimitDb(U, "guestbook")).toBe(false); // cap 3
    // Chat của U vẫn bị chặn từ test trước (window chưa đổi) nhưng kind guestbook
    // không ảnh hưởng chat counter — verify bằng user mới + kind mới.
    expect(await checkRateLimitDb(V, "guestbook")).toBe(true);
  });

  it("window cũ bị ghi đè tự nhiên (không cần cron dọn)", async () => {
    // Đếm row cho user U — bounded theo số kind (4), không phình theo request.
    const rows = await db.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM "RateWindow" WHERE "userId" = ${U}`;
    expect(rows[0].n).toBeLessThanOrEqual(4);
  });
});
