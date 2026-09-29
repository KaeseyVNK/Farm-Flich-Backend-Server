import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { cleanDb } from "../helpers";

/**
 * steal_with_loss_cap — review #7: pool đọc FOR UPDATE nội bộ (không tin
 * p_pool caller). Caps per-raid 10% / per-day 25% trên pool thật tại thời điểm
 * lock. Contract giữ nguyên: NULL = victim không có item (skip), 0 = hết cap.
 */
describe("steal_with_loss_cap (internal pool lock)", () => {
  const OWNER = "steal-owner";
  const THIEF = "steal-thief";

  beforeAll(async () => {
    await cleanDb();
    await db.user.create({ data: { id: OWNER } });
    await db.user.create({ data: { id: THIEF } });
  });

  afterAll(async () => {
    await cleanDb();
  });

  it("NULL khi victim không có item row", async () => {
    const r = await db.$queryRaw<{ steal_with_loss_cap: number | null }[]>`
      SELECT steal_with_loss_cap(${OWNER}, 'iron', 5, 0)`;
    expect(r[0].steal_with_loss_cap).toBeNull();
  });

  it("per-raid cap 10% tính trên pool THẬT (p_pool sai bị bỏ qua)", async () => {
    await db.inventory.create({ data: { userId: OWNER, itemId: "iron", qty: 100 } });
    // Caller truyền p_pool=10000 (stale/lệch) → nếu RPC còn tin p_pool,
    // floor(10000*0.1)=1000 > qty → deduct toàn bộ. Fix xong: cap theo 100.
    const r = await db.$queryRaw<{ steal_with_loss_cap: number }[]>`
      SELECT steal_with_loss_cap(${OWNER}, 'iron', 999, 10000)`;
    expect(r[0].steal_with_loss_cap).toBe(10); // floor(100*0.1)
    const inv = await db.inventory.findUnique({
      where: { userId_itemId: { userId: OWNER, itemId: "iron" } },
    });
    expect(inv?.qty).toBe(90);
  });

  it("per-day 25% chặn raid kế tiếp (loss tally cộng dồn)", async () => {
    // Raid 2: pool 90 → per-day remaining = floor(90*.25)-10 = 12; per-raid 9 → steal 9.
    const r2 = await db.$queryRaw<{ steal_with_loss_cap: number }[]>`
      SELECT steal_with_loss_cap(${OWNER}, 'iron', 5, 90)`;
    expect(r2[0].steal_with_loss_cap).toBe(5);
    // Raid 3: pool 85 → per-day remaining = floor(85*.25)-15 = 6; request 99 → steal 6 (day cap cạn).
    const r3 = await db.$queryRaw<{ steal_with_loss_cap: number }[]>`
      SELECT steal_with_loss_cap(${OWNER}, 'iron', 99, 85)`;
    expect(r3[0].steal_with_loss_cap).toBe(6);
    // Raid 4: pool 79, đã mất 21/19.75 → day cap cạn → 0.
    const r4 = await db.$queryRaw<{ steal_with_loss_cap: number }[]>`
      SELECT steal_with_loss_cap(${OWNER}, 'iron', 1, 78)`;
    expect(r4[0].steal_with_loss_cap).toBe(0);
    // Inventory nguyên vẹn sau raid bị chặn: 85 - 6 = 79.
    const inv = await db.inventory.findUnique({
      where: { userId_itemId: { userId: OWNER, itemId: "iron" } },
    });
    expect(inv?.qty).toBe(79);
  });
});
