-- C2 fix: marketplace create/cancel + craft_mask atomic RPCs.
-- Trước đó app-side 2-step non-atomic: deduct inventory → insert Listing (fail = mất item).
-- craft_mask: ingredients deduct app-side loop, mid-loop fail = partial deduct + no mask.

-- create_listing: deduct inventory + INSERT Listing atomic. Trả NULL nếu inventory thiếu.
CREATE OR REPLACE FUNCTION create_listing(
  p_seller text,
  p_item text,
  p_qty int,
  p_price int,
  p_expires timestamptz
) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v_new_qty int;
  v_id text;
BEGIN
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

-- cancel_listing: refund + status cancelled atomic. FOR UPDATE lock + ROW_COUNT guard.
CREATE OR REPLACE FUNCTION cancel_listing(
  p_listing text,
  p_user text
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_row RECORD;
  v_rows int;
BEGIN
  SELECT "sellerId", "itemId", qty, status INTO v_row
  FROM "Listing" WHERE id = p_listing FOR UPDATE;
  IF v_row."sellerId" IS NULL THEN
    RAISE EXCEPTION 'cancel_listing: listing % không tồn tại', p_listing USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF v_row."sellerId" <> p_user THEN
    RAISE EXCEPTION 'cancel_listing: forbidden' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v_row.status <> 'active' THEN
    RAISE EXCEPTION 'cancel_listing: listing không active (%)', v_row.status USING ERRCODE = 'check_violation';
  END IF;
  -- Refund atomic.
  PERFORM add_inventory(p_user, v_row."itemId", v_row.qty);
  UPDATE "Listing" SET status = 'cancelled' WHERE id = p_listing AND status = 'active';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION 'cancel_listing: race — listing đã đổi trạng thái' USING ERRCODE = 'check_violation';
  END IF;
END;
$$;

-- craft_mask rewrite: nhận ingredients jsonb, deduct atomic toàn bộ. Mask đã sở hữu → raise.
CREATE OR REPLACE FUNCTION craft_mask(
  p_user text,
  p_mask text,
  p_gold_cost int,
  p_durability_cap int,
  p_ingredients jsonb DEFAULT '{}'::jsonb
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_gold int;
  v_item text;
  v_qty int;
BEGIN
  SELECT gold INTO v_gold FROM "User" WHERE id = p_user FOR UPDATE;
  IF v_gold IS NULL THEN
    RAISE EXCEPTION 'craft_mask: user % không tồn tại', p_user USING ERRCODE = 'foreign_key_violation';
  END IF;
  -- Mask chưa sở hữu (chống duplicate craft mất ingredients).
  IF EXISTS (SELECT 1 FROM "Mask" WHERE "userId" = p_user AND "maskId" = p_mask) THEN
    RAISE EXCEPTION 'craft_mask: đã sở hữu mask %', p_mask USING ERRCODE = 'check_violation';
  END IF;
  IF v_gold < p_gold_cost THEN
    RAISE EXCEPTION 'craft_mask: không đủ gold (cần %, có %)', p_gold_cost, v_gold
      USING ERRCODE = 'check_violation';
  END IF;
  UPDATE "User" SET gold = v_gold - p_gold_cost WHERE id = p_user;
  -- Deduct ingredients (transactional — fail 1 → rollback hết).
  FOR v_item, v_qty IN SELECT key, (value::text)::int FROM jsonb_each_text(p_ingredients)
  LOOP
    IF deduct_inventory(p_user, v_item, v_qty) IS NULL THEN
      RAISE EXCEPTION 'craft_mask: không đủ %', v_item USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;
  INSERT INTO "Mask" ("id", "userId", "maskId", "durability", "equipped")
  VALUES (gen_random_uuid()::text, p_user, p_mask, p_durability_cap, false);
END;
$$;
