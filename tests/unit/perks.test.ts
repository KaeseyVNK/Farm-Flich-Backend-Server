import { describe, it, expect } from "vitest";
import { PERKS, perkAt, meetsPrerequisite, type TreeId } from "../../src/lib/game/progression/perks";

describe("Perks config (3 tree × 10 rank)", () => {
  it("3 tree: farming/combat/social", () => {
    expect(Object.keys(PERKS)).toEqual(["farming", "combat", "social"]);
  });

  it("mỗi tree có 10 perk (rank 1-10)", () => {
    for (const tree of Object.keys(PERKS) as TreeId[]) {
      expect(PERKS[tree]).toHaveLength(10);
      const ranks = PERKS[tree].map((p) => p.rank).sort((a, b) => a - b);
      expect(ranks).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    }
  });

  it("mỗi perk có name + desc non-empty + effectHook path", () => {
    for (const tree of Object.keys(PERKS) as TreeId[]) {
      for (const perk of PERKS[tree]) {
        expect(perk.name.length).toBeGreaterThan(0);
        expect(perk.desc.length).toBeGreaterThan(0);
        expect(perk.effectHook).toMatch(/^.+:.+/); // hook path format "<file>:<fn>"
        expect(perk.tree).toBe(tree);
      }
    }
  });

  it("perk id unique across all trees", () => {
    const ids = [...PERKS.farming, ...PERKS.combat, ...PERKS.social].map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("perkAt: tree + rank resolve đúng", () => {
    expect(perkAt("farming", 4)?.id).toBe("farm-4");
    expect(perkAt("combat", 10)?.name).toBe("Death Bringer");
  });

  it("meetsPrerequisite: rank 1 luôn OK; rank N cần N-1 allocated", () => {
    const alloc = { farming: 2, combat: 0, social: 0 };
    expect(meetsPrerequisite(alloc, "farming", 1)).toBe(true);
    expect(meetsPrerequisite(alloc, "farming", 3)).toBe(true); // 2 >= 3-1
    expect(meetsPrerequisite(alloc, "farming", 4)).toBe(false); // 2 < 4-1
  });
});
