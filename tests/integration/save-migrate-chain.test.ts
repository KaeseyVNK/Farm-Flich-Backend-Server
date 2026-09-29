import { describe, it, expect } from "vitest";
import { migrate, SAVE_SCHEMA_VERSION, type SaveData } from "../../src/lib/game/save";

describe("Save migrate (cozy farm wipe)", () => {
  it("SAVE_SCHEMA_VERSION is 12", () => {
    expect(SAVE_SCHEMA_VERSION).toBe(12);
  });

  it("v1–v3 raid-era saves return null (no migrate)", () => {
    expect(migrate({ version: 1, game: {}, inventory: {} })).toBeNull();
    expect(migrate({ version: 2, game: {}, inventory: {} })).toBeNull();
    expect(migrate({ version: 3, game: {}, inventory: {} })).toBeNull();
  });

  it("null/non-object input → null", () => {
    expect(migrate(null)).toBeNull();
    expect(migrate(undefined)).toBeNull();
    expect(migrate("not-an-object")).toBeNull();
  });

  it("save mới hơn SAVE_SCHEMA_VERSION → null", () => {
    expect(migrate({ version: SAVE_SCHEMA_VERSION + 1, game: {}, inventory: {} })).toBeNull();
  });

  it("v4 save passthrough keeps player tile and story", () => {
    const v4 = {
      version: 4,
      coordVersion: 2,
      savedAt: 4000,
      slot: "slot1" as const,
      game: { day: 3, season: "Spring", gold: 80, energy: 90 },
      inventory: { slots: [], selectedSlot: 0 },
      farm: { terrain: [], crops: {}, objects: {}, forage: {} },
      npc: { friendship: {}, talkedToday: {}, giftedToday: {} },
      player: { x: 19, y: 20, facing: "up" },
      story: { chapterId: "ch2", nodeId: "start", visitedNodes: ["start"], flags: {} },
      world: { zone: "village", wellRepaired: true, waterCharges: 40, minedRocks: {}, defeatedSlimes: {} },
    };
    const out = migrate(v4) as SaveData;
    expect(out.version).toBe(12);
    expect(out.player).toEqual({ x: 19, y: 20, facing: "up" });
    expect(out.world?.zone).toBe("village");
    expect(out.story).toBeUndefined();
    // Phase 5: v4 thiếu farm.silo → default {}
    expect(out.farm.silo).toEqual({});
    // W2 (v8): save cũ thiếu buffs → default {}
    expect(out.game.buffs).toEqual({});
  });

  it("v5 save giữ silo sau passthrough; thiếu filledOrders → default []", () => {
    const v5 = {
      version: 5,
      coordVersion: 2,
      savedAt: 5000,
      slot: "slot1" as const,
      game: { day: 4, season: "Spring", gold: 900, energy: 90 },
      inventory: { slots: [], selectedSlot: 0 },
      farm: { terrain: [], crops: {}, objects: {}, forage: {}, silo: { parsnip: 7 } },
      npc: { friendship: {}, talkedToday: {}, giftedToday: {} },
      player: { x: 9, y: 22 },
    };
    const out = migrate(v5) as SaveData;
    expect(out.version).toBe(12);
    expect(out.farm.silo).toEqual({ parsnip: 7 });
    // Orders fix: v5 không có filledOrders → coi như chưa giao đơn nào
    expect(out.farm.filledOrders).toEqual([]);
  });

  it("v6 save giữ filledOrders sau passthrough", () => {
    const v6 = {
      version: 6,
      coordVersion: 2,
      savedAt: 6000,
      slot: "slot1" as const,
      game: { day: 4, season: "Spring", gold: 900, energy: 90 },
      inventory: { slots: [], selectedSlot: 0 },
      farm: { terrain: [], crops: {}, objects: {}, forage: {}, silo: {}, filledOrders: ["d4-a"] },
      npc: { friendship: {}, talkedToday: {}, giftedToday: {} },
      player: { x: 9, y: 22 },
    };
    const out = migrate(v6) as SaveData;
    expect(out.version).toBe(12);
    expect(out.farm.filledOrders).toEqual(["d4-a"]);
  });

  it("v7 save (W1) thiếu buffs → default {}; v7 có pondFish giữ nguyên", () => {
    const v7 = {
      version: 7,
      coordVersion: 2,
      savedAt: 7000,
      slot: "slot1" as const,
      game: { day: 5, season: "Spring", gold: 100, energy: 90 },
      inventory: { slots: [], selectedSlot: 0 },
      farm: { terrain: [], crops: {}, objects: {}, forage: {}, silo: {}, filledOrders: [], pondFish: [{ fishId: "sunfish", daysGrown: 1 }] },
      npc: { friendship: {}, talkedToday: {}, giftedToday: {} },
      player: { x: 9, y: 22 },
    };
    const out = migrate(v7) as SaveData;
    expect(out.version).toBe(12);
    expect(out.game.buffs).toEqual({});
    expect(out.farm.pondFish).toEqual([{ fishId: "sunfish", daysGrown: 1 }]);
  });

  it("v8 (W2) thiếu placedDecor/decorOwned → default [] / {}", () => {
    const v8b = {
      version: 8,
      coordVersion: 2,
      savedAt: 8500,
      slot: "slot1" as const,
      game: { day: 5, season: "Spring", gold: 100, energy: 90, buffs: {} },
      inventory: { slots: [], selectedSlot: 0 },
      farm: { terrain: [], crops: {}, objects: {}, forage: {}, silo: {} },
      npc: { friendship: {}, talkedToday: {}, giftedToday: {} },
      player: { x: 9, y: 22 },
    };
    const out = migrate(v8b) as SaveData;
    expect(out.version).toBe(12);
    expect(out.farm.placedDecor).toEqual([]);
    expect(out.farm.decorOwned).toEqual({});
  });

  it("v8 save giữ buffs sau passthrough", () => {
    const v8 = {
      version: 8,
      coordVersion: 2,
      savedAt: 8000,
      slot: "slot1" as const,
      game: { day: 5, season: "Spring", gold: 100, energy: 90, buffs: { speedUntilAbs: 7000, xpUntilAbs: 7500 } },
      inventory: { slots: [], selectedSlot: 0 },
      farm: { terrain: [], crops: {}, objects: {}, forage: {}, silo: {}, filledOrders: [], pondFish: [] },
      npc: { friendship: {}, talkedToday: {}, giftedToday: {} },
      player: { x: 9, y: 22 },
    };
    const out = migrate(v8) as SaveData;
    expect(out.version).toBe(12);
    expect(out.game.buffs).toEqual({ speedUntilAbs: 7000, xpUntilAbs: 7500 });
  });
});
