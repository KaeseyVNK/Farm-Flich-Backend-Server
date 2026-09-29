-- W7d-P3: Bảng truy nã (§14). Bounty {owner, thief, gold, status} — gold trừ NGAY
-- khi đặt (KHÔNG escrow), hoàn đủ khi hủy. KHÔNG hệ thống "đi bắt" (OUT theo plan).
-- Top thief 7 ngày từ RaidSession resolved winner=thief (RPC security definer —
-- RaidSession RLS không cho cross-user select).

CREATE TABLE IF NOT EXISTS "Bounty" (
  "id" text NOT NULL,
  "ownerId" text NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "thiefId" text NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "gold" integer NOT NULL CHECK ("gold" >= 50),
  "status" text NOT NULL DEFAULT 'active', -- active | cancelled
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "Bounty_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Bounty_thiefId_status_idx" ON "Bounty"("thiefId", "status");

ALTER TABLE "Bounty" ENABLE ROW LEVEL SECURITY;

-- Board công khai — ai cũng xem bounty đang treo.
DROP POLICY IF EXISTS "bounty_select_public" ON "Bounty";
CREATE POLICY "bounty_select_public" ON "Bounty" FOR SELECT USING (true);
-- INSERT/UPDATE chỉ qua RPC security definer (đặt/hủy + trừ/hoàn gold atomic).

-- place_bounty: atomic — clamp giá, chặn tự treo mình, chặn trùng (owner,thief)
-- active, trừ gold NGAY (KHÔNG escrow). Fail → exception rollback toàn bộ.
CREATE OR REPLACE FUNCTION place_bounty(p_owner text, p_thief text, p_gold int)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_gold int := LEAST(5000, GREATEST(50, p_gold));
  v_id text := gen_random_uuid()::text;
  v_balance int;
BEGIN
  -- AUTH GUARD (review W7 #2): chặn drain gold người khác qua /rpc trực tiếp
  -- (pattern craft_mask — trust-boundary audit 20260813110000).
  IF auth.uid()::text IS DISTINCT FROM p_owner THEN
    RAISE EXCEPTION 'place_bounty: chỉ đặt thưởng bằng chính tài khoản mình'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_owner = p_thief THEN
    RAISE EXCEPTION 'place_bounty: không tự treo thưởng cho chính mình';
  END IF;
  IF EXISTS (SELECT 1 FROM "Bounty" WHERE "ownerId" = p_owner AND "thiefId" = p_thief AND status = 'active') THEN
    RAISE EXCEPTION 'place_bounty: đã treo thưởng cho trộm này (hủy cái cũ trước)';
  END IF;
  SELECT gold INTO v_balance FROM "User" WHERE id = p_owner FOR UPDATE;
  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'place_bounty: user không tồn tại';
  END IF;
  IF v_balance < v_gold THEN
    RAISE EXCEPTION 'place_bounty: không đủ gold (% < %)', v_balance, v_gold;
  END IF;
  UPDATE "User" SET gold = gold - v_gold WHERE id = p_owner;
  INSERT INTO "Bounty" ("id", "ownerId", "thiefId", "gold", "status")
  VALUES (v_id, p_owner, p_thief, v_gold, 'active');
  RETURN v_id;
END;
$$;

-- cancel_bounty: hoàn ĐỦ gold + status cancelled (chỉ bounty active của mình).
CREATE OR REPLACE FUNCTION cancel_bounty(p_owner text, p_bounty_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_gold int;
  v_rows int;
BEGIN
  IF auth.uid()::text IS DISTINCT FROM p_owner THEN
    RAISE EXCEPTION 'cancel_bounty: chỉ hủy thưởng của chính mình'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE "Bounty" SET status = 'cancelled'
  WHERE id = p_bounty_id AND "ownerId" = p_owner AND status = 'active';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION 'cancel_bounty: bounty không tồn tại / đã hủy / không phải của bạn';
  END IF;
  SELECT gold INTO v_gold FROM "Bounty" WHERE id = p_bounty_id;
  UPDATE "User" SET gold = gold + v_gold WHERE id = p_owner;
END;
$$;

-- top_thieves_7d: board công khai — thief thoát thành công 7 ngày qua + tổng
-- bounty active. RaidSession cross-user → security definer (RLS bypass owner-only).
CREATE OR REPLACE FUNCTION top_thieves_7d()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    jsonb_agg(row_to_json(t) ORDER BY t."escapes" DESC, t."bountyGold" DESC),
    '[]'::jsonb
  )
  FROM (
    SELECT
      rs."thiefId" AS "thiefId",
      COALESCE(u."displayName", 'Trộm ' || left(rs."thiefId", 8)) AS "name",
      COUNT(*)::int AS "escapes",
      COALESCE((
        SELECT SUM(b.gold) FROM "Bounty" b
        WHERE b."thiefId" = rs."thiefId" AND b.status = 'active'
      ), 0)::int AS "bountyGold"
    FROM "RaidSession" rs
    JOIN "User" u ON u.id = rs."thiefId"
    WHERE rs.status = 'resolved'
      AND rs."endedAt" > now() - interval '7 days'
      AND rs."resultJson"->>'winner' = 'thief'
    GROUP BY rs."thiefId", u."displayName"
  ) t;
$$;
