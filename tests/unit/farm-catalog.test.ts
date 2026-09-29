import { describe, it, expect } from "vitest";
import {
  plotCount,
  plotUnlockLevel,
  isPlotUnlocked,
  seedUnlockLevel,
} from "../../src/lib/game/farm-catalog";
import { XP_REWARDS } from "../../src/store/progressionStore";

// Phase 2 hayday: catalog unlock — bảng khóa trong implementation-handoff-contract.
// Pure module: không import Phaser/store (chỉ đọc FARM_PLOTS tĩnh).
describe("farm-catalog", () => {
  it("plotCount theo bảng unlock (6/9/12/16)", () => {
    expect(plotCount(1)).toBe(6);
    expect(plotCount(2)).toBe(9);
    expect(plotCount(3)).toBe(12);
    expect(plotCount(4)).toBe(16);
  });

  it("isPlotUnlocked theo unlockLevel của ô", () => {
    expect(isPlotUnlocked(7, 28, 1)).toBe(true); // lv1
    expect(isPlotUnlocked(9, 28, 1)).toBe(false); // lv3 slot
    expect(isPlotUnlocked(9, 28, 3)).toBe(true);
  });

  it("plotUnlockLevel: null ngoài lưới FARM_PLOTS", () => {
    expect(plotUnlockLevel(7, 28)).toBe(1);
    expect(plotUnlockLevel(9, 31)).toBe(4);
    expect(plotUnlockLevel(5, 5)).toBeNull();
  });

  it("seedUnlockLevel theo bảng (parsnip 1, potato 2, wheat 3, cauli 5)", () => {
    expect(seedUnlockLevel("parsnip_seed")).toBe(1);
    expect(seedUnlockLevel("potato_seed")).toBe(2);
    expect(seedUnlockLevel("wheat")).toBe(3);
    expect(seedUnlockLevel("cauliflower_seed")).toBe(5);
    expect(seedUnlockLevel("unknown_item")).toBe(99);
  });

  it("6 chu kỳ parsnip ≥ xpToNext(1)=100", () => {
    // 6 * (till 2 + plant 3 + water 1 + harvest 10 + sell 3) = 114 >= 100
    const cycle =
      XP_REWARDS.till + XP_REWARDS.plant + XP_REWARDS.water + XP_REWARDS.harvest + XP_REWARDS.sell;
    expect(6 * cycle).toBeGreaterThanOrEqual(100);
  });
});
