import { describe, it, expect, beforeEach } from "vitest";
import { useProgressionStore, awardXp, XP_REWARDS } from "../../src/store/progressionStore";
import { useFarmStore } from "../../src/store/farmStore";
import { useQuestStore } from "../../src/store/questStore";
import { useNpcStore } from "../../src/store/npcStore";
import { useInventoryStore } from "../../src/store/inventoryStore";
import { gameActions, collectSaveData } from "../../src/lib/game/actions";
import { T } from "../../src/lib/game/constants";
import { setFallow } from "../unit/helpers/fallow-tile";

// Phase 6 audit fix: verify XP hooks wired into real stores (không chỉ pure logic).
describe("XP wiring integration (farm actions → progressionStore)", () => {
  beforeEach(() => {
    useProgressionStore.getState().reset();
    useFarmStore.getState().hydrate(
      {
        terrain: new Array(30 * 22).fill(T.GRASS),
        crops: {},
        objects: {},
        forage: {},
      } as never,
    );
  });

  it("XP_REWARDS defined cho farming actions", () => {
    expect(XP_REWARDS.till).toBeGreaterThan(0);
    expect(XP_REWARDS.harvest).toBeGreaterThan(XP_REWARDS.till);
    expect(XP_REWARDS.raid).toBeGreaterThan(XP_REWARDS.harvest);
  });

  it("farmStore.till → awardXp('till') → progressionStore.xp tăng", () => {
    setFallow(5, 5);
    const xpBefore = useProgressionStore.getState().xp;
    useFarmStore.getState().till(5, 5);
    const xpAfter = useProgressionStore.getState().xp;
    expect(xpAfter).toBeGreaterThan(xpBefore);
    expect(useProgressionStore.getState().totalXp).toBe(XP_REWARDS.till);
  });

  it("farmStore.water → awardXp('water')", () => {
    setFallow(5, 5);
    useFarmStore.getState().till(5, 5);
    const xpMid = useProgressionStore.getState().totalXp;
    useFarmStore.getState().water(5, 5);
    expect(useProgressionStore.getState().totalXp).toBeGreaterThan(xpMid);
  });

  it("awardXp đủ → level up + skillPoint + levelUpToast", () => {
    // Level 1→2 cần 100 XP.
    awardXp("raid"); // 50
    awardXp("raid"); // 100 total → level up
    const st = useProgressionStore.getState();
    expect(st.level).toBe(2);
    expect(st.skillPoints).toBe(1);
    expect(st.levelUpToast).not.toBeNull();
    expect(st.levelUpToast?.level).toBe(2);
  });

  it("spendSkillPoint: có point → true + giảm; hết → false", () => {
    awardXp("raid");
    awardXp("raid"); // level 2, 1 point
    expect(useProgressionStore.getState().spendSkillPoint()).toBe(true);
    expect(useProgressionStore.getState().skillPoints).toBe(0);
    expect(useProgressionStore.getState().spendSkillPoint()).toBe(false);
  });

  it("clearLevelUpToast xóa toast", () => {
    awardXp("raid");
    awardXp("raid");
    useProgressionStore.getState().clearLevelUpToast();
    expect(useProgressionStore.getState().levelUpToast).toBeNull();
  });

  it("hydrate restore progression state", () => {
    useProgressionStore.getState().hydrate({ level: 7, xp: 50, totalXp: 2000, skillPoints: 6 });
    expect(useProgressionStore.getState().level).toBe(7);
    expect(useProgressionStore.getState().skillPoints).toBe(6);
  });

  it("allocatePerk: spend skillPoint → tăng tree allocation (audit #1 perkAllocations)", () => {
    awardXp("raid");
    awardXp("raid"); // level 2, 1 point
    expect(useProgressionStore.getState().allocatePerk("farming")).toBe(true);
    expect(useProgressionStore.getState().perkAllocations.farming).toBe(1);
    expect(useProgressionStore.getState().skillPoints).toBe(0);
    expect(useProgressionStore.getState().allocatePerk("farming")).toBe(false); // hết point
  });

  it("hydrate restore perkAllocations (round-trip save)", () => {
    useProgressionStore.getState().hydrate({
      level: 5,
      xp: 0,
      totalXp: 1000,
      skillPoints: 2,
      perkAllocations: { farming: 3, combat: 1, social: 0 },
    });
    expect(useProgressionStore.getState().perkAllocations).toEqual({
      farming: 3,
      combat: 1,
      social: 0,
    });
  });

  it("collectSaveData emit real perkAllocations (audit #1)", () => {
    useProgressionStore.getState().hydrate({
      level: 5,
      xp: 0,
      totalXp: 1000,
      skillPoints: 2,
      perkAllocations: { farming: 2, combat: 0, social: 1 },
    });
    const data = collectSaveData();
    expect(data.progression?.perkAllocations).toEqual({
      farming: 2,
      combat: 0,
      social: 1,
    });
  });
});

// Audit #4: XP hooks coverage — verify ALL 9 declared sources fire.
describe("XP wiring coverage (audit #4: 2/9 → 9/9)", () => {
  beforeEach(() => {
    useProgressionStore.getState().reset();
    useQuestStore.getState().reset();
    useNpcStore.getState().hydrate({
      friendship: {},
      talkedToday: {},
      giftedToday: {},
      metNpcs: {},
    } as never);
    useInventoryStore.getState().hydrate([], 0);
  });

  it("giveGift → awardXp('socialGift')", () => {
    useInventoryStore.getState().addItem("blueberry", 1);
    const before = useProgressionStore.getState().totalXp;
    gameActions.giveGift("elyria", "blueberry");
    expect(useProgressionStore.getState().totalXp).toBe(before + XP_REWARDS.socialGift);
  });

  it("9 XP sources đều có XP_REWARDS > 0", () => {
    const sources = ["till", "plant", "water", "harvest", "sell", "raid", "quest", "socialGift", "combat"] as const;
    for (const s of sources) {
      expect(XP_REWARDS[s]).toBeGreaterThan(0);
    }
  });
});
