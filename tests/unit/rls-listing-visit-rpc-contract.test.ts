import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { VISIT_SAFE_KEYS } from "../../src/lib/social/visit-service";

const MIG = readFileSync(
  join(process.cwd(), "prisma/migrations/20260820094700_rls_listing_visit_rpcs/migration.sql"),
  "utf8",
);

const BANNED = ["shippingBoxes", "gold", "gameMeta", "configSnapshot"];

describe("RLS + listing/visit RPC contract", () => {
  it("policy names exist (owner / participants)", () => {
    for (const name of [
      "inventory_owner",
      "defense_config_owner",
      "mask_owner",
      "user_owner",
      "farm_owner",
      "raid_session_participants",
      "friendship_participants",
    ]) {
      expect(MIG.includes(name)).toBe(true);
    }
  });

  it("ENABLE ROW LEVEL SECURITY without FORCE", () => {
    expect(MIG.includes("ENABLE ROW LEVEL SECURITY")).toBe(true);
    expect(MIG.includes("FORCE ROW LEVEL SECURITY")).toBe(false);
  });

  it("list_raidable_farms returns id, ownerId, shieldUntil, dailyRaidCount, displayName only", () => {
    expect(MIG.includes("CREATE OR REPLACE FUNCTION list_raidable_farms()")).toBe(true);
    const fn = MIG.slice(MIG.indexOf("CREATE OR REPLACE FUNCTION list_raidable_farms()"));
    const head = fn.slice(0, fn.indexOf("LANGUAGE plpgsql"));
    expect(head.includes('"ownerId"')).toBe(true);
    expect(head.includes('"shieldUntil"')).toBe(true);
    expect(head.includes('"dailyRaidCount"')).toBe(true);
    expect(head.includes('"displayName"')).toBe(true);
    for (const k of BANNED) {
      expect(head.includes(k)).toBe(false);
    }
  });

  it("visit_friend_farm JSON keys are VISIT_SAFE_KEYS; banned keys absent", () => {
    expect(MIG.includes("CREATE OR REPLACE FUNCTION visit_friend_farm(p_owner text)")).toBe(true);
    const fn = MIG.slice(MIG.indexOf("visit_friend_farm(p_owner text)"));
    const body = fn.slice(0, fn.indexOf("DROP VIEW IF EXISTS user_public"));
    for (const k of VISIT_SAFE_KEYS) {
      expect(body.includes(`'${k}'`)).toBe(true);
    }
    for (const k of BANNED) {
      expect(body.includes(k)).toBe(false);
    }
  });

  it("user_public view is id + displayName only", () => {
    expect(MIG.includes("CREATE VIEW user_public AS")).toBe(true);
    const view = MIG.slice(MIG.indexOf("CREATE VIEW user_public AS"));
    const sql = view.slice(0, view.indexOf("$v$"));
    expect(sql.includes("u.id")).toBe(true);
    expect(sql.includes('"displayName"')).toBe(true);
    for (const k of BANNED) {
      expect(sql.includes(k)).toBe(false);
    }
  });
});

const SHIELD_FIX = readFileSync(
  join(
    process.cwd(),
    "prisma/migrations/20260820095100_list_raidable_farms_shield_type/migration.sql",
  ),
  "utf8",
);

describe("list_raidable_farms shieldUntil type", () => {
  it("matches Farm.shieldUntil (timestamp without time zone)", () => {
    expect(SHIELD_FIX.includes("DROP FUNCTION IF EXISTS list_raidable_farms()")).toBe(true);
    expect(SHIELD_FIX.includes('"shieldUntil" timestamp')).toBe(true);
    expect(SHIELD_FIX.includes('"shieldUntil" timestamptz')).toBe(false);
  });
});
