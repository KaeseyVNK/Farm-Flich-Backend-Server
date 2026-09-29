import { describe, it, expect } from "vitest";
import { siloCapacity, siloUsed, canAdd } from "@/lib/game/silo";

// Phase 5 stretch: silo thật — cap theo level 20/40/60/80 (contract).
describe("silo", () => {
  it("capacity theo level: 1→20, 2→40, 3→60, 4→80, 5+→80", () => {
    expect(siloCapacity(1)).toBe(20);
    expect(siloCapacity(2)).toBe(40);
    expect(siloCapacity(3)).toBe(60);
    expect(siloCapacity(4)).toBe(80);
    expect(siloCapacity(5)).toBe(80);
  });

  it("siloUsed tổng các item", () => {
    expect(siloUsed({})).toBe(0);
    expect(siloUsed({ parsnip: 5, potato: 3 })).toBe(8);
  });

  it("lv1: ô thứ 20 vừa, ô thứ 21 false", () => {
    const silo = { parsnip: 19 };
    expect(canAdd(silo, 1, 1)).toBe(true);
    expect(canAdd(silo, 2, 1)).toBe(false);
    const full = { parsnip: 20 };
    expect(canAdd(full, 1, 1)).toBe(false);
  });

  it("cap theo level: 20 ở lv1 nhưng 40 ở lv2", () => {
    const silo = { parsnip: 25 };
    expect(canAdd(silo, 5, 1)).toBe(false);
    expect(canAdd(silo, 5, 2)).toBe(true);
  });
});
