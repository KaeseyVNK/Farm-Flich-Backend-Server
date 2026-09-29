-- Phase 5: Friendship + GiftLog + gift_item RPC atomic.
-- Friendship canonical A<B. gift_item: lock friendship + count today + whitelist + deduct + add + log.

CREATE TABLE IF NOT EXISTS "Friendship" (
    "id" TEXT NOT NULL,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "initiatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Friendship_userAId_userBId_key" ON "Friendship"("userAId", "userBId");
CREATE INDEX IF NOT EXISTS "Friendship_userAId_idx" ON "Friendship"("userAId");
CREATE INDEX IF NOT EXISTS "Friendship_userBId_idx" ON "Friendship"("userBId");

CREATE TABLE IF NOT EXISTS "GiftLog" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GiftLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "GiftLog_fromId_toId_createdAt_idx" ON "GiftLog"("fromId", "toId", "createdAt");

-- gift_item: atomic 6-step. Whitelist check (resources + crops — itemId NOT LIKE tool/quest/ket/gold%).
CREATE OR REPLACE FUNCTION gift_item(
  p_from text, p_to text, p_item text, p_qty int
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_friend int;
  v_today_count int;
  v_new_qty int;
BEGIN
  -- 1. Friendship accepted (A<B canonical — check cả 2 hướng).
  SELECT 1 INTO v_friend FROM "Friendship"
  WHERE status='accepted' AND (
    ("userAId"=p_from AND "userBId"=p_to) OR ("userAId"=p_to AND "userBId"=p_from)
  ) FOR UPDATE;
  IF v_friend IS NULL THEN
    RAISE EXCEPTION 'gift_item: không phải bạn bè' USING ERRCODE = 'check_violation';
  END IF;
  -- 2. Daily cap 5.
  SELECT count(*) INTO v_today_count FROM "GiftLog"
  WHERE "fromId"=p_from AND "toId"=p_to AND "createdAt" >= CURRENT_DATE;
  IF v_today_count >= 5 THEN
    RAISE EXCEPTION 'gift_item: vượt cap 5/ngày' USING ERRCODE = 'check_violation';
  END IF;
  -- 3. Whitelist: chặn tool/quest/ket/gold (chỉ resources + crops).
  IF p_item LIKE 'tool_%' OR p_item LIKE 'quest_%' OR p_item LIKE 'ket_%' OR p_item LIKE 'gold%' THEN
    RAISE EXCEPTION 'gift_item: item % không được gift', p_item USING ERRCODE = 'check_violation';
  END IF;
  -- 4. Deduct from (atomic check qty >= p_qty — returns NULL khi thiếu).
  SELECT deduct_inventory(p_from, p_item, p_qty) INTO v_new_qty;
  IF v_new_qty IS NULL THEN
    RAISE EXCEPTION 'gift_item: không đủ %', p_item USING ERRCODE = 'check_violation';
  END IF;
  -- 5. Add to.
  INSERT INTO "Inventory" ("id", "userId", "itemId", "qty")
  VALUES (gen_random_uuid()::text, p_to, p_item, p_qty)
  ON CONFLICT ("userId", "itemId") DO UPDATE SET qty = "Inventory".qty + p_qty;
  -- 6. GiftLog.
  INSERT INTO "GiftLog" ("id", "fromId", "toId", "itemId", "qty")
  VALUES (gen_random_uuid()::text, p_from, p_to, p_item, p_qty);
END;
$$;
