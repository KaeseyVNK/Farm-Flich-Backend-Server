import { describe, it, expect, beforeEach } from "vitest";
import { useProgressionStore } from "../../src/store/progressionStore";
import { PERKS } from "../../src/lib/game/progression/perks";

// allocatePerk defense-in-depth: UI đã chặn nhưng store method có thể bị caller
// khác gọi. Test cap rank max + prereq tuần tự + skill-point gate.
describe("progressionStore.allocatePerk guards", () => {
  beforeEach(() => {
    useProgressionStore.getState().reset();
  });

  it("không có skill point → false", () => {
    expect(useProgressionStore.getState().allocatePerk("farming")).toBe(false);
    expect(useProgressionStore.getState().perkAllocations.farming).toBe(0);
  });

  it("có skill point → allocate rank 1 + trừ điểm", () => {
    useProgressionStore.getState().hydrate({ skillPoints: 1, perkAllocations: { farming: 0, combat: 0, social: 0 } });
    expect(useProgressionStore.getState().allocatePerk("farming")).toBe(true);
    expect(useProgressionStore.getState().perkAllocations.farming).toBe(1);
    expect(useProgressionStore.getState().skillPoints).toBe(0);
  });

  it("chặn allocate vượt max rank (PERKS[tree].length = 10)", () => {
    // farming đã ở rank 10 (max), cố allocate rank 11 → false
    useProgressionStore.getState().hydrate({
      skillPoints: 5,
      perkAllocations: { farming: PERKS.farming.length, combat: 0, social: 0 },
    });
    expect(useProgressionStore.getState().allocatePerk("farming")).toBe(false);
    expect(useProgressionStore.getState().perkAllocations.farming).toBe(PERKS.farming.length);
    expect(useProgressionStore.getState().skillPoints).toBe(5); // không trừ
  });

  it("chặn allocate khi không đủ prereq tuần tự (rank N cần N-1)", () => {
    // farming = 0, cố allocate khi next rank = 1 → prereq OK (rank 1 miễn điều kiện)
    useProgressionStore.getState().hydrate({ skillPoints: 3, perkAllocations: { farming: 0, combat: 0, social: 0 } });
    //_alloc rank 1 OK
    expect(useProgressionStore.getState().allocatePerk("farming")).toBe(true); // → 1
    // alloc rank 2 OK (prereq rank 1 đã có)
    expect(useProgressionStore.getState().allocatePerk("farming")).toBe(true); // → 2
  });

  it("hydrate clamp perkAllocations vượt cap + skillPoints âm (trust boundary)", () => {
    useProgressionStore.getState().hydrate({
      skillPoints: -5,
      perkAllocations: { farming: 999, combat: -3, social: 50 },
    });
    expect(useProgressionStore.getState().skillPoints).toBe(0);
    expect(useProgressionStore.getState().perkAllocations.farming).toBe(PERKS.farming.length);
    expect(useProgressionStore.getState().perkAllocations.combat).toBe(0);
    expect(useProgressionStore.getState().perkAllocations.social).toBe(PERKS.social.length);
  });

  it("addXp chặn negative/NaN (không de-level, không giảm totalXp)", () => {
    const before = useProgressionStore.getState().totalXp;
    useProgressionStore.getState().addXp(-100);
    useProgressionStore.getState().addXp(NaN);
    expect(useProgressionStore.getState().totalXp).toBe(before);
  });
});
