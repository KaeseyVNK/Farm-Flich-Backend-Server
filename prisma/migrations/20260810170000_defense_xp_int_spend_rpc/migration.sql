-- Phase 3: finalize_raid p_defense_xp boolean→int (severity scaled) + spend_defense_xp RPC atomic.
-- Re-define finalize_raid (CREATE OR REPLACE) với p_defense_xp int.

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
  p_daily_cap int
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_count int;
  v_reset timestamptz;
  v_rows int;
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

  -- Defense XP int amount (phase 3 — severity scaled, server-computed).
  IF p_defense_xp > 0 THEN
    UPDATE "User" SET "defenseXp" = "defenseXp" + p_defense_xp WHERE id = p_owner;
  END IF;
END;
$$;

-- spend_defense_xp: owner upgrade DefenseConfig level. Atomic lock + cost check + upsert.
-- cost = level * 50. Level cap 3 (caller validate). target: dog|fence|trap.
CREATE OR REPLACE FUNCTION spend_defense_xp(
  p_user text,
  p_target text,
  p_slot int,
  p_level int
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_xp int;
  v_cost int;
BEGIN
  v_cost := p_level * 50;
  SELECT "defenseXp" INTO v_xp FROM "User" WHERE id = p_user FOR UPDATE;
  IF v_xp IS NULL THEN
    RAISE EXCEPTION 'spend_defense_xp: user % không tồn tại', p_user USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF v_xp < v_cost THEN
    RAISE EXCEPTION 'spend_defense_xp: không đủ XP (cần %, có %)', v_cost, v_xp
      USING ERRCODE = 'check_violation';
  END IF;
  UPDATE "User" SET "defenseXp" = v_xp - v_cost WHERE id = p_user;
  INSERT INTO "DefenseConfig" ("id", "userId", "slot", "type", "payload", "updatedAt")
  VALUES (gen_random_uuid()::text, p_user, p_slot, p_target, jsonb_build_object('level', p_level), now())
  ON CONFLICT ("userId", "slot") DO UPDATE
    SET "type" = EXCLUDED."type", "payload" = EXCLUDED."payload", "updatedAt" = now();
END;
$$;
