import { describe, it, expect, beforeEach } from "vitest";
import { useGameStore } from "../../src/store/gameStore";
import { useFarmStore } from "../../src/store/farmStore";
import { useInventoryStore } from "../../src/store/inventoryStore";
import { useProgressionStore } from "../../src/store/progressionStore";
import { useUiStore } from "../../src/store/uiStore";
import { gameActions } from "../../src/lib/game/actions";
import { tryInteract } from "../../src/lib/game/interact";
import { activeBuffs } from "../../src/lib/game/buff";
import { useWorldStore } from "../../src/store/worldStore";

function resetAll(level = 5) {
  useGameStore.getState().hydrate({
    day: 3, season: "Spring", seasonIndex: 0, year: 1, timeMinutes: 600,
    gold: 500, energy: 200, maxEnergy: 270,
  });
  useGameStore.getState().setBuffs({});
  useFarmStore.getState().hydrate({
    silo: { parsnip: 10, egg: 6, milk: 4, sunfish: 2, wheat: 5 } as never,
    pondFish: [], filledOrders: [],
  } as never);
  useInventoryStore.getState().hydrate(
    Array.from({ length: 12 }, (_, i) => (i === 0 ? { itemId: "hoe", qty: 1 } : null)),
    0,
  );
  useProgressionStore.getState().hydrate({ level, xp: 0, totalXp: 0, skillPoints: 0 } as never);
}

describe("gameActions.cook (W2 P4)", () => {
  beforeEach(() => resetAll());

  it("tier1: consume nguyên liệu SILO TRƯỚC, món vào túi, +XP", () => {
    const xpBefore = useProgressionStore.getState().totalXp;
    const ok = gameActions.cook("ck_parsnip_soup", "good");
    expect(ok).toBe(true);
    expect(useFarmStore.getState().silo.parsnip).toBe(8); // 10 − 2
    expect(useInventoryStore.getState().countItem("parsnip_soup")).toBe(1);
    expect(useProgressionStore.getState().totalXp).toBeGreaterThan(xpBefore);
  });

  it("thiếu nguyên liệu → false, không mất gì", () => {
    useFarmStore.getState().hydrate({ silo: { parsnip: 1 } } as never);
    const ok = gameActions.cook("ck_parsnip_soup", "good");
    expect(ok).toBe(false);
    expect(useFarmStore.getState().silo.parsnip).toBe(1);
    expect(useInventoryStore.getState().countItem("parsnip_soup")).toBe(0);
  });

  it("level gate: công thức lv5 khoá ở level 2", () => {
    useProgressionStore.getState().hydrate({ level: 2, xp: 0, totalXp: 0, skillPoints: 0 } as never);
    expect(gameActions.cook("ck_sashimi", "good")).toBe(false);
    expect(gameActions.cook("ck_parsnip_soup", "good")).toBe(true); // lv1
  });

  it("input từ túi bù khi silo thiếu (bag∪silo)", () => {
    useFarmStore.getState().hydrate({ silo: {} } as never);
    useInventoryStore.getState().hydrate(
      [
        { itemId: "parsnip", qty: 2 },
        ...Array.from({ length: 11 }, () => null),
      ],
      0,
    );
    expect(gameActions.cook("ck_parsnip_soup", "good")).toBe(true);
    expect(useInventoryStore.getState().countItem("parsnip")).toBe(0);
    expect(useInventoryStore.getState().countItem("parsnip_soup")).toBe(1);
  });

  it("perfect → món ×2 (nguyên liệu không tăng)", () => {
    expect(gameActions.cook("ck_parsnip_soup", "perfect")).toBe(true);
    expect(useFarmStore.getState().silo.parsnip).toBe(8);
    expect(useInventoryStore.getState().countItem("parsnip_soup")).toBe(2);
  });

  it("sloppy → món vẫn ra NHƯNG chỉ mất NỬA nguyên liệu", () => {
    expect(gameActions.cook("ck_parsnip_soup", "sloppy")).toBe(true);
    // parsnip×2 → sloppy mất ceil(2/2)=1 → còn 9
    expect(useFarmStore.getState().silo.parsnip).toBe(9);
    expect(useInventoryStore.getState().countItem("parsnip_soup")).toBe(1);
  });

  it("túi đầy (không còn slot/stack) → false, KHÔNG mất nguyên liệu", () => {
    const full = Array.from({ length: 12 }, (_, i) => ({ itemId: i % 2 ? "wood" : "stone", qty: 999 }));
    useInventoryStore.getState().hydrate(full, 0);
    expect(gameActions.cook("ck_parsnip_soup", "good")).toBe(false);
    expect(useFarmStore.getState().silo.parsnip).toBe(10);
  });
});

describe("tryInteract — bếp + ăn món buff (W2 P4)", () => {
  beforeEach(() => resetAll());

  it("đứng trong nhà mặt hướng bếp (12,4) → mở CookingModal", () => {
    useWorldStore.getState().hydrate({ zone: "house" } as never);
    const setCooking = useUiStore.getState().setShowCooking;
    useUiStore.getState().setShowCooking(false);
    const out = tryInteract({
      facingTile: { x: 12, y: 4 },
      playerTile: { x: 12, y: 5 },
      npcs: [],
      flash: () => undefined,
    });
    expect(out.didSomething).toBe(true);
    expect(useUiStore.getState().showCooking).toBe(true);
    useUiStore.getState().setShowCooking(false);
    void setCooking;
  });

  it("ăn món speed → buff speed active trong gameStore", () => {
    useWorldStore.getState().hydrate({ zone: "farm" } as never);
    useInventoryStore.getState().hydrate(
      [{ itemId: "pancakes", qty: 1 }, ...Array.from({ length: 11 }, () => null)],
      0,
    );
    const energyBefore = useGameStore.getState().energy;
    const out = tryInteract({
      facingTile: { x: 30, y: 30 },
      playerTile: { x: 30, y: 30 },
      npcs: [],
      flash: () => undefined,
    });
    expect(out.didSomething).toBe(true);
    const g = useGameStore.getState();
    expect(activeBuffs(g.buffs, g.day, g.timeMinutes).speed).toBe(true);
    expect(g.energy).toBe(Math.min(270, energyBefore + 85));
    expect(useInventoryStore.getState().countItem("pancakes")).toBe(0);
  });

  it("fix W2: ăn món được CẢ TRONG NHÀ (zone gate trước đây chặn trước nhánh food)", () => {
    useWorldStore.getState().hydrate({ zone: "house" } as never);
    useInventoryStore.getState().hydrate(
      [{ itemId: "parsnip_soup", qty: 1 }, ...Array.from({ length: 11 }, () => null)],
      0,
    );
    const out = tryInteract({
      facingTile: { x: 6, y: 8 },
      playerTile: { x: 6, y: 7 },
      npcs: [],
      flash: () => undefined,
    });
    expect(out.didSomething).toBe(true);
    expect(useInventoryStore.getState().countItem("parsnip_soup")).toBe(0);
    expect(useGameStore.getState().energy).toBeGreaterThan(200);
  });

  it("ăn món xp → buff xp active", () => {
    useWorldStore.getState().hydrate({ zone: "farm" } as never);
    useInventoryStore.getState().hydrate(
      [{ itemId: "fruit_salad", qty: 1 }, ...Array.from({ length: 11 }, () => null)],
      0,
    );
    tryInteract({
      facingTile: { x: 30, y: 30 },
      playerTile: { x: 30, y: 30 },
      npcs: [],
      flash: () => undefined,
    });
    const g = useGameStore.getState();
    expect(activeBuffs(g.buffs, g.day, g.timeMinutes).xp).toBe(true);
  });

  it("ăn cá thường (không phải món nấu) → KHÔNG có buff", () => {
    useWorldStore.getState().hydrate({ zone: "farm" } as never);
    useInventoryStore.getState().hydrate(
      [{ itemId: "sunfish", qty: 1 }, ...Array.from({ length: 11 }, () => null)],
      0,
    );
    tryInteract({
      facingTile: { x: 30, y: 30 },
      playerTile: { x: 30, y: 30 },
      npcs: [],
      flash: () => undefined,
    });
    const g = useGameStore.getState();
    expect(activeBuffs(g.buffs, g.day, g.timeMinutes)).toEqual({ speed: false, xp: false });
  });
});
