import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { cleanDb } from "../helpers";
import { migrateLocalToCloud, type LocalSave } from "@/lib/game/sync";

const UID = "test-sync-user";

beforeEach(async () => {
  await cleanDb();
  await db.user.create({ data: { id: UID, gold: 500, isAnonymous: true } });
});

describe("migrateLocalToCloud (1 chiều — red-team #5)", () => {
  it("migrate local save → cloud (farm + mask, gold KHÔNG tin client)", async () => {
    const local: LocalSave = {
      gold: 1240,
      game: { day: 3, season: "Spring", year: 1, timeMinutes: 600, energy: 200 },
      player: { x: 5, y: 6 },
      farm: { terrain: new Array(900).fill(2), crops: { "1": { cropId: "wheat" } } },
      inventory: [{ itemId: "wheat", qty: 10 }, { itemId: "wood", qty: 5 }],
    };
    const ok = await migrateLocalToCloud(UID, local);
    expect(ok).toBe(true);

    const farm = await db.farm.findUnique({ where: { ownerId: UID } });
    expect(farm?.terrain).toHaveLength(900);
    expect(farm?.crops).toEqual({ "1": { cropId: "wheat" } });
    expect(farm?.gameMeta).toMatchObject({ day: 3, player: { x: 5, y: 6 } });

    // Code-review C5: gold client-supplied bị bỏ qua — giữ default.
    const u = await db.user.findUnique({ where: { id: UID } });
    expect(u?.gold).toBe(500); // default, KHÔNG phải 1240 từ local
    expect(u?.migratedAt).toBeTruthy();

    const mask = await db.mask.findUnique({
      where: { userId_maskId: { userId: UID, maskId: "rogue" } },
    });
    expect(mask?.durability).toBe(10);
    expect(mask?.equipped).toBe(true);

    const inv = await db.inventory.findMany({ where: { userId: UID } });
    expect(inv).toHaveLength(2);
  });

  it("lọc item lạ + clamp qty khi migrate inventory", async () => {
    const local: LocalSave = {
      inventory: [
        { itemId: "wood", qty: 5 },          // hợp lệ
        { itemId: "phantom_item_xyz", qty: 10 }, // không có trong catalog → drop
        { itemId: "stone", qty: 5000 },      // qty > 999 → clamp
      ],
    };
    await migrateLocalToCloud(UID, local);
    const inv = await db.inventory.findMany({ where: { userId: UID } });
    expect(inv).toHaveLength(2);
    const stone = inv.find((i) => i.itemId === "stone");
    expect(stone?.qty).toBe(999);
    expect(inv.find((i) => i.itemId === "phantom_item_xyz")).toBeUndefined();
  });

  it("idempotent — migrate lần 2 không đổi", async () => {
    const local: LocalSave = {};
    await migrateLocalToCloud(UID, local);
    // Đổi local nhưng đã migrate → skip
    await migrateLocalToCloud(UID, {});
    const u = await db.user.findUnique({ where: { id: UID } });
    expect(u?.gold).toBe(500); // không đổi
  });

  it("dùng default khi không có local save (user mới)", async () => {
    const ok = await migrateLocalToCloud(UID, null);
    expect(ok).toBe(true);
    const farm = await db.farm.findUnique({ where: { ownerId: UID } });
    expect(farm?.terrain).toHaveLength(900);
    expect(farm?.gameMeta).toMatchObject({ day: 1, season: "Spring" });
    const u = await db.user.findUnique({ where: { id: UID } });
    expect(u?.gold).toBe(500); // default giữ nguyên
  });
});
