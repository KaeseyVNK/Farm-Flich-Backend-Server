import { describe, it, expect, beforeEach } from "vitest";
import { useNpcStore } from "../../src/store/npcStore";
import { useGameStore } from "../../src/store/gameStore";
import { useQuestStore } from "../../src/store/questStore";
import { useInventoryStore } from "../../src/store/inventoryStore";
import { useFarmStore } from "../../src/store/farmStore";
import { useProgressionStore, MAX_LEVEL } from "../../src/store/progressionStore";
import { MAX_ENERGY } from "../../src/lib/game/constants";

// Audit: hydrate trust-boundary. Save corrupt/legacy inject NaN/undefined/garbage
// → crash UI hoặc poison math. Mỗi store phải validate tại hydrate.

describe("npcStore.hydrate trust-boundary", () => {
  beforeEach(() => {
    useNpcStore.getState().hydrate({ friendship: {}, talkedToday: {}, giftedToday: {}, metNpcs: {} });
  });

  it("metNpcs: undefined (save legacy pre-field) → metCount không crash", () => {
    // Trước đây raw spread pass undefined → metCount() `get().metNpcs[id]` throw
    // TypeError → quest panel q_meet_townsfolk crash UI.
    useNpcStore.getState().hydrate({
      friendship: { robin: 50 },
      talkedToday: {},
      giftedToday: {},
      metNpcs: undefined as never,
    });
    expect(() => useNpcStore.getState().metCount()).not.toThrow();
    expect(useNpcStore.getState().metCount()).toBe(0);
    expect(useNpcStore.getState().isMet("robin")).toBe(false);
  });

  it("metNpcs hợp lệ → metCount đếm đúng", () => {
    useNpcStore.getState().hydrate({
      friendship: {},
      talkedToday: {},
      giftedToday: {},
      metNpcs: { alaric: true, gaston: true, elyria: false },
    });
    expect(useNpcStore.getState().metCount()).toBe(2);
  });

  it("field thiếu → fallback giữ state hiện tại", () => {
    useNpcStore.getState().hydrate({
      friendship: { robin: 100 },
      metNpcs: { robin: true },
    } as never);
    expect(useNpcStore.getState().friendship.robin).toBe(100);
    expect(useNpcStore.getState().metNpcs.robin).toBe(true);
  });
});

describe("gameStore.hydrate trust-boundary", () => {
  beforeEach(() => {
    useGameStore.getState().hydrate({
      day: 1,
      season: "Spring",
      seasonIndex: 0,
      year: 1,
      timeMinutes: 360,
      gold: 0,
      energy: MAX_ENERGY,
      maxEnergy: MAX_ENERGY,
    });
  });

  it("NaN/garbage numeric → fallback giữ state cũ, không poison", () => {
    // Save hand-edit `{gold: NaN, timeMinutes: "abc"}` → trước đây raw spread
    // pass qua → tick() string-concat time, addGold(NaN) poison math toàn bộ.
    useGameStore.getState().hydrate({
      gold: NaN,
      timeMinutes: "abc" as never,
      energy: -50,
      day: -3,
    } as never);
    expect(Number.isFinite(useGameStore.getState().gold)).toBe(true);
    expect(useGameStore.getState().gold).toBe(0); // Math.max(0, fallback=0)
    expect(typeof useGameStore.getState().timeMinutes).toBe("number");
    expect(useGameStore.getState().timeMinutes).toBe(360); // fallback cũ
    expect(useGameStore.getState().energy).toBe(0); // clamp ≥0
    expect(useGameStore.getState().day).toBe(1); // Math.max(1, …)
  });

  it("maxEnergy 0/undefined/NaN → fallback MAX_ENERGY (không NaN propagate)", () => {
    useGameStore.getState().hydrate({ maxEnergy: 0 } as never);
    expect(useGameStore.getState().maxEnergy).toBe(MAX_ENERGY);
    useGameStore.getState().hydrate({ maxEnergy: undefined } as never);
    expect(useGameStore.getState().maxEnergy).toBe(MAX_ENERGY);
    useGameStore.getState().hydrate({ maxEnergy: NaN } as never);
    expect(useGameStore.getState().maxEnergy).toBe(MAX_ENERGY);
  });

  it("seasonIndex ngoài [0,3] → clamp", () => {
    useGameStore.getState().hydrate({ seasonIndex: 99 } as never);
    expect(useGameStore.getState().seasonIndex).toBe(3);
    useGameStore.getState().hydrate({ seasonIndex: -5 } as never);
    expect(useGameStore.getState().seasonIndex).toBe(0);
  });

  it("timeMinutes ngoài [0, DAY_END*60] → clamp", () => {
    useGameStore.getState().hydrate({ timeMinutes: 99999 } as never);
    expect(useGameStore.getState().timeMinutes).toBeLessThanOrEqual(26 * 60);
    useGameStore.getState().hydrate({ timeMinutes: -100 } as never);
    expect(useGameStore.getState().timeMinutes).toBe(0);
  });

  it("W2 buffs: garbage field bỏ, số dương giữ; không truyền buffs → giữ nguyên", () => {
    useGameStore.getState().setBuffs({ speedUntilAbs: 5000 });
    // garbage: NaN/string/số âm bỏ hết
    useGameStore.getState().hydrate({
      buffs: { speedUntilAbs: NaN, xpUntilAbs: "mai", junk: 99 } as never,
    });
    expect(useGameStore.getState().buffs).toEqual({});
    // hợp lệ: giữ
    useGameStore.getState().hydrate({
      buffs: { speedUntilAbs: 6000, xpUntilAbs: 7000 },
    });
    expect(useGameStore.getState().buffs).toEqual({ speedUntilAbs: 6000, xpUntilAbs: 7000 });
    // partial hydrate không mang buffs → không xoá buff đang chạy
    useGameStore.getState().hydrate({ gold: 10 });
    expect(useGameStore.getState().buffs).toEqual({ speedUntilAbs: 6000, xpUntilAbs: 7000 });
  });
});

describe("questStore.hydrate trust-boundary", () => {
  beforeEach(() => {
    useQuestStore.getState().reset();
  });

  it("shippedGarbage/shippedGold NaN → fallback, không poison stats", () => {
    useQuestStore.getState().hydrate({
      shipped: { parsnip: "abc" as never },
      shippedGold: NaN,
      daysPlayed: -5,
      completed: "yes" as never,
    } as never);
    // shipped "abc" replaced với state cũ ({}), shippedQty trả 0 không crash
    expect(useQuestStore.getState().shippedQty("parsnip")).toBe(0);
    expect(Number.isFinite(useQuestStore.getState().shippedGold)).toBe(true);
    expect(useQuestStore.getState().daysPlayed).toBe(1); // fallback (âm → default)
  });

  it("shipped hợp lệ → giữ", () => {
    useQuestStore.getState().hydrate({
      shipped: { parsnip: 5 },
      shippedGold: 100,
      daysPlayed: 3,
    });
    expect(useQuestStore.getState().shippedQty("parsnip")).toBe(5);
    expect(useQuestStore.getState().shippedGold).toBe(100);
    expect(useQuestStore.getState().daysPlayed).toBe(3);
  });
});

describe("inventoryStore.hydrate trust-boundary", () => {
  beforeEach(() => {
    useInventoryStore.getState().hydrate(
      [
        { itemId: "hoe", qty: 1 },
        { itemId: "watering_can", qty: 1 },
        { itemId: "axe", qty: 1 },
        { itemId: "pickaxe", qty: 1 },
        { itemId: "scythe", qty: 1 },
        { itemId: "parsnip_seed", qty: 15 },
        null,
        null,
        null,
        null,
        null,
        null,
      ],
      0,
    );
  });

  it("slot rác (itemId không tồn tại, qty NaN/string) → drop, không poison", () => {
    // Trước đây raw pass → qty NaN poison countItem/addItem, itemId lạ → getItem
    // undefined → sellItem silent 0.
    useInventoryStore.getState().hydrate(
      [
        { itemId: "FAKE_ITEM", qty: 99 },
        { itemId: "parsnip_seed", qty: "abc" as never },
        { itemId: "parsnip", qty: NaN },
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
      ],
      0,
    );
    const slots = useInventoryStore.getState().slots;
    expect(slots[0]).toBeNull(); // FAKE_ITEM drop
    // qty "abc"/NaN → fallback 1 (itemId hợp lệ)
    expect(slots[1]).toEqual({ itemId: "parsnip_seed", qty: 1 });
    expect(slots[2]).toEqual({ itemId: "parsnip", qty: 1 });
    expect(Number.isFinite(useInventoryStore.getState().countItem("parsnip"))).toBe(true);
  });

  it("qty vượt maxStack → clamp về stack", () => {
    // parsnip stack 99 — save hack 9999 → clamp chặn dupe khi sell/add.
    useInventoryStore.getState().hydrate(
      [
        null,
        null,
        null,
        null,
        null,
        { itemId: "parsnip", qty: 9999 },
        null,
        null,
        null,
        null,
        null,
        null,
      ],
      0,
    );
    const slot = useInventoryStore.getState().slots[5];
    expect(slot?.qty).toBeLessThanOrEqual(9999); // stack lớn hoặc clamp về stack
    expect(slot?.qty).toBeGreaterThan(0);
  });

  it("selectedSlot OOB → clamp 0", () => {
    useInventoryStore.getState().hydrate(Array(12).fill(null), 999 as never);
    expect(useInventoryStore.getState().selectedSlot).toBe(0);
  });

  it("mảng dài hơn 12 → cắt, ngắn hơn → fill null", () => {
    useInventoryStore.getState().hydrate(
      [
        { itemId: "hoe", qty: 1 },
        ...Array(20).fill({ itemId: "parsnip", qty: 1 }),
      ] as never,
      0,
    );
    expect(useInventoryStore.getState().slots.length).toBe(12);
  });
});

describe("farmStore.hydrate shippingBoxes trust-boundary", () => {
  beforeEach(() => {
    useFarmStore.getState().reset();
  });

  it("contents qty NaN/string/garbage → drop, không poison gold khi sell", () => {
    // Trước đây raw pass → endDay sell path: qty="abc" không chặn (string<=0
    // false), shipCount string-concat, shipGold Math.round(...*"abc")=NaN.
    useFarmStore.getState().hydrate({
      shippingBoxes: {
        100: {
          tileIndex: 100,
          contents: {
            parsnip: "abc" as never,
            kale: NaN,
            valid: 5,
            bad: -3,
          },
        },
      },
    } as never);
    const box = useFarmStore.getState().getShippingBox(100);
    expect(box).not.toBeNull();
    expect(box?.contents.valid).toBe(5);
    expect(box?.contents.parsnip).toBeUndefined(); // garbage drop
    expect(box?.contents.kale).toBeUndefined(); // NaN drop
    expect(box?.contents.bad).toBeUndefined(); // âm drop
  });

  it("shippingBoxes không phải object → fallback empty", () => {
    useFarmStore.getState().hydrate({ shippingBoxes: "garbage" as never });
    const boxes = useFarmStore.getState().shippingBoxes;
    expect(Object.keys(boxes).length).toBe(0);
  });

  it("filledOrders rác (non-string/dup) → lọc string + dedupe; non-array → rỗng", () => {
    useFarmStore
      .getState()
      .hydrate({ filledOrders: ["d1-a", 5, null, "d1-a"] as never });
    expect(useFarmStore.getState().filledOrders).toEqual(["d1-a"]);
    useFarmStore.getState().hydrate({ filledOrders: "garbage" as never });
    expect(useFarmStore.getState().filledOrders).toEqual([]);
  });
});

describe("progressionStore.hydrate trust-boundary", () => {
  beforeEach(() => {
    useProgressionStore.getState().reset();
  });

  it("level/xp NaN/âm/garbage → fallback, clamp [1, MAX_LEVEL]", () => {
    // Trước đây `level ?? s.level` → NaN pass → addXp `NaN < MAX_LEVEL` false →
    // xp frozen, UI "NaN / 10".
    useProgressionStore.getState().hydrate({
      level: NaN,
      xp: "abc" as never,
      totalXp: -50,
      skillPoints: Infinity,
    } as never);
    const s = useProgressionStore.getState();
    expect(Number.isFinite(s.level)).toBe(true);
    expect(s.level).toBeGreaterThanOrEqual(1);
    expect(s.level).toBeLessThanOrEqual(MAX_LEVEL);
    expect(Number.isFinite(s.xp)).toBe(true);
    expect(s.totalXp).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(s.skillPoints)).toBe(true);
  });

  it("skillPoints âm → clamp 0", () => {
    useProgressionStore.getState().hydrate({ skillPoints: -5 } as never);
    expect(useProgressionStore.getState().skillPoints).toBe(0);
  });
});
