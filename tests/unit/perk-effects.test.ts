import { describe, it, expect, beforeEach } from "vitest";
import { useProgressionStore } from "../../src/store/progressionStore";
import {
  perkLevel,
  hasPerk,
  currentPerk,
  energyCostWithPerks,
  doubleHarvestChance,
  seedSaverChance,
  friendshipGainMultiplier,
  questXpMultiplier,
  damageMultiplier,
  trapSlotBonus,
  raidCapBonus,
  sellPriceMultiplier,
} from "../../src/lib/game/progression/perk-effects";

// Audit: perk-effects.ts (phase 6 progression) chưa có unit test.
// Perk modifier gate gameplay — sai rank → exploit (double harvest không có perk,
// energy không giảm đúng %, giá bán không cộng). Test đầy đủ từng modifier.

const setPerk = (tree: "farming" | "combat" | "social", level: number) => {
  // hydrate đặt thẳng perkAllocations + skillPoints (allocatePerk yêu cầu skill point)
  useProgressionStore.getState().hydrate({
    perkAllocations: { farming: 0, combat: 0, social: 0 },
    skillPoints: level,
  });
  for (let i = 0; i < level; i++) {
    const ok = useProgressionStore.getState().allocatePerk(tree);
    if (!ok) throw new Error(`allocatePerk(${tree}) fail ở level ${i}`);
  }
};

describe("perk-effects", () => {
  beforeEach(() => {
    useProgressionStore.getState().reset();
  });

  describe("perkLevel / hasPerk / currentPerk", () => {
    it("level 0 mặc định → không có perk nào", () => {
      expect(perkLevel("farming")).toBe(0);
      expect(hasPerk("farming", 1)).toBe(false);
      expect(currentPerk("farming")).toBeNull();
    });

    it("allocate đúng level → hasPerk theo rank", () => {
      setPerk("farming", 4);
      expect(perkLevel("farming")).toBe(4);
      expect(hasPerk("farming", 1)).toBe(true);
      expect(hasPerk("farming", 4)).toBe(true);
      expect(hasPerk("farming", 5)).toBe(false);
    });

    it("currentPerk trả rank + perk kế tiếp", () => {
      setPerk("farming", 2);
      const cur = currentPerk("farming");
      expect(cur?.rank).toBe(2);
      expect(cur?.next?.rank).toBe(3); // Auto-Water
      expect(cur?.next?.name).toBe("Auto-Water");
    });

    it("currentPerk level max → next undefined", () => {
      setPerk("farming", 10);
      expect(currentPerk("farming")?.rank).toBe(10);
      expect(currentPerk("farming")?.next).toBeUndefined();
    });
  });

  describe("modifiers", () => {
    it("energyCostWithPerks: không perk → base, có Sturdy Tools (rank 2) → floor *0.85 (giảm thật)", () => {
      expect(energyCostWithPerks(2)).toBe(2); // chưa có perk
      setPerk("farming", 2);
      // FLOOR (không round): round(1.7)=2 = NO-OP trên hoe/water (tool dùng nhiều
      // nhất). floor(1.7)=1 → perk "Giảm 15%" có hiệu lực thật.
      expect(energyCostWithPerks(2)).toBe(1); // 2*0.85=1.7 → floor 1
      expect(energyCostWithPerks(4)).toBe(3); // 4*0.85=3.4 → floor 3
      // không bao giờ về 0 (cost 1 → floor(0.85)=0 → clamp 1)
      expect(energyCostWithPerks(1)).toBe(1);
    });

    it("doubleHarvestChance: chỉ khi có rank 4", () => {
      expect(doubleHarvestChance()).toBe(0);
      setPerk("farming", 3);
      expect(doubleHarvestChance()).toBe(0);
      setPerk("farming", 4);
      expect(doubleHarvestChance()).toBe(0.2);
    });

    it("seedSaverChance: chỉ khi có rank 6", () => {
      expect(seedSaverChance()).toBe(0);
      setPerk("farming", 5);
      expect(seedSaverChance()).toBe(0);
      setPerk("farming", 6);
      expect(seedSaverChance()).toBe(0.25);
    });

    it("friendshipGainMultiplier: +10% khi có Friendly Smile (social 1)", () => {
      expect(friendshipGainMultiplier()).toBe(1);
      setPerk("social", 1);
      expect(friendshipGainMultiplier()).toBeCloseTo(1.1);
    });

    it("questXpMultiplier: +25% khi có Quest XP+ (social 4)", () => {
      expect(questXpMultiplier()).toBe(1);
      setPerk("social", 3);
      expect(questXpMultiplier()).toBe(1);
      setPerk("social", 4);
      expect(questXpMultiplier()).toBeCloseTo(1.25);
    });

    it("damageMultiplier: +10% khi có Sharp Blade (combat 1)", () => {
      expect(damageMultiplier()).toBe(1);
      setPerk("combat", 1);
      expect(damageMultiplier()).toBeCloseTo(1.1);
    });

    it("trapSlotBonus: +1 khi có Extra Trap Slot (combat 3)", () => {
      expect(trapSlotBonus()).toBe(0);
      setPerk("combat", 2);
      expect(trapSlotBonus()).toBe(0);
      setPerk("combat", 3);
      expect(trapSlotBonus()).toBe(1);
    });

    it("raidCapBonus: +1 khi có Raid Cap +1 (combat 4)", () => {
      expect(raidCapBonus()).toBe(0);
      setPerk("combat", 4);
      expect(raidCapBonus()).toBe(1);
    });

    it("sellPriceMultiplier: Golden Yield (farming 9) +30%, Silver Tongue (social 5) +15%, cộng dồn", () => {
      expect(sellPriceMultiplier()).toBe(1);
      setPerk("farming", 9);
      expect(sellPriceMultiplier()).toBeCloseTo(1.3);
      useProgressionStore.getState().reset();
      setPerk("social", 5);
      expect(sellPriceMultiplier()).toBeCloseTo(1.15);
      // cả hai
      useProgressionStore.getState().reset();
      setPerk("farming", 9);
      useProgressionStore.getState().hydrate({ perkAllocations: { farming: 9, combat: 0, social: 0 }, skillPoints: 5 });
      for (let i = 0; i < 5; i++) useProgressionStore.getState().allocatePerk("social");
      expect(sellPriceMultiplier()).toBeCloseTo(1.45);
    });
  });
});
