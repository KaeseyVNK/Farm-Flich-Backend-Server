import { describe, expect, it } from "vitest";
import { migrate } from "@/lib/game/save";
import { isBloodMoon } from "@/lib/game/story/blood-moon";

function makeSave(v: number, day = 1): Record<string, unknown> {
  return {
    version: v,
    savedAt: 1,
    slot: "slot1",
    game: { day, season: "Spring", seasonIndex: 0, year: 1, timeMinutes: 400, gold: 10, energy: 100 },
    player: { x: 1, y: 1 },
    inventory: { slots: [null], selectedSlot: 0 },
    farm: { terrain: [], crops: {}, objects: {}, forage: {} },
    npc: { friendship: {}, talkedToday: {}, giftedToday: {} },
  };
}

describe("save migrate v11 → v12 (tutorial)", () => {
  it("bump version 12 + quests.tutorialStep/claimed default {0, []}", () => {
    const m = migrate(makeSave(11));
    expect(m).not.toBeNull();
    expect(m!.version).toBe(12);
    expect(m!.quests!.tutorialStep).toBe(0);
    expect(m!.quests!.tutorialClaimed).toEqual([]);
  });

  it("STORY CŨ bị drop toàn bộ (retire) — không còn chapter/flags trong save mới", () => {
    const save = makeSave(11, 1);
    save.story = {
      chapterId: "ch4",
      nodeId: "n9",
      visitedNodes: ["start", "n1", "n9"],
      flags: { mercy: 3, corruption: 1 },
      ending: "sacrifice",
    };
    const m = migrate(save);
    expect(m!.story).toBeUndefined();
    expect(m!.quests!.tutorialStep).toBe(0); // story cũ KHÔNG ánh xạ sang bước tutorial
    expect(m!.quests!.tutorialClaimed).toEqual([]);
  });

  it("veteran v7→v12 (day>=3 hoặc level>=3, chưa có tutorial) → skip full chain", () => {
    const m = migrate(makeSave(7, 3));
    expect(m!.quests!.tutorialStep).toBe(14);
    expect(m!.quests!.tutorialClaimed).toHaveLength(14);
  });

  it("save v10 cũ (W6) migrate xuyên tới v12 với tutorial mặc định", () => {
    const m = migrate(makeSave(10));
    expect(m!.version).toBe(12);
    expect(m!.quests!.tutorialStep).toBe(0);
  });

  it("quests thiếu (pre-quest save) → default tutorial {0, []}", () => {
    const m = migrate(makeSave(10));
    expect(m!.quests!.tutorialStep).toBe(0);
    expect(m!.quests!.tutorialClaimed).toEqual([]);
  });

  it("quests mang sẵn tutorialStep hợp lệ → giữ nguyên", () => {
    const save = makeSave(11);
    save.quests = {
      completed: { q_first_harvest: true },
      shipped: {},
      shippedGold: 0,
      daysPlayed: 3,
      tutorialStep: 5,
      tutorialClaimed: ["t_till", "t_plant_water", "t_harvest", "t_first_order", "t_sleep"],
    };
    const m = migrate(save);
    expect(m!.quests!.tutorialStep).toBe(5);
    expect(m!.quests!.tutorialClaimed).toHaveLength(5);
  });
});

describe("blood-moon detach chapter (day-hash thuần)", () => {
  it("isBloodMoon không còn tham số chapter — determinism theo (day, userId)", () => {
    // Giá trị hash cho một (day, userId) cố định — assert deterministic + biên hash % 7.
    const a1 = isBloodMoon(7, "u1");
    const a2 = isBloodMoon(7, "u1");
    expect(a1).toBe(a2);
    // Biên: day 1 điểm khởi đầu — chấp nhận true/false, chỉ cần deterministic.
    const b1 = isBloodMoon(1, "u1");
    const b2 = isBloodMoon(1, "u1");
    expect(b1).toBe(b2);
  });

  it("hashSeed FNV-1a ổn định (regression guard)", () => {
    // Bảng chân trị hash("owner-abc:{day}")%7: day3→0, day6→6, day7→1.
    expect(isBloodMoon(3, "owner-abc")).toBe(true);
    expect(isBloodMoon(6, "owner-abc")).toBe(false);
  });
});