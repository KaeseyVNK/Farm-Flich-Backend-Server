import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * W7d-P3: bounty board — contract checks đọc file (DB thật chạy ở staging).
 * Đối chiếu migration SQL ↔ Prisma schema: RPC place/cancel/top + RLS public
 * select + model Bounty (chặn deploy thiếu migration).
 */

const MIG = readFileSync(
  join(process.cwd(), "prisma/migrations/20260819160000_bounty_board/migration.sql"),
  "utf8",
);
const SCHEMA = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");

describe("bounty migration ↔ schema sync", () => {
  it("RPC đủ: place_bounty / cancel_bounty / top_thieves_7d (security definer)", () => {
    expect(MIG.includes("CREATE OR REPLACE FUNCTION place_bounty")).toBe(true);
    expect(MIG.includes("CREATE OR REPLACE FUNCTION cancel_bounty")).toBe(true);
    expect(MIG.includes("CREATE OR REPLACE FUNCTION top_thieves_7d")).toBe(true);
    expect((MIG.match(/SECURITY DEFINER/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it("gold trừ NGAY khi đặt + hoàn khi hủy (không escrow)", () => {
    expect(MIG.includes("gold - v_gold")).toBe(true);
    expect(MIG.includes("gold + v_gold")).toBe(true);
  });

  it("chặn: tự treo mình / trùng active / thiếu vàng / dưới 50", () => {
    expect(MIG.includes("không tự treo")).toBe(true);
    expect(MIG.includes("đã treo thưởng")).toBe(true);
    expect(MIG.includes("không đủ gold")).toBe(true);
    expect(MIG.includes('CHECK ("gold" >= 50)')).toBe(true);
  });

  it("AUTH GUARD (review W7 #2): place/cancel chặn gọi hộ người khác", () => {
    expect(MIG.includes("place_bounty: chỉ đặt thưởng bằng chính tài khoản mình")).toBe(true);
    expect(MIG.includes("cancel_bounty: chỉ hủy thưởng của chính mình")).toBe(true);
    expect((MIG.match(/IS DISTINCT FROM p_owner/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("RLS: SELECT public — KHÔNG policy INSERT/UPDATE (chỉ RPC)", () => {
    expect(MIG.includes("bounty_select_public")).toBe(true);
    expect(MIG.includes("bounty_insert")).toBe(false);
    expect(MIG.includes("bounty_update")).toBe(false);
  });

  it("top thieves lọc 7 ngày + winner=thief", () => {
    expect(MIG.includes("interval '7 days'")).toBe(true);
    expect(MIG.includes("'winner' = 'thief'")).toBe(true);
  });

  it("Prisma model Bounty khớp cột migration", () => {
    expect(SCHEMA.includes("model Bounty")).toBe(true);
    for (const col of ["ownerId", "thiefId", "gold", "status", "createdAt"]) {
      expect(SCHEMA.includes(`  ${col} `)).toBe(true);
    }
    expect(SCHEMA.includes('bountyPlaced  Bounty[]')).toBe(true);
    expect(SCHEMA.includes('bountyTarget  Bounty[]')).toBe(true);
  });
});

const PAYOUT = readFileSync(
  join(process.cwd(), "prisma/migrations/20260820094900_bounty_payout_on_catch/migration.sql"),
  "utf8",
);

describe("bounty payout on catch", () => {
  it("payout_bounties_on_catch is SECURITY DEFINER and not client-callable", () => {
    expect(PAYOUT.includes("CREATE OR REPLACE FUNCTION payout_bounties_on_catch(p_thief text, p_catcher text)")).toBe(
      true,
    );
    expect(PAYOUT.includes("SECURITY DEFINER")).toBe(true);
    expect(PAYOUT.includes("REVOKE ALL ON FUNCTION payout_bounties_on_catch(text, text) FROM PUBLIC")).toBe(true);
    expect(PAYOUT.includes("REVOKE ALL ON FUNCTION payout_bounties_on_catch(text, text) FROM authenticated")).toBe(
      true,
    );
  });

  it("pays catcher gold and marks bounty paid; skips self-catch", () => {
    expect(PAYOUT.includes("SET gold = gold + v_row.gold")).toBe(true);
    expect(PAYOUT.includes("SET status = 'paid'")).toBe(true);
    expect(PAYOUT.includes("p_thief = p_catcher")).toBe(true);
  });

  it("finalize_raid nested PERFORM only when reason is caught", () => {
    expect(PAYOUT.includes("PERFORM payout_bounties_on_catch(p_thief, p_owner)")).toBe(true);
    expect(PAYOUT.includes("IF p_reason = 'caught' THEN")).toBe(true);
    expect((PAYOUT.match(/^  PERFORM bump_reputation/gm) ?? []).length).toBe(2);
  });

  it("Prisma status comment includes paid", () => {
    expect(SCHEMA.includes("active | cancelled | paid")).toBe(true);
  });
});
