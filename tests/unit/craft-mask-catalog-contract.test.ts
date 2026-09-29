import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const MIG = readFileSync(
  join(
    process.cwd(),
    "prisma/migrations/20260820094800_mask_recipe_seed_craft_catalog/migration.sql",
  ),
  "utf8",
);

describe("craft_mask catalog contract", () => {
  it("reads MaskRecipe and ignores client price fields", () => {
    expect(MIG.includes('FROM "MaskRecipe"')).toBe(true);
    expect(MIG.includes("v_gold < v_cost")).toBe(true);
    expect(MIG.includes("v_gold < p_gold_cost")).toBe(false);
  });

  it("tier 2 requires thief >= 50 inside RPC", () => {
    expect(MIG.includes("thief >= 50") || MIG.includes("v_thief, 0) < 50")).toBe(true);
    expect(MIG.includes("v_tier >= 2")).toBe(true);
  });

  it("seeds 8 catalog rows", () => {
    for (const id of ["rogue", "phantom", "bandit", "scout", "rogue2", "phantom2", "bandit2", "scout2"]) {
      expect(MIG.includes(`'${id}', '${id}'`)).toBe(true);
    }
  });

  it("keeps <> auth guard (client-only RPC)", () => {
    expect(MIG.includes("auth.uid()::text <> p_user")).toBe(true);
  });
});
