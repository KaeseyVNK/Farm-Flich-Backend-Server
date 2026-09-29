import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Review W7 #1 (test-gap): CREATE OR REPLACE KHÔNG đè overload khác signature —
 * migration reputation từng copy body cũ tạo overload thừa → bump_reputation chết.
 * Contract: migration này DROP mọi overload finalize_raid rồi CREATE signature
 * HIỆN TẠI (11-param int + daily cap) + auth guard bump_reputation.
 */

const MIG = readFileSync(
  join(process.cwd(), "prisma/migrations/20260819150000_reputation/migration.sql"),
  "utf8",
);
const FINALIZE_CALLER = readFileSync(
  join(process.cwd(), "mini-services/raid-server/src/finalize.ts"),
  "utf8",
);
const FIX = readFileSync(
  join(process.cwd(), "prisma/migrations/20260820094500_bump_reputation_return_guard/migration.sql"),
  "utf8",
);

describe("reputation migration contract (review W7 #1/#3)", () => {
  it("DROP đủ 3 overload finalize_raid trước khi CREATE (boolean cũ + int 10 + int 11)", () => {
    expect((MIG.match(/DROP FUNCTION IF EXISTS finalize_raid/g) ?? []).length).toBe(3);
  });

  it("CREATE đúng signature hiện tại: p_defense_xp int + p_defense_xp_daily_cap", () => {
    expect(MIG.includes("p_defense_xp int")).toBe(true);
    expect(MIG.includes("p_defense_xp_daily_cap int DEFAULT 100")).toBe(true);
    expect(MIG.includes("p_defense_xp boolean")).toBe(false);
  });

  it("hook reputation chạy trong finalize_raid (2 PERFORM bump_reputation)", () => {
    expect((MIG.match(/^  PERFORM bump_reputation/gm) ?? []).length).toBe(2);
  });

  it("caller (finalize.ts) gửi p_defense_xp dạng int khớp signature (p_defense_xp: defenseXpAmount)", () => {
    expect(FINALIZE_CALLER.includes("p_defense_xp: defenseXpAmount")).toBe(true);
  });

  it("AUTH GUARD (review W7 #3): bump_reputation chặn bump hộ người khác", () => {
    expect(MIG.includes("bump_reputation: chỉ tự bump chính mình")).toBe(true);
    expect(MIG.includes("IS DISTINCT FROM p_user")).toBe(true);
  });

  it("daily-cap logic copy nguyên vẹn (reset khi đổi ngày)", () => {
    expect(MIG.includes("IS DISTINCT FROM v_today")).toBe(true);
  });
});

describe("bump_reputation return + NULL-safe guard", () => {
  it("function RETURNS jsonb via INTO + RETURN (plpgsql SELECT has a destination)", () => {
    expect(FIX.includes("SELECT to_jsonb(up) INTO v_out FROM up")).toBe(true);
    expect(FIX.includes("RETURN v_out")).toBe(true);
  });

  it("guard allows service-role NULL and blocks authenticated-other", () => {
    expect(FIX.includes("auth.uid() IS NOT NULL AND auth.uid()::text IS DISTINCT FROM p_user")).toBe(
      true,
    );
  });

  it("REVOKE EXECUTE from PUBLIC / anon / authenticated (thief delta not client-callable)", () => {
    expect(FIX.includes("REVOKE EXECUTE ON FUNCTION bump_reputation(text, int, int, int) FROM PUBLIC")).toBe(
      true,
    );
    expect(FIX.includes("REVOKE EXECUTE ON FUNCTION bump_reputation(text, int, int, int) FROM anon")).toBe(
      true,
    );
    expect(
      FIX.includes("REVOKE EXECUTE ON FUNCTION bump_reputation(text, int, int, int) FROM authenticated"),
    ).toBe(true);
  });
});
