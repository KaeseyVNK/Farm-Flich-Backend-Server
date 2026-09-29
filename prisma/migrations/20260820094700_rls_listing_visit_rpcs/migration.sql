-- Owner-only PostgREST RLS (no FORCE — Prisma/service_role still bypasses) plus
-- listing/visit SECURITY DEFINER RPCs so raid lobby and friend visit still work.

CREATE OR REPLACE FUNCTION list_raidable_farms()
RETURNS TABLE (
  id text,
  "ownerId" text,
  "shieldUntil" timestamptz,
  "dailyRaidCount" int,
  "displayName" text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'list_raidable_farms: not authenticated'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN QUERY
  SELECT f.id, f."ownerId", f."shieldUntil", f."dailyRaidCount", u."displayName"
  FROM "Farm" f
  JOIN "User" u ON u.id = f."ownerId"
  WHERE f."ownerId" <> auth.uid()::text
    AND (f."shieldUntil" IS NULL OR f."shieldUntil" < now())
  LIMIT 20;
END;
$$;

CREATE OR REPLACE FUNCTION visit_friend_farm(p_owner text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid text := auth.uid()::text;
  v_a text;
  v_b text;
  v_row jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'visit_friend_farm: not authenticated'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_owner IS NULL OR p_owner = v_uid THEN
    RAISE EXCEPTION 'visit_friend_farm: invalid owner'
      USING ERRCODE = 'check_violation';
  END IF;
  v_a := LEAST(v_uid, p_owner);
  v_b := GREATEST(v_uid, p_owner);
  IF NOT EXISTS (
    SELECT 1 FROM "Friendship"
    WHERE "userAId" = v_a AND "userBId" = v_b AND status = 'accepted'
  ) THEN
    RAISE EXCEPTION 'visit_friend_farm: not friends'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT jsonb_build_object(
    'terrain', terrain,
    'crops', crops,
    'objects', objects,
    'forage', forage,
    'placedDecor', "placedDecor",
    'pondFish', "pondFish"
  )
  INTO v_row
  FROM "Farm"
  WHERE "ownerId" = p_owner;
  IF v_row IS NULL THEN
    RAISE EXCEPTION 'visit_friend_farm: farm missing'
      USING ERRCODE = 'no_data_found';
  END IF;
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION list_raidable_farms() FROM PUBLIC;
REVOKE ALL ON FUNCTION visit_friend_farm(text) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION list_raidable_farms() TO authenticated;
    GRANT EXECUTE ON FUNCTION visit_friend_farm(text) TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION list_raidable_farms() FROM anon;
    REVOKE ALL ON FUNCTION visit_friend_farm(text) FROM anon;
  END IF;
END $$;

-- RLS + user_public view reference auth.uid() — skip on local Postgres without auth schema.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    EXECUTE 'DROP VIEW IF EXISTS user_public';
    EXECUTE $v$
      CREATE VIEW user_public AS
      SELECT u.id, u."displayName"
      FROM "User" u
      WHERE u.id = auth.uid()::text
         OR EXISTS (
           SELECT 1 FROM "Friendship" f
           WHERE f.status = 'accepted'
             AND (
               (f."userAId" = auth.uid()::text AND f."userBId" = u.id)
               OR (f."userBId" = auth.uid()::text AND f."userAId" = u.id)
             )
         );
    $v$;
    EXECUTE 'REVOKE ALL ON user_public FROM PUBLIC';
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE 'GRANT SELECT ON user_public TO authenticated';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE 'REVOKE ALL ON user_public FROM anon';
    END IF;

    ALTER TABLE "Inventory" ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS inventory_owner ON "Inventory";
    EXECUTE 'CREATE POLICY inventory_owner ON "Inventory" FOR ALL USING (auth.uid()::text = "userId") WITH CHECK (auth.uid()::text = "userId")';

    ALTER TABLE "DefenseConfig" ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS defense_config_owner ON "DefenseConfig";
    EXECUTE 'CREATE POLICY defense_config_owner ON "DefenseConfig" FOR ALL USING (auth.uid()::text = "userId") WITH CHECK (auth.uid()::text = "userId")';

    ALTER TABLE "Mask" ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS mask_owner ON "Mask";
    EXECUTE 'CREATE POLICY mask_owner ON "Mask" FOR ALL USING (auth.uid()::text = "userId") WITH CHECK (auth.uid()::text = "userId")';

    ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS user_owner ON "User";
    EXECUTE 'CREATE POLICY user_owner ON "User" FOR ALL USING (auth.uid()::text = id) WITH CHECK (auth.uid()::text = id)';

    ALTER TABLE "Farm" ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS farm_owner ON "Farm";
    EXECUTE 'CREATE POLICY farm_owner ON "Farm" FOR ALL USING (auth.uid()::text = "ownerId") WITH CHECK (auth.uid()::text = "ownerId")';

    ALTER TABLE "RaidSession" ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS raid_session_participants ON "RaidSession";
    EXECUTE 'CREATE POLICY raid_session_participants ON "RaidSession" FOR ALL USING (auth.uid()::text = "ownerId" OR auth.uid()::text = "thiefId") WITH CHECK (auth.uid()::text = "ownerId" OR auth.uid()::text = "thiefId")';

    ALTER TABLE "Friendship" ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS friendship_participants ON "Friendship";
    EXECUTE 'CREATE POLICY friendship_participants ON "Friendship" FOR ALL USING (auth.uid()::text IN ("userAId", "userBId")) WITH CHECK (auth.uid()::text IN ("userAId", "userBId"))';
  END IF;
END $$;
