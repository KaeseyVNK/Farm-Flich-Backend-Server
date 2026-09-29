-- Fix: spend_defense_xp SET "updatedAt" (quoted) — audit C4 follow-up.
-- Migration 20260811070100 source đã sửa quote; migration này re-CREATE OR REPLACE function trên DB hiện tại.
CREATE OR REPLACE FUNCTION spend_defense_xp(
  p_user text,
  p_target text,
  p_slot int,
  p_level int
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_xp int;
  v_cost int;
  v_existing int;
BEGIN
  SELECT (payload->>'level')::int INTO v_existing FROM "DefenseConfig"
  WHERE "userId" = p_user AND slot = p_slot AND type = p_target;
  IF v_existing IS NOT NULL AND v_existing >= p_level THEN
    RAISE EXCEPTION 'spend_defense_xp: level % đã đạt/cao hơn target %', v_existing, p_level
      USING ERRCODE = 'check_violation';
  END IF;

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
  ON CONFLICT ("userId", "slot", "type") DO UPDATE
    SET payload = "DefenseConfig".payload || jsonb_build_object('level', p_level),
        "updatedAt" = now();
END;
$$;
