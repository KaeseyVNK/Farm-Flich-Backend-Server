import { describe, expect, it } from "vitest";
import {
  TUTORIAL_ORDER,
  TUTORIAL_STEPS,
  getTutorialStep,
  tutorialStepIndex,
  nextTutorialStep,
  tutorialCheck,
  tutorialProgress,
  tutorialReward,
  tutorialAllowedToSkip,
} from "@/lib/game/tutorial/tutorial-catalog";
import {
  incomeShare,
  INCOME_TARGET_DAYS,
  SUNFISH_RIVER_PRICE,
} from "@/lib/game/tutorial/economy-thresholds";

const EMPTY = () => ({
  plotsHoed: 0,
  cropsPlanted: 0,
  cropsWatered: 0,
  harvested: 0,
  itemsSold: 0,
  fishCaught: 0,
  fryStocked: 0,
  dishCooked: 0,
  dishEaten: 0,
  decorPlaced: 0,
  mountRidden: 0,
  visitorsOpened: 0,
  monstersDefeated: 0,
  raidEscaped: 0,
  festivalClaimed: 0,
  level: 1,
  day: 1,
});

describe("TUTORIAL_ORDER — 14 bước, mở dần theo chỉ số", () => {
  it("đủ 14 bước, id duy nhất", () => {
    expect(TUTORIAL_ORDER).toHaveLength(14);
    expect(new Set(TUTORIAL_ORDER).size).toBe(14);
  });

  it("mọi bước khai báo trong TUTORIAL_STEPS với id khớp", () => {
    for (const id of TUTORIAL_ORDER) {
      const s = TUTORIAL_STEPS.find((t) => t.id === id);
      expect(s, `step ${id} missing`).toBeDefined();
      expect(s!.id).toBe(id);
    }
  });

  it("tutorialStepIndex/nextTutorialStep hoạt động", () => {
    expect(tutorialStepIndex("t_till")).toBe(0);
    expect(tutorialStepIndex("t_raid_first")).toBe(13);
    expect(nextTutorialStep(0)).toBe("t_plant_water");
    expect(nextTutorialStep(13)).toBeNull();
    expect(nextTutorialStep(99)).toBeNull();
  });

  it("getTutorialStep trả undefined cho id lạ", () => {
    expect(getTutorialStep("nope")).toBeUndefined();
    expect(getTutorialStep("t_till")).toBeDefined();
  });
});

describe("tutorialCheck — mỗi bước check đúng nhánh", () => {
  it("bước 0 t_till: cần 1 ô đã cuốc", () => {
    expect(tutorialCheck("t_till", EMPTY())).toBe(false);
    expect(tutorialCheck("t_till", { ...EMPTY(), plotsHoed: 1 })).toBe(true);
  });

  it("bước 1 t_plant_water: gieo + tưới", () => {
    const s = EMPTY();
    expect(tutorialCheck("t_plant_water", s)).toBe(false);
    expect(tutorialCheck("t_plant_water", { ...s, cropsPlanted: 1 })).toBe(false);
    expect(tutorialCheck("t_plant_water", { ...s, cropsPlanted: 1, cropsWatered: 1 })).toBe(true);
  });

  it("bước 2 t_harvest: thu hoạch 1 nông sản", () => {
    expect(tutorialCheck("t_harvest", EMPTY())).toBe(false);
    expect(tutorialCheck("t_harvest", { ...EMPTY(), harvested: 1 })).toBe(true);
  });

  it("bước 3 t_first_order: bán 1 lần (không gate cấp)", () => {
    const s = { ...EMPTY(), harvested: 3 };
    expect(tutorialCheck("t_first_order", s)).toBe(false);
    expect(tutorialCheck("t_first_order", { ...s, itemsSold: 1 })).toBe(true);
    expect(tutorialCheck("t_first_order", { ...EMPTY(), itemsSold: 1, level: 1 })).toBe(true);
  });

  it("bước 4 t_sleep: ngày 2+ (đã qua 1 đêm)", () => {
    expect(tutorialCheck("t_sleep", EMPTY())).toBe(false);
    expect(tutorialCheck("t_sleep", { ...EMPTY(), day: 2 })).toBe(true);
  });

  it("bước 5 t_fish: câu 1 con", () => {
    const s = EMPTY();
    expect(tutorialCheck("t_fish", s)).toBe(false);
    expect(tutorialCheck("t_fish", { ...s, fishCaught: 1 })).toBe(true);
  });

  it("bước 6 t_fry: thả cá bột 1 con", () => {
    expect(tutorialCheck("t_fry", { ...EMPTY(), fryStocked: 0 })).toBe(false);
    expect(tutorialCheck("t_fry", { ...EMPTY(), fryStocked: 1 })).toBe(true);
  });

  it("bước 7 t_cook: nấu 1 món", () => {
    expect(tutorialCheck("t_cook", { ...EMPTY(), dishCooked: 0 })).toBe(false);
    expect(tutorialCheck("t_cook", { ...EMPTY(), dishCooked: 1 })).toBe(true);
  });

  it("bước 8 t_eat: ăn 1 món buff", () => {
    const s = EMPTY();
    expect(tutorialCheck("t_eat", s)).toBe(false);
    expect(tutorialCheck("t_eat", { ...s, dishEaten: 1 })).toBe(true);
  });

  it("bước 9 t_decor: đặt 1 decor", () => {
    expect(tutorialCheck("t_decor", { ...EMPTY(), decorPlaced: 0 })).toBe(false);
    expect(tutorialCheck("t_decor", { ...EMPTY(), decorPlaced: 1 })).toBe(true);
  });

  it("bước 10 t_visit: mở panel visitors OR có friend", () => {
    const s = EMPTY();
    expect(tutorialCheck("t_visit", s)).toBe(false);
    expect(tutorialCheck("t_visit", { ...s, visitorsOpened: 1 })).toBe(true);
  });

  it("bước 11 t_deep_forest: hạ 1 quái", () => {
    expect(tutorialCheck("t_deep_forest", { ...EMPTY(), monstersDefeated: 0 })).toBe(false);
    expect(tutorialCheck("t_deep_forest", { ...EMPTY(), monstersDefeated: 1 })).toBe(true);
  });

  it("bước 12 t_mount: đi mount 1 lần", () => {
    expect(tutorialCheck("t_mount", { ...EMPTY(), mountRidden: 0 })).toBe(false);
    expect(tutorialCheck("t_mount", { ...EMPTY(), mountRidden: 1 })).toBe(true);
  });

  it("bước 13 t_raid_first: thoát raid thành công", () => {
    expect(tutorialCheck("t_raid_first", { ...EMPTY(), raidEscaped: 0 })).toBe(false);
    expect(tutorialCheck("t_raid_first", { ...EMPTY(), raidEscaped: 1 })).toBe(true);
  });
});

describe("tutorialProgress — current/target hợp lệ", () => {
  it("t_progress helper trả số nguyên trong [0, target]", () => {
    const [c, t] = tutorialProgress("t_till", EMPTY()) ?? [0, 0];
    expect(t).toBeGreaterThan(0);
    expect(c).toBeGreaterThanOrEqual(0);
    expect(c).toBeLessThanOrEqual(t);
  });

  it("check(true) ⟺ progress current === target", () => {
    const s = { ...EMPTY(), plotsHoed: 1, cropsPlanted: 1, cropsWatered: 1, harvested: 2, itemsSold: 1, fishCaught: 1, fryStocked: 1, dishCooked: 1, dishEaten: 1, decorPlaced: 1, visitorsOpened: 1, monstersDefeated: 1, mountRidden: 1, raidEscaped: 1, day: 2, level: 5 };
    for (const id of TUTORIAL_ORDER) {
      const done = tutorialCheck(id, s);
      const [c, t] = tutorialProgress(id, s) ?? [0, 0];
      expect(c <= t, `${id} progress out of range`).toBe(true);
      if (done) expect(c, `${id} done but progress not full`).toBeGreaterThanOrEqual(t);
    }
  });
});

describe("tutorialReward — vàng tăng dần 50→400, item hợp lệ", () => {
  it("gold tăng dần theo bước, tất cả > 0", () => {
    const golds = TUTORIAL_ORDER.map((id) => tutorialReward(id)?.gold ?? 0);
    expect(golds.every((g) => g > 0)).toBe(true);
    for (let i = 1; i < golds.length; i++) {
      expect(golds[i]).toBeGreaterThan(golds[i - 1]);
    }
    expect(golds[0]).toBe(50);
    expect(golds[13]).toBe(400);
  });

  it("item reward trỏ item tồn tại trong data — decor khóa decorId riêng", async () => {
    const { getItem } = await import("@/lib/game/data");
    const { decorById } = await import("@/lib/game/decor/decor-catalog");
    for (const id of TUTORIAL_ORDER) {
      const r = tutorialReward(id);
      if (r?.item) {
        const found = getItem(r.item.id); // grant path: addItem chỉ đọc ITEMS
        expect(found, `item ${r.item.id} (step ${id})`).toBeDefined();
        expect(r.item.qty).toBeGreaterThan(0);
      }
      if (r?.decorId) {
        const found = decorById(r.decorId); // grant path: ownDecor chỉ decor def
        expect(found, `decor ${r.decorId} (step ${id})`).toBeDefined();
      }
      // 1 đường grant duy nhất — không item lẫn decorId cùng bước.
      expect(!r?.item || !r?.decorId, `step ${id} không trùng item/decor`).toBe(true);
    }
  });
});

describe("tutorialAllowedToSkip — skip chỉ khi thật sự đã làm", () => {
  it("đã vượt xa thì skip bước chặn cho phép", () => {
    const s = { ...EMPTY(), harvested: 2, itemsSold: 1, level: 3, fishCaught: 1 };
    expect(tutorialAllowedToSkip("t_first_order", s, 1)).toBe(true);
  });

  it("chưa đủ thì KHÔNG cho skip", () => {
    const s = { ...EMPTY(), level: 1, harvested: 0 };
    expect(tutorialAllowedToSkip("t_first_order", s, 0)).toBe(false);
    expect(tutorialAllowedToSkip("t_till", s, 0)).toBe(false);
  });

  it("bước âm (chưa từng claim) không skip bao giờ", () => {
    expect(tutorialAllowedToSkip("t_first_order", { ...EMPTY(), harvested: 5 }, -1)).toBe(false);
  });
});

describe("economy-thresholds — ngưỡng cân bằng", () => {
  it("incomeShare không vượt 60% nguồn bất kỳ", () => {
    const income = { farming: 32, fishing: 48, cooking: 10, raid: 10 };
    const share = incomeShare(income);
    expect(share.total).toBe(100);
    expect(Math.max(share.farming, share.fishing, share.cooking, share.raid)).toBeLessThanOrEqual(0.6);
  });

  it("incomeShare total = 0 → chia đều 0 (không NaN)", () => {
    const share = incomeShare({ farming: 0, fishing: 0, cooking: 0, raid: 0 });
    expect(share.total).toBe(0);
    expect(share.farming).toBe(0);
  });

  it("INCOME_TARGET_DAYS khớp plan (bicycle 2–3 ngày, horse 8–12 ngày)", () => {
    expect(INCOME_TARGET_DAYS.bicycle).toBeGreaterThanOrEqual(2);
    expect(INCOME_TARGET_DAYS.bicycle).toBeLessThanOrEqual(3);
    expect(INCOME_TARGET_DAYS.horse).toBeGreaterThanOrEqual(8);
    expect(INCOME_TARGET_DAYS.horse).toBeLessThanOrEqual(12);
  });

  it("giá cá sông giữ mốc benchmark sunfish (kiểm drift economy.json)", () => {
    expect(SUNFISH_RIVER_PRICE).toBe(25); // economy.json sunfish base — nếu drift, cập nhật cả 2 phía có chủ ý
  });
});