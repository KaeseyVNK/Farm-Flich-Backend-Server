import { describe, it, expect, beforeEach } from "vitest";
import { useFarmStore } from "../../src/store/farmStore";
import { useInventoryStore } from "../../src/store/inventoryStore";
import { useGameStore } from "../../src/store/gameStore";
import { useQuestStore } from "../../src/store/questStore";
import { useProgressionStore } from "../../src/store/progressionStore";
import { useNpcStore } from "../../src/store/npcStore";
import { useRaidStore } from "../../src/store/raidStore";
import { useUiStore } from "../../src/store/uiStore";
import { useWorldStore } from "../../src/store/worldStore";
import { initialiseFreshFarm } from "../../src/lib/game/new-farm-state";
import { DAY_START_HOUR } from "../../src/lib/game/constants";

function run(path: "reset" | "ngPlus"): void {
  initialiseFreshFarm({ mode: path });
}

function snapshot() {
  return {
    game: {
      day: useGameStore.getState().day,
      season: useGameStore.getState().season,
      seasonIndex: useGameStore.getState().seasonIndex,
      year: useGameStore.getState().year,
      timeMinutes: useGameStore.getState().timeMinutes,
      gold: useGameStore.getState().gold,
      energy: useGameStore.getState().energy,
      maxEnergy: useGameStore.getState().maxEnergy,
      collapsed: useGameStore.getState().collapsed,
      totalEarned: useGameStore.getState().totalEarned,
      toolsUsed: useGameStore.getState().toolsUsed,
    },
    inv: useInventoryStore.getState().slots.map((s) => (s ? `${s.itemId}:${s.qty}` : null)),
    selected: useInventoryStore.getState().selectedSlot,
    quests: useQuestStore.getState().daysPlayed,
    progression: {
      level: useProgressionStore.getState().level,
      xp: useProgressionStore.getState().xp,
      skillPoints: useProgressionStore.getState().skillPoints,
    },
    npc: {
      friendship: Object.keys(useNpcStore.getState().friendship).length,
      met: Object.keys(useNpcStore.getState().metNpcs).length,
    },
    waterCharges: useWorldStore.getState().waterCharges,
    wellRepaired: useWorldStore.getState().wellRepaired,
  };
}

describe("fresh-farm reset baseline (characterization — before seam extraction)", () => {
  beforeEach(() => {
    useGameStore.getState().hydrate({
      day: 99, season: "Winter", seasonIndex: 3, year: 7, timeMinutes: 23 * 60,
      gold: 99999, energy: 3, collapsed: true, totalEarned: 999, toolsUsed: 999,
    } as never);
    useInventoryStore.getState().hydrate(
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => ({ itemId: "dirt", qty: i + 1 })),
      5,
    );
    useFarmStore.getState().hydrate({
      terrain: [99], crops: { 0: { cropId: "parsnip", stage: 3, dead: false } },
      objects: { 0: {} }, forage: {}, shippingBoxes: {},
    } as never);
    useQuestStore.getState().reset();
    useQuestStore.getState().hydrate({ daysPlayed: 77 });
    useProgressionStore.getState().hydrate({ level: 9, xp: 500, skillPoints: 4 });
    useNpcStore.getState().hydrate({ friendship: { notreal: 5 }, metNpcs: { notreal: true } });
    useRaidStore.getState().reset?.();
    useUiStore.getState().setShowShop(false);
  });

  it.each(["reset", "ngPlus"] as const)(
    "%s → exact identical baseline (fresh-farm contract)",
    (path) => {
      run(path);
      const snap = snapshot();
      expect(snap.game).toEqual({
        day: 1, season: "Spring", seasonIndex: 0, year: 1, timeMinutes: DAY_START_HOUR * 60,
        gold: 500, maxEnergy: expect.any(Number), energy: snap.game.maxEnergy,
        collapsed: false, totalEarned: 0, toolsUsed: 0,
      });
      expect(snap.inv).toEqual([
        "hoe:1", "watering_can:1", "axe:1", "pickaxe:1", "scythe:1",
        "parsnip_seed:9", "fishing_rod:1", null, null, null, null, null, // rod W1P3
      ]);
      expect(snap.inv).not.toContain("wheat:10");
      expect(snap.selected).toBe(0);
      expect(snap.quests).toBe(1);
      expect(snap.progression).toEqual({ level: 1, xp: 0, skillPoints: 0 });
      expect(snap.npc.friendship).toBeGreaterThan(0);
      expect(snap.npc.met).toBe(0);
      expect(snap.waterCharges).toBe(40);
      expect(snap.wellRepaired).toBe(false);
    },
  );

  it("reset + load existing save afterwards still works (seam không phá applySaveData)", () => {
    run("reset");
    useGameStore.getState().hydrate({ gold: 1200, day: 8, timeMinutes: 15 * 60 } as never);
    useProgressionStore.getState().hydrate({ level: 4, xp: 200, skillPoints: 1 });
    expect(useGameStore.getState().gold).toBe(1200);
    expect(useGameStore.getState().day).toBe(8);
    expect(useProgressionStore.getState().level).toBe(4);
  });
});
