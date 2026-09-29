import { beforeEach, describe, expect, it } from "vitest";
import { NPCS } from "@/lib/game/data";
import { activeWeekQuest, activeFarmGoal, dialogueLineIndex } from "@/lib/game/week-quest";
import { useGameStore } from "@/store/gameStore";
import { useInventoryStore } from "@/store/inventoryStore";
import { useQuestStore } from "@/store/questStore";
import { useWorldStore } from "@/store/worldStore";

describe("activeWeekQuest", () => {
  it("points at the first incomplete Tide Festival quest", () => {
    expect(activeWeekQuest({})?.id).toBe("q_first_harvest");
    expect(activeWeekQuest({ q_first_harvest: true })?.id).toBe("q_meet_village");
    expect(
      activeWeekQuest({
        q_first_harvest: true,
        q_meet_village: true,
        q_collect_egg: true,
        q_ore_for_alaric: true,
        q_festival_basket: true,
      }),
    ).toBeNull();
  });

  it("activeFarmGoal là farm goal — không trả quest id festival", () => {
    // HUD pin phase 3 không dùng activeWeekQuest/Tide Festival.
    const goal = activeFarmGoal({
      terrain: new Array(60 * 60).fill(0),
      crops: {},
      invCropTotal: 0,
      level: 1,
    });
    expect(["hoe", "plant", "water", "harvest", "sell", "unlock2", "unlock3", "unlock4"]).toContain(
      goal,
    );
    expect(String(goal).startsWith("q_")).toBe(false);
  });
});

describe("dialogueLineIndex", () => {
  beforeEach(() => {
    useQuestStore.getState().reset();
    useWorldStore.getState().reset();
    useInventoryStore.getState().hydrate(Array(12).fill(null), 0);
    useGameStore.getState().hydrate({ day: 1, gold: 0 } as never);
  });

  it("Gaston sends a new farmer to the seed shop, not the day-7 festival", () => {
    const idx = dialogueLineIndex("gaston");
    expect(NPCS.gaston.dialogue[idx]).toMatch(/hạt|seed|cửa hàng/i);
  });

  it("Alaric talks about the dry well until it is repaired", () => {
    const idx = dialogueLineIndex("alaric");
    expect(NPCS.alaric.dialogue[idx]).toMatch(/giếng|quặng/i);
    useWorldStore.getState().repairWell();
    const after = dialogueLineIndex("alaric");
    expect(NPCS.alaric.dialogue[after]).toMatch(/sửa xong|ao/i);
  });

  it("Gaston mentions chickens after the first harvest is claimed", () => {
    useQuestStore.setState({ completed: { q_first_harvest: true } });
    const idx = dialogueLineIndex("gaston");
    expect(NPCS.gaston.dialogue[idx]).toMatch(/gà|trứng/i);
  });
});
