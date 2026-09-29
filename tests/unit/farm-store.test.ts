import { describe, it, expect, beforeEach, vi } from "vitest";
import { useFarmStore } from "../../src/store/farmStore";
import { useGameStore } from "../../src/store/gameStore";
import { useProgressionStore } from "../../src/store/progressionStore";
import { T, MAP_COLS, MAP_ROWS } from "../../src/lib/game/constants";
import { CROPS } from "../../src/lib/game/data";
import { setFallow } from "./helpers/fallow-tile";

// farmStore core mutations (till/water/plant/harvest/newDay) — kiểm tra bounds,
// crop growth, season rollover, sprinkler adjacency. Trước đây chưa có unit test
// trực tiếp farmStore (chỉ qua game-actions endDay).
function resetFarm() {
    useFarmStore.getState().hydrate({
      terrain: new Array(MAP_COLS * MAP_ROWS).fill(T.GRASS),
      crops: {},
      objects: {},
      forage: {},
      shippingBoxes: {},
      silo: {},
      filledOrders: [],
    } as never);
}

describe("farmStore", () => {
  beforeEach(() => {
    resetFarm();
    useGameStore.getState().hydrate({
      day: 1,
      season: "Spring",
      seasonIndex: 0,
      energy: useGameStore.getState().maxEnergy,
    } as never);
  });

  describe("bounds checks", () => {
    it("till ngoài map → false, không mutate", () => {
      expect(useFarmStore.getState().till(-1, 0)).toBe(false);
      expect(useFarmStore.getState().till(0, -1)).toBe(false);
      expect(useFarmStore.getState().till(MAP_COLS, 0)).toBe(false);
      expect(useFarmStore.getState().till(0, MAP_ROWS)).toBe(false);
    });

    it("till chỉ cuốc được FALLOW, không cuốc GRASS", () => {
      expect(useFarmStore.getState().till(5, 5)).toBe(false);
      expect(useFarmStore.getState().terrain[5 * MAP_COLS + 5]).toBe(T.GRASS);
      setFallow(5, 5);
      expect(useFarmStore.getState().till(5, 5)).toBe(true);
      expect(useFarmStore.getState().terrain[5 * MAP_COLS + 5]).toBe(T.TILLED);
      expect(useFarmStore.getState().till(5, 5)).toBe(false);
    });

    it("till ô plot khóa level → false, tile vẫn FALLOW (phase 2 gate)", () => {
      useProgressionStore.getState().hydrate({ level: 1, xp: 0, totalXp: 0, skillPoints: 0 });
      setFallow(9, 28); // unlockLevel 3
      expect(useFarmStore.getState().till(9, 28)).toBe(false);
      expect(useFarmStore.getState().terrain[28 * MAP_COLS + 9]).toBe(T.FALLOW);
    });

    it("till ô plot khóa level mở khi đủ level", () => {
      useProgressionStore.getState().hydrate({ level: 3, xp: 0, totalXp: 0, skillPoints: 0 });
      setFallow(9, 28);
      expect(useFarmStore.getState().till(9, 28)).toBe(true);
      expect(useFarmStore.getState().terrain[28 * MAP_COLS + 9]).toBe(T.TILLED);
    });
  });

  describe("isSolid — placed objects", () => {
    it("sprinkler không block movement (đi qua ô giữa ruộng)", () => {
      const farm = useFarmStore.getState();
      setFallow(5, 5);
      farm.till(5, 5);
      farm.placeObject(5, 5, "sprinkler");
      expect(useFarmStore.getState().isSolid(5, 5)).toBe(false);
    });
    it("shipping_box không block movement", () => {
      useFarmStore.getState().placeObject(10, 10, "shipping_box");
      expect(useFarmStore.getState().isSolid(10, 10)).toBe(false);
    });
    it("fence block movement", () => {
      useFarmStore.getState().placeObject(12, 12, "fence");
      expect(useFarmStore.getState().isSolid(12, 12)).toBe(true);
    });
  });

  describe("newDay sprinkler adjacency — wrap-around bug", () => {
    it("sprinkler ở (0, y+1) KHÔNG tưới ô mép phải (MAP_COLS-1, y)", () => {
      // Setup: ô (MAP_COLS-1, 5) = TILLED_WET, sprinkler đặt ở (0, 6).
      // Trước fix: idx(MAP_COLS, 5) = 5*MAP_COLS + MAP_COLS = 6*MAP_COLS = idx(0,6)
      // → wrap-around tính sprinkler adjacent → giữ ướt nhầm (exploit tưới chéo).
      // Sau fix: inBounds chặn, ô mép phải dry như dự kiến (không có sprinkler thật adjacent).
      const farm = useFarmStore.getState();
      setFallow(MAP_COLS - 1, 5);
      farm.till(MAP_COLS - 1, 5);
      farm.water(MAP_COLS - 1, 5);
      // Đặt sprinkler ở (0,6) — KHÔNG adjacent thật với (MAP_COLS-1,5)
      useFarmStore.getState().hydrate({
        objects: { [6 * MAP_COLS + 0]: { type: "sprinkler" } },
      } as never);
      expect(useFarmStore.getState().terrain[5 * MAP_COLS + (MAP_COLS - 1)]).toBe(T.TILLED_WET);
      useFarmStore.getState().newDay("Spring");
      // Ô mép phải phải DRY (TILLED) — không có sprinkler thật adjacent
      expect(useFarmStore.getState().terrain[5 * MAP_COLS + (MAP_COLS - 1)]).toBe(T.TILLED);
    });

    it("sprinkler thật adjacent → ô vẫn ướt qua newDay", () => {
      const farm = useFarmStore.getState();
      setFallow(5, 5);
      farm.till(5, 5);
      farm.water(5, 5);
      // Sprinkler ở (5,6) — adjacent thật
      useFarmStore.getState().hydrate({
        objects: { [6 * MAP_COLS + 5]: { type: "sprinkler" } },
      } as never);
      useFarmStore.getState().newDay("Spring");
      expect(useFarmStore.getState().terrain[5 * MAP_COLS + 5]).toBe(T.TILLED_WET);
    });
  });

  describe("plant + harvest", () => {
    it("plant cần TILLED, không trồng 2 lần cùng ô", () => {
      setFallow(5, 5);
      useFarmStore.getState().till(5, 5);
      expect(useFarmStore.getState().plant(5, 5, "parsnip")).toBe(true);
      expect(useFarmStore.getState().plant(5, 5, "parsnip")).toBe(false); // đã có crop
    });

    it("harvest crop chưa mature → null, không mất crop", () => {
      setFallow(5, 5);
      useFarmStore.getState().till(5, 5);
      useFarmStore.getState().plant(5, 5, "parsnip");
      const h = useFarmStore.getState().harvest(5, 5);
      expect(h).toBeNull();
      expect(useFarmStore.getState().crops[5 * MAP_COLS + 5]).toBeDefined();
    });

    it("harvest mature → tile FALLOW, crop gone", () => {
      setFallow(5, 5);
      useFarmStore.getState().till(5, 5);
      expect(useFarmStore.getState().plant(5, 5, "parsnip")).toBe(true);
      const i = 5 * MAP_COLS + 5;
      const crop = useFarmStore.getState().crops[i];
      useFarmStore.getState().hydrate({
        crops: {
          [i]: { ...crop, stage: CROPS.parsnip.stages - 1, daysGrown: CROPS.parsnip.stages - 1 },
        },
      } as never);
      const h = useFarmStore.getState().harvest(5, 5);
      expect(h).not.toBeNull();
      expect(useFarmStore.getState().crops[i]).toBeUndefined();
      expect(useFarmStore.getState().terrain[i]).toBe(T.FALLOW);
    });
  });

  describe("silo (phase 5)", () => {
    it("addToSilo trong cap → true; vượt cap → false không mutate", () => {
      useProgressionStore.getState().hydrate({ level: 1, xp: 0, totalXp: 0, skillPoints: 0 });
      expect(useFarmStore.getState().addToSilo("parsnip", 10)).toBe(true);
      expect(useFarmStore.getState().silo.parsnip).toBe(10);
      expect(useFarmStore.getState().addToSilo("parsnip", 11)).toBe(false); // 21 > 20
      expect(useFarmStore.getState().silo.parsnip).toBe(10);
    });

    it("removeFromSilo trả số thực removes, cap theo có", () => {
      useFarmStore.getState().hydrate({ silo: { parsnip: 5 } } as never);
      expect(useFarmStore.getState().removeFromSilo("parsnip", 3)).toBe(3);
      expect(useFarmStore.getState().silo.parsnip).toBe(2);
      expect(useFarmStore.getState().removeFromSilo("parsnip", 9)).toBe(2);
      expect(useFarmStore.getState().silo.parsnip).toBeUndefined();
    });

    it("harvest mature → crop vào silo, tile FALLOW", () => {
      useProgressionStore.getState().hydrate({ level: 1, xp: 0, totalXp: 0, skillPoints: 0 });
      setFallow(5, 5);
      useFarmStore.getState().till(5, 5);
      useFarmStore.getState().plant(5, 5, "parsnip");
      const i = 5 * MAP_COLS + 5;
      const crop = useFarmStore.getState().crops[i];
      useFarmStore.getState().hydrate({
        crops: { [i]: { ...crop, stage: CROPS.parsnip.stages - 1 } },
      } as never);
      const h = useFarmStore.getState().harvest(5, 5);
      expect(h).not.toBeNull();
      expect(useFarmStore.getState().silo.parsnip ?? 0).toBeGreaterThanOrEqual(1);
      expect(useFarmStore.getState().terrain[i]).toBe(T.FALLOW);
    });

    it("harvest khi silo đầy → null, crop còn", () => {
      useProgressionStore.getState().hydrate({ level: 1, xp: 0, totalXp: 0, skillPoints: 0 });
      setFallow(5, 5);
      useFarmStore.getState().till(5, 5);
      useFarmStore.getState().plant(5, 5, "parsnip");
      const i = 5 * MAP_COLS + 5;
      const crop = useFarmStore.getState().crops[i];
      useFarmStore.getState().hydrate({
        crops: { [i]: { ...crop, stage: CROPS.parsnip.stages - 1 } },
        silo: { parsnip: 20 }, // lv1 cap 20
      } as never);
      expect(useFarmStore.getState().harvest(5, 5)).toBeNull();
      expect(useFarmStore.getState().crops[i]).toBeDefined();
    });

    it("hydrate sanitize silo: int ≥ 0, bỏ rác", () => {
      useFarmStore.getState().hydrate({
        silo: { parsnip: 5, potato: -3, junk: "x", ok: 2.7 },
      } as never);
      expect(useFarmStore.getState().silo).toEqual({ parsnip: 5, ok: 2 });
    });
  });

  describe("filledOrders (phase 5 fix — mỗi đơn 1 lần/ngày)", () => {
    it("markOrderFilled ghi id, dedupe gọi lại", () => {
      useFarmStore.getState().markOrderFilled("d1-a");
      useFarmStore.getState().markOrderFilled("d1-a");
      expect(useFarmStore.getState().filledOrders).toEqual(["d1-a"]);
    });

    it("newDay → clear filledOrders — bảng đơn làm mới mỗi sáng", () => {
      useFarmStore.getState().markOrderFilled("d1-a");
      useFarmStore.getState().newDay("Spring");
      expect(useFarmStore.getState().filledOrders).toEqual([]);
    });

    it("reset → filledOrders rỗng (farm mới)", () => {
      useFarmStore.getState().markOrderFilled("d1-a");
      useFarmStore.getState().reset();
      expect(useFarmStore.getState().filledOrders).toEqual([]);
    });
  });

  describe("hydrate terrain length validate", () => {
    it("terrain ngắn (legacy 30×22=660) → rebuild full-size, giữ tile cũ", () => {
      const legacy = new Array<number>(660).fill(T.WATER);
      legacy[5] = T.TILLED;
      useFarmStore.getState().hydrate({ terrain: legacy } as never);
      const t = useFarmStore.getState().terrain;
      expect(t.length).toBe(MAP_COLS * MAP_ROWS);
      // tile cũ hợp lệ giữ nguyên trong phần đầu
      expect(t[5]).toBe(T.TILLED);
      // phần thiếu fill GRASS default (không undefined)
      expect(t[700]).toBe(T.GRASS);
    });

    it("terrain dài thừa → truncate về grid size", () => {
      const oversized = new Array<number>(MAP_COLS * MAP_ROWS + 50).fill(T.WATER);
      useFarmStore.getState().hydrate({ terrain: oversized } as never);
      expect(useFarmStore.getState().terrain.length).toBe(MAP_COLS * MAP_ROWS);
    });

    it("terrain đúng size → pass-through không rebuild", () => {
      const good = new Array<number>(MAP_COLS * MAP_ROWS).fill(T.TILLED);
      useFarmStore.getState().hydrate({ terrain: good } as never);
      expect(useFarmStore.getState().terrain[0]).toBe(T.TILLED);
      expect(useFarmStore.getState().terrain.length).toBe(MAP_COLS * MAP_ROWS);
    });
  });

  describe("regrowResources tách counter mỗi loại", () => {
    it("8 stump + 8 stone_empty, all roll → mỗi loại regrow đúng 4 (trước đây counter chung lấn nhau)", () => {
      // Bug cũ: counter `regrown` dùng chung → 4 stump regrow trước thì 0 rock
      // regrow (và ngược lại). Đặt nhiều stump TRƯỚC stone_empty trong mảng → nếu
      // counter chung, stone không có slot. Fix: tách counter → cả 2 loại 4.
      const terrain = new Array<number>(MAP_COLS * MAP_ROWS).fill(T.GRASS);
      for (let i = 0; i < 8; i++) terrain[i] = T.STUMP;
      for (let i = 8; i < 16; i++) terrain[i] = T.STONE_EMPTY;
      useFarmStore.getState().hydrate({ terrain } as never);

      // Mock Math.random = 0.1 (đều < 0.25 stump + < 0.2 stone) → mọi tile đều roll.
      const spy = vi.spyOn(Math, "random").mockReturnValue(0.1);
      try {
        useFarmStore.getState().regrowResources("Spring");
      } finally {
        spy.mockRestore();
      }
      const t = useFarmStore.getState().terrain;
      let trees = 0;
      let rocks = 0;
      for (let i = 0; i < 8; i++) if (t[i] === T.TREE) trees++;
      for (let i = 8; i < 16; i++) if (t[i] === T.ROCK) rocks++;
      expect(trees).toBe(4); // đúng cap stump
      expect(rocks).toBe(4); // đúng cap stone — KHÔNG bị stump lấn
    });

    it("Winter → không regrow (no-op)", () => {
      const terrain = new Array<number>(MAP_COLS * MAP_ROWS).fill(T.GRASS);
      terrain[0] = T.STUMP;
      useFarmStore.getState().hydrate({ terrain } as never);
      useFarmStore.getState().regrowResources("Winter");
      expect(useFarmStore.getState().terrain[0]).toBe(T.STUMP);
    });
  });
});
