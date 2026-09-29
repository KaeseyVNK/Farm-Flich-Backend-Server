-- When a thief is caught, active bounties on that thief pay the catching farm owner.
-- Nested from finalize_raid (service role). Not client-callable.

CREATE OR REPLACE FUNCTION payout_bounties_on_catch(p_thief text, p_catcher text)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
  v_n int := 0;
BEGIN
  IF p_thief IS NULL OR p_catcher IS NULL OR p_thief = p_catcher THEN
    RETURN 0;
  END IF;
  FOR v_row IN
    SELECT id, gold FROM "Bounty"
    WHERE "thiefId" = p_thief AND status = 'active'
    FOR UPDATE
  LOOP
    UPDATE "User" SET gold = gold + v_row.gold WHERE id = p_catcher;
    UPDATE "Bounty" SET status = 'paid' WHERE id = v_row.id;
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION payout_bounties_on_catch(text, text) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION payout_bounties_on_catch(text, text) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION payout_bounties_on_catch(text, text) FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION payout_bounties_on_catch(text, text) TO service_role;
  END IF;
END $$;

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

  PERFORM bump_reputation(p_thief, 0,
    CASE p_reason WHEN 'exit' THEN 3 WHEN 'caught' THEN -2 ELSE -1 END, 0);
  PERFORM bump_reputation(p_owner, 0, 0,
    CASE p_reason WHEN 'caught' THEN 2 WHEN 'timeout' THEN 1 ELSE 0 END);

  IF p_reason = 'caught' THEN
    PERFORM payout_bounties_on_catch(p_thief, p_owner);
  END IF;
END;
$$;
