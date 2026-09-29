-- Festival contest leaderboard: self + ≤10 accepted friends. Returns likes (today UTC)
-- + placedDecor only (no gold/gameMeta). Scoring stays client-side (decorScore).

CREATE OR REPLACE FUNCTION festival_friend_contest()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid text := auth.uid()::text;
  v_day int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'festival_friend_contest: not authenticated'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  v_day := (to_char((now() AT TIME ZONE 'UTC'), 'YYYYMMDD'))::int;
  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(t) ORDER BY t.likes DESC, t."userId")
    FROM (
      SELECT
        u.id AS "userId",
        u."displayName",
        COALESCE((
          SELECT count(*)::int FROM "FarmLike" fl
          WHERE fl."farmOwnerId" = u.id AND fl.day = v_day
        ), 0) AS likes,
        COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object('defId', e.elem->>'defId', 'zone', COALESCE(e.elem->>'zone', 'farm'))
            ORDER BY e.ord
          )
          FROM jsonb_array_elements(
            CASE WHEN jsonb_typeof(f."placedDecor") = 'array' THEN f."placedDecor" ELSE '[]'::jsonb END
          ) WITH ORDINALITY AS e(elem, ord)
          WHERE COALESCE(e.elem->>'defId', '') <> ''
        ), '[]'::jsonb) AS "placedDecor"
      FROM (
        SELECT v_uid AS id
        UNION ALL
        SELECT fid FROM (
          SELECT CASE WHEN fr."userAId" = v_uid THEN fr."userBId" ELSE fr."userAId" END AS fid
          FROM "Friendship" fr
          WHERE fr.status = 'accepted'
            AND (fr."userAId" = v_uid OR fr."userBId" = v_uid)
          ORDER BY fr."createdAt" ASC, fr.id ASC
          LIMIT 10
        ) friends
      ) ids
      JOIN "User" u ON u.id = ids.id
      LEFT JOIN "Farm" f ON f."ownerId" = u.id
    ) t
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION festival_friend_contest() FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION festival_friend_contest() TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION festival_friend_contest() FROM anon;
  END IF;
END $$;
