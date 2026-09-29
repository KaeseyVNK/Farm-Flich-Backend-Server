-- Raid RPC functions (phase 6 finalize — server-authoritative atomic).
-- concept §12/§13, red-team #1/#8.

-- deduct_inventory: atomic subtract, chỉ thành công nếu qty >= delta. Trả về qty mới (hoặc NULL nếu thiếu).
CREATE OR REPLACE FUNCTION deduct_inventory(p_user text, p_item text, p_delta int)
RETURNS int LANGUAGE sql AS $$
  UPDATE "Inventory" SET qty = qty - p_delta
  WHERE "userId" = p_user AND "itemId" = p_item AND qty >= p_delta
  RETURNING qty;
$$;

-- finalize_raid: transaction atomic — shield + daily count + mask durability + defense XP + RaidSession resolved.
-- Daily count reset 24h. Mask durability floor 0.
CREATE OR REPLACE FUNCTION finalize_raid(
  p_session text,
  p_farm text,
  p_owner text,
  p_thief text,
  p_mask text,
  p_shield_until timestamptz,
  p_defense_xp boolean,
  p_reason text,
  p_result jsonb,
  p_daily_cap int
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_count int;
  v_reset timestamptz;
  v_rows int;
BEGIN
  -- Idempotency: chỉ finalize session active. Re-run → RAISE rollback (tránh double bump).
  UPDATE "RaidSession"
  SET status = 'resolved', "endedAt" = now(), "resultJson" = p_result
  WHERE id = p_session AND status = 'active';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION 'finalize_raid: session % không active (đã finalize?)', p_session
      USING ERRCODE = 'check_violation';
  END IF;

  -- Shield + daily raid count (reset nếu > 24h)
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

  -- Mask durability -1 (floor 0)
  UPDATE "Mask" SET durability = GREATEST(0, durability - 1)
  WHERE "userId" = p_thief AND "maskId" = p_mask;

  -- Defense XP (owner, nếu raid thật)
  IF p_defense_xp THEN
    UPDATE "User" SET "defenseXp" = "defenseXp" + 1 WHERE id = p_owner;
  END IF;
END;
$$;
