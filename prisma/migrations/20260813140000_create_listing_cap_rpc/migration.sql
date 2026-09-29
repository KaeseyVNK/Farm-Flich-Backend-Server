-- create_listing: thêm cap 20 active listings/user (atomic, anti-TOCTOU).
-- Trước đây marketplace.ts count (read) → check → RPC insert (write) RMW race:
-- 5 tab concurrent cùng đọc count=19 < 20 → cả 5 pass app check → RPC insert
-- hết → 24 active listings. RPC hiện chỉ auth guard + deduct_inventory, không
-- count, không lock → không thể enforce cap server-side.
-- Fix: User row FOR UPDATE (serialize per seller, khớp pattern craft_mask /
-- spend_defense_xp) + count active listings, RAISE check_violation nếu >= 20.
-- ponytail: literal 20 sync thủ công với src/lib/game/npc-shop-prices.ts
-- MAX_ACTIVE_LISTINGS (Postgres không đọc TS const). Client-trusted param không
-- dùng được.
CREATE OR REPLACE FUNCTION create_listing(
  p_seller text,
  p_item text,
  p_qty int,
  p_price int,
  p_expires timestamptz
) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v_lock int;
  v_active int;
  v_new_qty int;
  v_id text;
BEGIN
  IF auth.uid()::text <> p_seller THEN
    RAISE EXCEPTION 'create_listing: user mismatch' USING ERRCODE = 'insufficient_privilege';
  END IF;
  -- Lock User row: serialize listing creation per seller (short-lived TX).
  SELECT 1 INTO v_lock FROM "User" WHERE id = p_seller FOR UPDATE;
  IF v_lock IS NULL THEN
    RAISE EXCEPTION 'create_listing: seller không tồn tại' USING ERRCODE = 'foreign_key_violation';
  END IF;
  -- Cap 20 active listings/user (sync MAX_ACTIVE_LISTINGS, src/lib/game/npc-shop-prices.ts).
  SELECT count(*) INTO v_active FROM "Listing"
  WHERE "sellerId" = p_seller AND status = 'active';
  IF v_active >= 20 THEN
    RAISE EXCEPTION 'create_listing: vượt cap 20 active listings' USING ERRCODE = 'check_violation';
  END IF;
  SELECT deduct_inventory(p_seller, p_item, p_qty) INTO v_new_qty;
  IF v_new_qty IS NULL THEN
    RAISE EXCEPTION 'create_listing: không đủ %', p_item USING ERRCODE = 'check_violation';
  END IF;
  v_id := gen_random_uuid()::text;
  INSERT INTO "Listing" ("id", "sellerId", "itemId", "qty", "priceUnit", "status", "createdAt", "expiresAt")
  VALUES (v_id, p_seller, p_item, p_qty, p_price, 'active', now(), p_expires);
  RETURN v_id;
END;
$$;
