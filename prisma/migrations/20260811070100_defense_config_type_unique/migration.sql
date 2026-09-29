-- C4 fix: DefenseConfig composite unique (userId, slot, type).
-- Trước đó (userId, slot) → spend_defense_xp upgrade trap L3 overwrite payload {level:3},
-- mất kind/tile/durability. Composite cho phép dog@slot=0 + trap@slot=0 tách biệt.
ALTER TABLE "DefenseConfig" DROP CONSTRAINT IF EXISTS "DefenseConfig_userId_slot_key";
ALTER TABLE "DefenseConfig" ADD CONSTRAINT "DefenseConfig_userId_slot_type_key"
  UNIQUE ("userId", "slot", "type");

-- spend_defense_xp rewrite: monotonic guard (reject level <= current) + payload MERGE
-- (giữ kind/tile/durability, chỉ bump level). Conflict key composite.
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
  -- Monotonic: reject nếu target level <= current (anti downgrade/same — audit H2).
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

  -- Upsert level — MERGE payload (giữ kind/tile/durability, chỉ set level).
  INSERT INTO "DefenseConfig" ("id", "userId", "slot", "type", "payload", "updatedAt")
  VALUES (gen_random_uuid()::text, p_user, p_slot, p_target, jsonb_build_object('level', p_level), now())
  ON CONFLICT ("userId", "slot", "type") DO UPDATE
    SET payload = "DefenseConfig".payload || jsonb_build_object('level', p_level),
        "updatedAt" = now();
END;
$$;
