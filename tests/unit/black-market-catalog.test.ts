import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BLACK_MARKET_MASKS, MASK_CATALOG, findRecipe } from "@/lib/game/mask-catalog";
import { getItem } from "@/lib/game/data";
import { REPUTATION_EFFECTS } from "@/lib/raid/constants";

/**
 * W7d-P2: chợ đen — catalog tier 2 + tools. Server MASK_EFFECTS sync-check
 * qua đọc file (mini-services ngoài tsconfig root — pattern puzzle-circuit).
 */

function serverMaskEffectsSrc(): string {
  return readFileSync(
    join(process.cwd(), "mini-services/raid-server/src/mask-effects.ts"),
    "utf8",
  );
}

describe("BLACK_MARKET_MASKS", () => {
  it("4 mask tier 2, durability 20, không trùng tier 1", () => {
    expect(BLACK_MARKET_MASKS).toHaveLength(4);
    for (const m of BLACK_MARKET_MASKS) {
      expect(m.tier).toBe(2);
      expect(m.durabilityCap).toBe(20);
      expect(m.blackMarket).toBe(true);
      expect(MASK_CATALOG.find((t1) => t1.maskId === m.maskId)).toBeUndefined();
    }
  });

  it("findRecipe tìm cả tier 2 (server action mua dùng)", () => {
    expect(findRecipe("rogue2")?.tier).toBe(2);
    expect(findRecipe("phantom2")?.durabilityCap).toBe(20);
    expect(findRecipe("nope2")).toBeUndefined();
  });

  it("server mask-effects có đủ 4 id tier 2 (sync — chống drift)", () => {
    const src = serverMaskEffectsSrc();
    for (const id of ["rogue2", "phantom2", "bandit2", "scout2"]) {
      expect(src.includes(`${id}: {`)).toBe(true);
    }
  });

  it("giá tier 2 > tier 1 cùng dòng (chợ đen đắt hơn craft)", () => {
    const t1 = new Map(MASK_CATALOG.map((m) => [m.maskId.replace(/\d$/, "") as string, m.goldCost]));
    for (const m of BLACK_MARKET_MASKS) {
      const base = t1.get(m.maskId.replace(/2$/, ""));
      expect(base).toBeDefined();
      expect(m.goldCost).toBeGreaterThan(base ?? Infinity);
    }
  });
});

describe("black market tools", () => {
  it("3 tool có trong ITEMS với mô tả dùng được", () => {
    for (const id of ["tool_lockpick", "tool_smoke", "tool_toy"]) {
      const def = getItem(id);
      expect(def, id).toBeDefined();
      expect(def?.type).toBe("tool");
      expect((def?.description ?? "").length).toBeGreaterThan(5);
    }
  });

  it("thief gate = 50 (REPUTATION_EFFECTS sync server GUARD/THIEF const)", () => {
    expect(REPUTATION_EFFECTS.THIEF_MASK_TIER2_AT).toBe(50);
    expect(REPUTATION_EFFECTS.FARMER_SELL_AT).toBe(50);
    expect(REPUTATION_EFFECTS.GUARD_VISION_AT).toBe(50);
  });
});
