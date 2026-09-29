-- Fix spend_defense_xp: raw INSERT cần id (cuid là app-side, không DB default).
-- gen_random_uuid()::text cho id + updatedAt = now().
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
