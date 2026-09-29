-- Review H10: finalize_raid không có auth guard (dual-caller: service-role
-- auth.uid()=NULL). Participant (owner/thief) gọi thẳng /rpc/finalize_raid với
-- args tự chọn → early resolve, fake winner, rep/shield manipulation; finalize
-- thật sau đó kẹt retry. Guard: chỉ service-role (auth.uid() NULL) được gọi —
-- client path không tồn tại (raid-server duy nhất trigger).
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
  -- H10 guard: service-role caller → auth.uid() NULL → NULL IS NOT NULL = false
  -- → pass. Authenticated/anon caller → RAISE.
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'finalize_raid: server-only' USING ERRCODE = 'insufficient_privilege';
  END IF;

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

  -- Reputation hook: thief exit +3 / caught −2 / timeout −1; owner guard
  -- caught +2 / timeout +1 / exit +0.
  PERFORM bump_reputation(p_thief, 0,
    CASE p_reason WHEN 'exit' THEN 3 WHEN 'caught' THEN -2 ELSE -1 END, 0);
  PERFORM bump_reputation(p_owner, 0, 0,
    CASE p_reason WHEN 'caught' THEN 2 WHEN 'timeout' THEN 1 ELSE 0 END);

  IF p_reason = 'caught' THEN
    PERFORM payout_bounties_on_catch(p_thief, p_owner);
  END IF;
END;
$$;

-- Review C4-follow-up: steal_with_loss_cap tin p_pool từ caller (TOCTOU M-level)
-- giữ nguyên (deduct_inventory clamp chặn over-withdraw); pool drift đã accept.
