import { describe, expect, it, beforeEach } from "vitest";
import { resolveNpcQuests } from "@/lib/game/npc-quests";
import { useInventoryStore } from "@/store/inventoryStore";
import { useNpcStore } from "@/store/npcStore";
import { useQuestStore } from "@/store/questStore";
import { useWorldStore } from "@/store/worldStore";
import { useGameStore } from "@/store/gameStore";

describe("npc quest turn-ins", () => {
  beforeEach(() => {
    useQuestStore.getState().reset();
    useNpcStore.getState().reset();
    useWorldStore.getState().reset();
    useInventoryStore.getState().hydrate(Array(12).fill(null), 0);
    useGameStore.getState().hydrate({ day: 7, gold: 500 } as never);
  });

  it("meeting Alaric and Gaston completes q_meet_village", () => {
    useNpcStore.getState().talk("alaric");
    useNpcStore.getState().talk("gaston");
    resolveNpcQuests("gaston");
    expect(useQuestStore.getState().isCompleted("q_meet_village")).toBe(true);
  });

  it("Alaric takes ore and repairs the well", () => {
    useInventoryStore.getState().addItem("copper_ore", 1);
    resolveNpcQuests("alaric");
    expect(useWorldStore.getState().wellRepaired).toBe(true);
    expect(useQuestStore.getState().isCompleted("q_ore_for_alaric")).toBe(true);
    expect(useInventoryStore.getState().countItem("copper_ore")).toBe(0);
  });

  it("Gaston takes the festival basket on day 7", () => {
    useInventoryStore.getState().addItem("parsnip", 1);
    useInventoryStore.getState().addItem("egg", 1);
    useInventoryStore.getState().addItem("milk", 1);
    resolveNpcQuests("gaston");
    expect(useQuestStore.getState().isCompleted("q_festival_basket")).toBe(true);
    expect(useInventoryStore.getState().countItem("parsnip")).toBe(0);
    expect(useInventoryStore.getState().countItem("egg")).toBe(0);
    expect(useInventoryStore.getState().countItem("milk")).toBe(0);
  });
});
