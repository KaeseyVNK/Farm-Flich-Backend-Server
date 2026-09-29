import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "@/store/gameStore";
import { useInventoryStore } from "@/store/inventoryStore";
import { migrate, SAVE_SCHEMA_VERSION, type SaveData } from "@/lib/game/save";
import { KITCHEN_RECIPES } from "@/lib/game/cooking/recipe-catalog";
import { FISH } from "@/lib/game/fish-catalog";
import { gameActions } from "@/lib/game/actions";
import { derbyScore } from "@/lib/game/festival/festival-scoring";

/** W8 P3: catchLog derby (log khi catchFish, clear endDay) + submitCookoff + save v11. */

const seed = (n: number) => Array.from({ length: n }, (_, i) => ({ uid: `s${i}` }));

describe("gameStore catchLog", () => {
  beforeEach(() => useGameStore.getState().clearCatchLog());

  it("logCatch thêm vào, cap 500", () => {
    const g = useGameStore.getState();
    g.logCatch("fish_a");
    g.logCatch("fish_b");
    expect(useGameStore.getState().catchLog).toEqual(["fish_a", "fish_b"]);
    useGameStore.setState({ catchLog: seed(500).map(() => "x") });
    useGameStore.getState().logCatch("overflow");
    expect(useGameStore.getState().catchLog.length).toBe(500);
  });
});

describe("save v11 — catchLog roundtrip + migrate", () => {
  it("SAVE_SCHEMA_VERSION = 12 (W9 tutorial)", () => {
    expect(SAVE_SCHEMA_VERSION).toBe(12);
  });

  it("migrate v10 (không catchLog) → catchLog rỗng", () => {
    const v10 = { version: 10, savedAt: 1, slot: "slot1", game: { day: 2, season: "Spring", seasonIndex: 0, year: 1, timeMinutes: 400, gold: 100, energy: 100 }, player: { x: 1, y: 1 } } as unknown as SaveData;
    const out = migrate(v10)!;
    expect(out.game.catchLog).toEqual([]);
  });

  it("migrate giữ catchLog hợp lệ, lọc phần tử lạ + cap 500", () => {
    const dirty = {
      version: 11,
      savedAt: 1,
      slot: "slot1",
      game: { day: 2, season: "Spring", seasonIndex: 0, year: 1, timeMinutes: 400, gold: 0, energy: 0, catchLog: ["fish_a", 42, null, "fish_b"] },
      player: { x: 1, y: 1 },
    } as unknown as SaveData;
    const out = migrate(dirty)!;
    expect(out.game.catchLog).toEqual(["fish_a", "fish_b"]);
  });
});

describe("submitCookoffDishes (qua test-bridge actions)", () => {
  beforeEach(() => {
    useInventoryStore.getState().hydrate(Array.from({ length: 12 }, () => null), 0);
  });

  it("nộp 1 món tier 1 → consume + 20 điểm", () => {
    const inv = useInventoryStore.getState();
    inv.addItem("parsnip_soup", 1);
    expect(inv.countItem("parsnip_soup")).toBe(1);
    const score = gameActions.submitCookoffDishes(["parsnip_soup"]);
    expect(score).toBe(20);
    expect(useInventoryStore.getState().countItem("parsnip_soup")).toBe(0);
  });

  it("thiếu món → null, KHÔNG consume món nào", () => {
    useInventoryStore.getState().addItem("boiled_egg", 1);
    const score = gameActions.submitCookoffDishes(["boiled_egg", "ck_khong_co"]);
    expect(score).toBeNull();
    expect(useInventoryStore.getState().countItem("boiled_egg")).toBe(1);
  });

  it("trên 3 món → null (chặn ở UI contract)", () => {
    const dishes = KITCHEN_RECIPES.slice(0, 4).map((r) => r.outputItemId);
    expect(gameActions.submitCookoffDishes(dishes)).toBeNull();
  });
});

describe("derby tích hợp catchLog thật", () => {
  it("2 cá trong log → điểm đúng catalog", () => {
    useGameStore.getState().clearCatchLog();
    const c = FISH[0];
    const m = FISH.find((f) => f.rarity === "medium") ?? FISH[0];
    useGameStore.getState().logCatch(c.id);
    useGameStore.getState().logCatch(m.id);
    const s = derbyScore(useGameStore.getState().catchLog.map((id) => ({ fishId: id })));
    expect(s).toBeGreaterThan(0);
    useGameStore.getState().clearCatchLog();
  });
});
