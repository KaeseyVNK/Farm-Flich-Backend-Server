import { describe, it, expect, beforeEach } from "vitest";
import {
  pushModifier,
  popModifiersBySource,
  computeStats,
  clearModifiers,
  recomputeOnEquip,
  activeModifiers,
} from "../../src/lib/game/progression/stat-model";

describe("StatModel + modifier layer", () => {
  beforeEach(() => clearModifiers());

  it("computeStats: base không có mod = chính base", () => {
    expect(computeStats({ damage: 10, speed: 5 })).toEqual({ damage: 10, speed: 5 });
  });

  it("add modifier: cộng vào stat", () => {
    pushModifier({ stat: "damage", op: "add", value: 5, source: "perk-1" });
    expect(computeStats({ damage: 10 }).damage).toBe(15);
  });

  it("mul modifier: nhân (1+value) vào stat", () => {
    pushModifier({ stat: "damage", op: "mul", value: 0.5, source: "perk-2" }); // +50%
    expect(computeStats({ damage: 10 }).damage).toBe(15);
  });

  it("add trước, mul sau (order quan trọng)", () => {
    pushModifier({ stat: "damage", op: "add", value: 10, source: "a" }); // 10+10=20
    pushModifier({ stat: "damage", op: "mul", value: 0.5, source: "b" }); // 20*1.5=30
    expect(computeStats({ damage: 10 }).damage).toBe(30);
  });

  it("popModifiersBySource: xóa mod theo source (gear unequip)", () => {
    pushModifier({ stat: "damage", op: "add", value: 5, source: "sword" });
    pushModifier({ stat: "speed", op: "add", value: 3, source: "boots" });
    popModifiersBySource("sword");
    expect(computeStats({ damage: 10, speed: 5 })).toEqual({ damage: 10, speed: 8 });
  });

  it("recomputeOnEquip: pop old + push new", () => {
    pushModifier({ stat: "damage", op: "add", value: 5, source: "sword" });
    recomputeOnEquip("sword", [{ stat: "damage", op: "add", value: 15, source: "sword" }]);
    expect(computeStats({ damage: 10 }).damage).toBe(25);
  });

  it("multiple mods cùng stat cộng dồn", () => {
    pushModifier({ stat: "damage", op: "add", value: 5, source: "a" });
    pushModifier({ stat: "damage", op: "add", value: 3, source: "b" });
    expect(computeStats({ damage: 10 }).damage).toBe(18);
  });

  it("activeModifiers inspect", () => {
    pushModifier({ stat: "damage", op: "add", value: 5, source: "a" });
    expect(activeModifiers()).toHaveLength(1);
  });
});
