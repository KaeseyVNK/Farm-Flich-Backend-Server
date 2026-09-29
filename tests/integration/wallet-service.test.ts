import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { cleanDb } from "../helpers";
import {
  addGold,
  getGold,
  updateInventory,
  getInventoryQty,
} from "@/lib/game/wallet-service";

const UID = "test-wallet-user";

beforeEach(async () => {
  await cleanDb();
  await db.user.create({ data: { id: UID, gold: 500 } });
});

describe("addGold (atomic, server-authoritative)", () => {
  it("cộng gold", async () => {
    expect(await addGold(UID, 100)).toBe(600);
    expect(await getGold(UID)).toBe(600);
  });
  it("trừ gold hợp lệ", async () => {
    expect(await addGold(UID, -200)).toBe(300);
  });
  it("reject kết quả âm — 0 row update, gold không đổi (chặn cheat)", async () => {
    await expect(addGold(UID, -1000)).rejects.toThrow();
    expect(await getGold(UID)).toBe(500);
  });
});

describe("updateInventory (atomic, race-safe)", () => {
  it("thêm item mới", async () => {
    const r = await updateInventory(UID, "wheat", 5);
    expect(r.ok).toBe(true);
    expect(await getInventoryQty(UID, "wheat")).toBe(5);
  });
  it("trừ item hợp lệ", async () => {
    await updateInventory(UID, "wheat", 5);
    const r = await updateInventory(UID, "wheat", -3);
    expect(r.ok).toBe(true);
    expect(await getInventoryQty(UID, "wheat")).toBe(2);
  });
  it("reject trừ quá qty — qty không đổi (loot race)", async () => {
    await updateInventory(UID, "wheat", 2);
    const r = await updateInventory(UID, "wheat", -5);
    expect(r.ok).toBe(false);
    expect(await getInventoryQty(UID, "wheat")).toBe(2);
  });
});
