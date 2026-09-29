// Wave 1 P5 — nuôi cá ao (aquaculture): FRY catalog + farmStore.pondFish +
// save schema 7. Mỗi fry: mua ở shop → thả ao → lớn theo ngày → thu toàn bộ.
import { describe, it, expect, beforeEach } from "vitest";
import { FRY, fryGrowDays, isFryItemId } from "../../src/lib/game/fish-catalog";
import { useFarmStore } from "../../src/store/farmStore";
import { useGameStore } from "../../src/store/gameStore";
import { useProgressionStore, XP_REWARDS } from "../../src/store/progressionStore";
import { gameActions } from "../../src/lib/game/actions";
import { migrate, SAVE_SCHEMA_VERSION } from "../../src/lib/game/save";
import { getItem } from "../../src/lib/game/data";

describe("FRY catalog (P5)", () => {
  it("3 loại fry pond, giá ≈ 60% sellPrice cá trưởng thành, growDays 2-3", () => {
    expect(FRY.length).toBe(3);
    for (const f of FRY) {
      // fry nào cũng phải map sang cá pond (ao nuôi).
      expect(["sunfish", "perch", "carp"]).toContain(f.fishId);
      expect(f.growDays).toBeGreaterThanOrEqual(2);
      expect(f.growDays).toBeLessThanOrEqual(3);
      expect(f.price).toBeGreaterThan(0);
      expect(f.price).toBeLessThan(f.sellPrice); // lời khi thu
    }
  });

  it("isFryItemId + fryGrowDays + ITEMS entries", () => {
    expect(isFryItemId("fry_sunfish")).toBe(true);
    expect(isFryItemId("sunfish")).toBe(false);
    expect(fryGrowDays("fry_sunfish")).toBe(FRY[0].growDays);
    expect(getItem("fry_sunfish")).toBeDefined();
  });
});

describe("farmStore.pondFish (P5)", () => {
  beforeEach(() => {
    useFarmStore.getState().hydrate({
      terrain: [],
      crops: {},
      objects: {},
      forage: {},
      shippingBoxes: {},
      silo: {},
      filledOrders: [],
      pondFish: [],
    } as never);
    useGameStore.getState().hydrate({ gold: 500, day: 1 } as never);
    useProgressionStore.getState().reset();
  });

  it("stockFry thêm cá bột; vượt cap 6 → false không mutate", () => {
    for (let i = 0; i < 6; i++) expect(useFarmStore.getState().stockFry("fry_sunfish")).toBe(true);
    expect(useFarmStore.getState().pondFish).toHaveLength(6);
    expect(useFarmStore.getState().stockFry("fry_perch")).toBe(false);
    expect(useFarmStore.getState().pondFish).toHaveLength(6);
  });

  it("stockFry fishId lạ → false", () => {
    expect(useFarmStore.getState().stockFry("not_fry")).toBe(false);
  });

  it("newDay tăng daysGrown; cá trưởng thành giữ nguyên chờ thu", () => {
    useFarmStore.getState().stockFry("fry_sunfish"); // growDays 2
    useFarmStore.getState().newDay("Spring");
    expect(useFarmStore.getState().pondFish[0].daysGrown).toBe(1);
    useFarmStore.getState().newDay("Spring");
    expect(useFarmStore.getState().pondFish[0].daysGrown).toBe(2); // mature
    useFarmStore.getState().newDay("Spring");
    expect(useFarmStore.getState().pondFish[0].daysGrown).toBe(2); // cap tại growDays
  });

  it("harvestPond: chỉ thu cá trưởng thành, cá non ở lại", () => {
    useFarmStore.getState().stockFry("fry_sunfish");
    useFarmStore.getState().stockFry("fry_carp"); // growDays 3
    useFarmStore.getState().newDay("Spring");
    useFarmStore.getState().newDay("Spring");
    const got = useFarmStore.getState().harvestPond();
    expect(got).toEqual([{ fishId: "sunfish", qty: 1 }]);
    expect(useFarmStore.getState().pondFish).toHaveLength(1);
    expect(useFarmStore.getState().pondFish[0].fishId).toBe("carp");
  });

  it("review-fix: cá NON CÙNG LOÀI với cá trưởng thành KHÔNG bị xóa", () => {
    useFarmStore.getState().stockFry("fry_carp");
    useFarmStore.getState().stockFry("fry_carp");
    useFarmStore.getState().newDay("Spring");
    useFarmStore.getState().newDay("Spring");
    useFarmStore.getState().newDay("Spring"); // con đầu 3 ngày = mature, con sau... cùng số ngày
    // Chỉnh tay 1 con về non để tạo mixed-age cùng loài (hydrate path):
    const pf = useFarmStore.getState().pondFish;
    useFarmStore.getState().hydrate({
      pondFish: [
        { fishId: "carp", daysGrown: 3 },
        { fishId: "carp", daysGrown: 1 },
      ],
    } as never);
    void pf;
    const got = useFarmStore.getState().harvestPond();
    expect(got).toEqual([{ fishId: "carp", qty: 1 }]);
    const after = useFarmStore.getState().pondFish;
    expect(after).toHaveLength(1);
    expect(after[0].daysGrown).toBe(1); // con non ở lại
  });

  it("hydrate sanitize: fishId lạ drop, daysGrown âm/NaN → 0, non-array → []", () => {
    useFarmStore.getState().hydrate({
      pondFish: [
        { fishId: "sunfish", daysGrown: 1 },
        { fishId: "garbage", daysGrown: 5 },
        { fishId: "carp", daysGrown: -3 },
        { fishId: "perch", daysGrown: NaN },
      ],
    } as never);
    const pf = useFarmStore.getState().pondFish;
    expect(pf).toHaveLength(3);
    expect(pf.find((p) => p.fishId === "carp")!.daysGrown).toBe(0);
    useFarmStore.getState().hydrate({ pondFish: "garbage" } as never);
    expect(useFarmStore.getState().pondFish).toEqual([]);
  });

  it("reset → pondFish rỗng", () => {
    useFarmStore.getState().stockFry("fry_sunfish");
    useFarmStore.getState().reset();
    expect(useFarmStore.getState().pondFish).toEqual([]);
  });
});

describe("gameActions pond (P5)", () => {
  beforeEach(() => {
    useFarmStore.getState().hydrate({
      terrain: [],
      crops: {},
      objects: {},
      forage: {},
      shippingBoxes: {},
      silo: {},
      filledOrders: [],
      pondFish: [],
    } as never);
    useGameStore.getState().hydrate({ gold: 500, day: 1 } as never);
    useProgressionStore.getState().reset();
  });

  it("buyFry trừ gold đúng giá; thiếu gold → false", () => {
    const price = FRY[0].price;
    expect(gameActions.buyFry("fry_sunfish")).toBe(true);
    expect(useGameStore.getState().gold).toBe(500 - price);
    useGameStore.getState().hydrate({ gold: 1 } as never);
    expect(gameActions.buyFry("fry_perch")).toBe(false);
    expect(useGameStore.getState().gold).toBe(1);
  });

  it("harvestPond action: cá vào silo + XP mỗi con + notify", () => {
    useFarmStore.getState().stockFry("fry_sunfish");
    useFarmStore.getState().newDay("Spring");
    useFarmStore.getState().newDay("Spring");
    const xp = useProgressionStore.getState().totalXp;
    const got = gameActions.harvestPond();
    expect(got).toBe(1);
    expect(useFarmStore.getState().silo.sunfish).toBe(1);
    expect(useProgressionStore.getState().totalXp).toBe(xp + XP_REWARDS.fish);
  });

  it("silo đầy → harvestPond action 0 (all-or-nothing gate như harvest crop)", () => {
    useProgressionStore.getState().hydrate({ level: 1, xp: 0, totalXp: 0, skillPoints: 0 });
    useFarmStore.getState().hydrate({ silo: { parsnip: 20 } } as never); // cap 20
    useFarmStore.getState().stockFry("fry_sunfish");
    useFarmStore.getState().newDay("Spring");
    useFarmStore.getState().newDay("Spring");
    expect(gameActions.harvestPond()).toBe(0);
    expect(useFarmStore.getState().pondFish).toHaveLength(1); // cá ở lại ao
  });
});

describe("save schema 7 pondFish (P5) — version hiển tại 8", () => {
  it("W2 giữ nguyên pondFish; version nay 8 (buffs) — v6 thiếu pondFish → default []; v7 passthrough", () => {
    const v6 = migrate({
      version: 6,
      game: { day: 2, season: "Spring", gold: 100, energy: 90 },
      inventory: { slots: [], selectedSlot: 0 },
      farm: { terrain: [], crops: {}, objects: {}, forage: {}, silo: {} },
      npc: { friendship: {}, talkedToday: {}, giftedToday: {} },
      player: { x: 9, y: 22 },
    });
    expect(v6!.version).toBe(12); // W9 tutorial
    expect(v6!.farm.pondFish).toEqual([]);
    const v7 = migrate({
      version: 7,
      game: { day: 2, season: "Spring", gold: 100, energy: 90 },
      inventory: { slots: [], selectedSlot: 0 },
      farm: { terrain: [], crops: {}, objects: {}, forage: {}, silo: {}, pondFish: [{ fishId: "carp", daysGrown: 1 }] },
      npc: { friendship: {}, talkedToday: {}, giftedToday: {} },
      player: { x: 9, y: 22 },
    });
    expect(v7!.farm.pondFish).toEqual([{ fishId: "carp", daysGrown: 1 }]);
  });
});
