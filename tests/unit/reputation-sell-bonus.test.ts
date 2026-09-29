import { describe, it, expect, afterEach } from "vitest";
import { sellPriceMultiplier } from "@/lib/game/progression/perk-effects";
import { useReputationStore } from "@/store/reputationStore";
import { useProgressionStore } from "@/store/progressionStore";
import { REPUTATION_EFFECTS } from "@/lib/raid/constants";

/**
 * W7d-P1: farmer rep ≥ 50 → +5% giá bán (§14). sellPriceMultiplier đọc
 * reputationStore (cache server) — dưới ngưỡng hoặc chưa hydrate = không bonus.
 */

describe("sellPriceMultiplier × farmer reputation", () => {
  afterEach(() => {
    useReputationStore.getState().reset();
    useProgressionStore.setState({ perkAllocations: { farming: 0, combat: 0, social: 0 } });
  });

  it("farmer < 50 → không bonus (×1 với 0 perk)", () => {
    useReputationStore.getState().setAll({ farmer: 49, thief: 0, guard: 0 });
    expect(sellPriceMultiplier()).toBe(1);
  });

  it("farmer = 50 → +5%", () => {
    useReputationStore.getState().setAll({ farmer: REPUTATION_EFFECTS.FARMER_SELL_AT, thief: 0, guard: 0 });
    expect(sellPriceMultiplier()).toBeCloseTo(1.05, 10);
  });

  it("chưa hydrate (0) → không bonus", () => {
    expect(sellPriceMultiplier()).toBe(1);
  });

  it("cộng dồn với perk (farming 9 +30%)", () => {
    useReputationStore.getState().setAll({ farmer: 60, thief: 0, guard: 0 });
    useProgressionStore.setState({ perkAllocations: { farming: 9, combat: 0, social: 0 } });
    expect(sellPriceMultiplier()).toBeCloseTo(1.35, 10);
  });

  it("thief/guard cao KHÔNG ảnh hưởng giá bán", () => {
    useReputationStore.getState().setAll({ farmer: 0, thief: 100, guard: 100 });
    expect(sellPriceMultiplier()).toBe(1);
  });
});

describe("reputationStore", () => {
  afterEach(() => useReputationStore.getState().reset());

  it("setAll đánh dấu hydrated; reset về 0 + chưa hydrate", () => {
    expect(useReputationStore.getState().hydrated).toBe(false);
    useReputationStore.getState().setAll({ farmer: 1, thief: 2, guard: 3 });
    const s = useReputationStore.getState();
    expect(s.farmer).toBe(1);
    expect(s.thief).toBe(2);
    expect(s.guard).toBe(3);
    expect(s.hydrated).toBe(true);
    useReputationStore.getState().reset();
    expect(useReputationStore.getState().hydrated).toBe(false);
    expect(useReputationStore.getState().farmer).toBe(0);
  });
});
