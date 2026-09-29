-- Farm.shieldUntil is timestamp(3) without time zone (Prisma DateTime default).
-- Signature change requires DROP (CREATE OR REPLACE cannot change OUT types).

DROP FUNCTION IF EXISTS list_raidable_farms();

CREATE OR REPLACE FUNCTION list_raidable_farms()
RETURNS TABLE (
  id text,
  "ownerId" text,
  "shieldUntil" timestamp,
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

REVOKE ALL ON FUNCTION list_raidable_farms() FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION list_raidable_farms() TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION list_raidable_farms() FROM anon;
  END IF;
END $$;
