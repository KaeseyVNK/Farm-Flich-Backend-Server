-- bump_reputation: plpgsql SELECT without INTO/RETURN raises
-- "query has no destination for result data" and rolls back the upsert.
-- Guard used bare IS DISTINCT FROM so service-role auth.uid() NULL always RAISE
-- (NULL IS DISTINCT FROM uuid = TRUE). finalize_raid then force-resolves empty loot.
--
-- This migration replaces the function: RETURN the CTE row, NULL-safe guard
-- (authenticated-other blocked, service-role NULL allowed), REVOKE direct client
-- EXECUTE so thief/guard deltas only come from finalize nested PERFORM.
-- bump_farmer_reputation stays client-callable (clamps 1-5, nested call as definer).

CREATE OR REPLACE FUNCTION bump_reputation(
  p_user text,
  p_farmer int DEFAULT 0,
  p_thief int DEFAULT 0,
  p_guard int DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_out jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid()::text IS DISTINCT FROM p_user THEN
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
  SELECT to_jsonb(up) INTO v_out FROM up;
  RETURN v_out;
END;
$$;

REVOKE EXECUTE ON FUNCTION bump_reputation(text, int, int, int) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE EXECUTE ON FUNCTION bump_reputation(text, int, int, int) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE EXECUTE ON FUNCTION bump_reputation(text, int, int, int) FROM authenticated;
  END IF;
END $$;
