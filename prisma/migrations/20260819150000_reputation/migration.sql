-- W7d-P1: Reputation 3 nhánh farmer/thief/guard (concept §14).
-- Bảng + RLS (public SELECT cho bounty board; write chỉ qua RPC security definer)
-- + RPC bump (auth-guard: chỉ tự bump mình; service-role auth.uid() NULL → pass)
-- + hook vào finalize_raid + cột RaidSession.guardBonus (replay re-sim).

CREATE TABLE IF NOT EXISTS "Reputation" (
  "userId" text NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "farmer" integer NOT NULL DEFAULT 0 CHECK ("farmer" >= 0),
  "thief" integer NOT NULL DEFAULT 0 CHECK ("thief" >= 0),
  "guard" integer NOT NULL DEFAULT 0 CHECK ("guard" >= 0),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "Reputation_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "Reputation" ENABLE ROW LEVEL SECURITY;

-- Public read: bounty board cần top thief cross-user + client đọc hiệu ứng của mình.
-- KHÔNG policy INSERT/UPDATE — chỉ qua RPC security definer bên dưới.
DROP POLICY IF EXISTS "reputation_select_public" ON "Reputation";
CREATE POLICY "reputation_select_public" ON "Reputation" FOR SELECT USING (true);

-- bump_reputation: atomic upsert + clamp ≥ 0 (reputation không âm).
-- AUTH GUARD (review W7 #3): auth.uid() <> p_user → chặn (tránh drain rep người khác
-- qua /rpc trực tiếp). Service-role caller (raid-server finalize) có auth.uid() NULL →
-- NULL <> p_user = NULL → IF không nhảy → pass — cùng pattern craft_mask.
-- Delta âm chỉ có hiệu lực khi đã có row (INSERT dùng GREATEST(0, delta) = 0 nếu âm).
CREATE OR REPLACE FUNCTION bump_reputation(
  p_user text,
  p_farmer int DEFAULT 0,
  p_thief int DEFAULT 0,
  p_guard int DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid()::text IS DISTINCT FROM p_user THEN
    RAISE EXCEPTION 'bump_reputation: chỉ tự bump chính mình'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  WITH up AS (
    INSERT INTO "Reputation" ("userId", farmer, thief, guard, "updatedAt")
    VALUES (p_user, GREATEST(0, p_farmer), GREATEST(0, p_thief), GREATEST(0, p_guard), now())
    ON CONFLICT ("userId") DO UPDATE SET
      farmer = GREATEST(0, "Reputation".farmer + p_farmer),
      thief  = GREATEST(0, "Reputation".thief  + p_thief),
      guard  = GREATEST(0, "Reputation".guard  + p_guard),
      "updatedAt" = now()
    RETURNING "Reputation".farmer, "Reputation".thief, "Reputation".guard
  )
  SELECT to_jsonb(up) FROM up;
END;
$$;

-- bump_farmer_reputation: hook ship/order client (delta clamp 1-5 — local-first game,
-- farmer rep chỉ mở +5% giá bán của chính mình; spam = tự lừa, chấp nhận).
CREATE OR REPLACE FUNCTION bump_farmer_reputation(p_user text, p_delta int)
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT bump_reputation(p_user, LEAST(5, GREATEST(1, p_delta)), 0, 0);
$$;

-- RaidSession.guardBonus: owner guard-rep ≥ 50 khi join → dog vision +1 tile.
-- Persist cho replay re-sim chính xác (pattern maskId/bloodMoon).
ALTER TABLE "RaidSession" ADD COLUMN IF NOT EXISTS "guardBonus" boolean NOT NULL DEFAULT false;

-- finalize_raid + Reputation hook. Review W7 #1: KHÔNG được copy body cũ rồi
-- CREATE OR REPLACE — arg types khác = overload THỨ HAI, PostgREST vẫn trỏ overload
-- cũ (hook chết). Phải DROP MỌI overload rồi CREATE signature HIỆN TẠI (11-param int
-- + daily cap, body từ migration 20260811070700) + 2 PERFORM bump_reputation cuối.
DROP FUNCTION IF EXISTS finalize_raid(text, text, text, text, text, timestamptz, boolean, text, jsonb, int);
DROP FUNCTION IF EXISTS finalize_raid(text, text, text, text, text, timestamptz, int, text, jsonb, int);
DROP FUNCTION IF EXISTS finalize_raid(text, text, text, text, text, timestamptz, int, text, jsonb, int, int);

CREATE OR REPLACE FUNCTION finalize_raid(
  p_session text,
  p_farm text,
  p_owner text,
  p_thief text,
  p_mask text,
  p_shield_until timestamptz,
  p_defense_xp int,
  p_reason text,
  p_result jsonb,
  p_daily_cap int,
  p_defense_xp_daily_cap int DEFAULT 100
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_count int;
  v_reset timestamptz;
  v_rows int;
  v_today date;
  v_xp_today int;
  v_granted int;
BEGIN
  UPDATE "RaidSession"
  SET status = 'resolved', "endedAt" = now(), "resultJson" = p_result
  WHERE id = p_session AND status = 'active';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION 'finalize_raid: session % không active', p_session
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT "dailyRaidCount", "dailyRaidResetAt" INTO v_count, v_reset
  FROM "Farm" WHERE id = p_farm FOR UPDATE;
  IF v_reset IS NULL OR now() - v_reset > interval '24 hours' THEN
    v_count := 0;
    v_reset := now();
  END IF;
  v_count := LEAST(v_count + 1, p_daily_cap);
  UPDATE "Farm"
  SET "shieldUntil" = p_shield_until, "dailyRaidCount" = v_count, "dailyRaidResetAt" = v_reset
  WHERE id = p_farm;

  UPDATE "Mask" SET durability = GREATEST(0, durability - 1)
  WHERE "userId" = p_thief AND "maskId" = p_mask;

  -- Defense XP int amount + DAILY CAP 100 (phase 3 F3.3).
  IF p_defense_xp > 0 THEN
    v_today := now()::date;
    SELECT COALESCE("defenseXpToday", 0), "defenseXpDate"
    INTO v_xp_today, v_reset
    FROM "User" WHERE id = p_owner FOR UPDATE;
    IF v_reset IS DISTINCT FROM v_today THEN
      v_xp_today := 0;
    END IF;
    v_granted := LEAST(GREATEST(p_defense_xp_daily_cap - v_xp_today, 0), p_defense_xp);
    IF v_granted > 0 THEN
      UPDATE "User"
      SET "defenseXp" = "defenseXp" + v_granted,
          "defenseXpToday" = v_xp_today + v_granted,
          "defenseXpDate" = v_today
      WHERE id = p_owner;
    END IF;
  END IF;

  -- W7d-P1 Reputation (§14): thief — exit +3 (thoát) / caught −2 / timeout −1;
  -- owner guard — caught +2 (bảo vệ thành công) / timeout +1 / exit +0.
  -- bump_reputation auth-guard: chạy trong SECURITY DEFINER của finalize_raid
  -- (service role → auth.uid() NULL → pass).
  PERFORM bump_reputation(p_thief, 0,
    CASE p_reason WHEN 'exit' THEN 3 WHEN 'caught' THEN -2 ELSE -1 END, 0);
  PERFORM bump_reputation(p_owner, 0, 0,
    CASE p_reason WHEN 'caught' THEN 2 WHEN 'timeout' THEN 1 ELSE 0 END);
END;
$$;
