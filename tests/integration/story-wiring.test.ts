import { describe, it, expect, beforeEach } from "vitest";
import { useQuestStore } from "../../src/store/questStore";
import { useProgressionStore } from "../../src/store/progressionStore";
import { useGameStore } from "../../src/store/gameStore";
import { useNpcStore } from "../../src/store/npcStore";
import { useInventoryStore } from "../../src/store/inventoryStore";
import { collectSaveData } from "../../src/lib/game/actions";

// W9P3: story 5-chapter RETIRED, save KHÔNG emit story block.
// W9 audit-fix: storyStore + chapters + dialogue-runner + ChapterToast đã XÓA —
// test này giữ 2 guarantee còn giá trị: (1) save không emit story, (2) quest
// claim không phụ thuộc chapter (api cũ từng wire checkChapterAdvance).
describe("Story retired (W9P3 — dead-code đã dọn)", () => {
  beforeEach(() => {
    useQuestStore.getState().reset();
    useProgressionStore.getState().reset();
    useNpcStore.getState().hydrate({});
    useGameStore.getState().hydrate({
      day: 1,
      season: "Spring",
      seasonIndex: 0,
      year: 1,
      timeMinutes: 6 * 60,
      gold: 500,
      energy: useGameStore.getState().maxEnergy,
      collapsed: false,
      totalEarned: 0,
      toolsUsed: 0,
    });
  });

  it("collectSaveData KHÔNG emit story block (retired)", () => {
    const data = collectSaveData();
    expect((data as { story?: unknown }).story).toBeUndefined();
  });

  it("quest claim vẫn hoạt động bình thường (không phụ thuộc chapter)", () => {
    useInventoryStore.getState().hydrate([{ itemId: "egg", qty: 1 }, ...Array(11).fill(null)], 0);
    const ok = useQuestStore.getState().claim("q_collect_egg");
    expect(ok).toBe(true);
    expect(useQuestStore.getState().isCompleted("q_collect_egg")).toBe(true);
  });
});
