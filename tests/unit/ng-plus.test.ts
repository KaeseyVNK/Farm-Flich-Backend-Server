// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  ngPlusReset,
  loadGlobalMeta,
  saveGlobalMeta,
  unlockEnding,
  resolveEnding,
  type KnowledgeState,
} from "../../src/lib/game/story/ng-plus";

describe("New Game+ reset scope (decision #5)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("ngPlusReset: progression về default level 1", () => {
    const knowledge: KnowledgeState = {
      recipesUnlocked: ["iron-tool"],
      wardrobeUnlocks: ["blue-shirt"],
      endingUnlocked: ["redemption"],
    };
    const r = ngPlusReset(knowledge);
    expect(r.progression.level).toBe(1);
    expect(r.progression.xp).toBe(0);
    expect(r.progression.skillPoints).toBe(0);
  });

  it("ngPlusReset: GIỮ knowledge (recipes + wardrobe + ending)", () => {
    const knowledge: KnowledgeState = {
      recipesUnlocked: ["iron-tool"],
      wardrobeUnlocks: ["blue-shirt"],
      endingUnlocked: ["redemption"],
    };
    const r = ngPlusReset(knowledge);
    expect(r.knowledge.recipesUnlocked).toEqual(["iron-tool"]);
    expect(r.knowledge.wardrobeUnlocks).toEqual(["blue-shirt"]);
    expect(r.knowledge.endingUnlocked).toEqual(["redemption"]);
  });

  it("Global Meta-Save: endingUnlocked persist độc lập slot", () => {
    saveGlobalMeta({ recipesUnlocked: [], wardrobeUnlocks: [], endingUnlocked: [] });
    unlockEnding("tyranny");
    const meta = loadGlobalMeta();
    expect(meta.endingUnlocked).toContain("tyranny");
  });

  it("unlockEnding idempotent (không duplicate)", () => {
    unlockEnding("redemption");
    unlockEnding("redemption");
    expect(loadGlobalMeta().endingUnlocked.filter((e) => e === "redemption")).toHaveLength(1);
  });

  it("resolveEnding: mercy>=5 + corruption<=2 → redemption", () => {
    expect(resolveEnding({ mercy: 5, corruption: 1 })).toBe("redemption");
  });

  it("resolveEnding: corruption>=5 → tyranny", () => {
    // redemption requires mercy>=5 AND corruption<=2; corruption=5 → redemption không met → tyranny.
    expect(resolveEnding({ corruption: 5, mercy: 5 })).toBe("tyranny");
    expect(resolveEnding({ corruption: 5, mercy: 1 })).toBe("tyranny");
  });

  it("resolveEnding: selfless>=5 → sacrifice (khi không redemption/tyranny)", () => {
    expect(resolveEnding({ selfless: 5, mercy: 1, corruption: 1 })).toBe("sacrifice");
  });

  it("resolveEnding: không đủ flag → null", () => {
    expect(resolveEnding({})).toBeNull();
  });

  it("loadGlobalMeta: empty khi chưa có", () => {
    const meta = loadGlobalMeta();
    expect(meta.recipesUnlocked).toEqual([]);
    expect(meta.endingUnlocked).toEqual([]);
  });
});
