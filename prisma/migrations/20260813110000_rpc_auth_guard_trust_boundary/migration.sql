-- Auth guard cho client-callable RPC (trust boundary). Trước đây RPC nhận p_user/
-- p_buyer/p_seller/p_from không check auth.uid() → attacker login 1 account,
-- cẩm anon JWT gọi thẳng /rpc/<fn> với p_user=victimUid → deduct victim gold/
-- inventory. Server action verify session + truyền uid chính user, nhưng RPC
-- callable trực tiếp qua REST với anon key (lộ client).
--
-- Guard: mỗi RPC thêm `IF auth.uid()::text <> p_<user> THEN RAISE insufficient_privilege`.
-- Raid-server RPC (finalize_raid, steal_with_loss_cap, add_inventory) dùng
-- service-role key (bypass auth.uid()) — KHÔNG guard ở đây, chỉ guard client RPC.
--
-- ponytail: full RLS trên economy tables = infra work lớn, cần product decision.
-- Guard per-RPC là biện pháp tối thiểu chặn IDOR hiện có.

-- craft_mask: p_user (signature 5-param mới nhất từ 20260811070301 + guard)
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
  IF auth.uid()::text <> p_user THEN
    RAISE EXCEPTION 'craft_mask: user mismatch' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT gold INTO v_gold FROM "User" WHERE id = p_user FOR UPDATE;
  IF v_gold IS NULL THEN
    RAISE EXCEPTION 'craft_mask: user % không tồn tại', p_user USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM "Mask" WHERE "userId" = p_user AND "maskId" = p_mask) THEN
    RAISE EXCEPTION 'craft_mask: đã sở hữu mask %', p_mask USING ERRCODE = 'check_violation';
  END IF;
  IF v_gold < p_gold_cost THEN
    RAISE EXCEPTION 'craft_mask: không đủ gold (cần %, có %)', p_gold_cost, v_gold
      USING ERRCODE = 'check_violation';
  END IF;
  UPDATE "User" SET gold = v_gold - p_gold_cost WHERE id = p_user;
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

-- marketplace_buy: p_buyer
CREATE OR REPLACE FUNCTION marketplace_buy(
  p_buyer text, p_listing text, p_qty int
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_seller text;
  v_item text;
  v_avail int;
  v_price int;
  v_expires timestamptz;
  v_total int;
  v_fee int;
  v_receive int;
  v_upd int;
BEGIN
  IF auth.uid()::text <> p_buyer THEN
    RAISE EXCEPTION 'marketplace_buy: user mismatch' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT "sellerId", "itemId", qty, "priceUnit", "expiresAt"
  INTO v_seller, v_item, v_avail, v_price, v_expires
  FROM "Listing" WHERE id=p_listing AND status='active' FOR UPDATE;
  IF v_seller IS NULL THEN
    RAISE EXCEPTION 'marketplace_buy: listing không active' USING ERRCODE = 'check_violation';
  END IF;
  IF v_seller = p_buyer THEN
    RAISE EXCEPTION 'marketplace_buy: không tự mua' USING ERRCODE = 'check_violation';
  END IF;
  IF v_avail < p_qty OR p_qty <= 0 THEN
    RAISE EXCEPTION 'marketplace_buy: qty không hợp lệ' USING ERRCODE = 'check_violation';
  END IF;
  IF now() >= v_expires THEN
    RAISE EXCEPTION 'marketplace_buy: listing hết hạn' USING ERRCODE = 'check_violation';
  END IF;
  v_total := v_price * p_qty;
  v_fee := v_total / 20;
  v_receive := v_total - v_fee;
  UPDATE "User" SET gold = gold - v_total WHERE id = p_buyer AND gold >= v_total RETURNING 1 INTO v_upd;
  GET DIAGNOSTICS v_upd = ROW_COUNT;
  IF v_upd = 0 THEN
    RAISE EXCEPTION 'marketplace_buy: không đủ gold' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE "User" SET gold = gold + v_receive WHERE id = v_seller;
  INSERT INTO "Inventory" ("id", "userId", "itemId", "qty")
  VALUES (gen_random_uuid()::text, p_buyer, v_item, p_qty)
  ON CONFLICT ("userId", "itemId") DO UPDATE SET qty = "Inventory".qty + p_qty;
  UPDATE "Listing"
  SET qty = qty - p_qty, status = CASE WHEN qty - p_qty = 0 THEN 'sold' ELSE 'active' END
  WHERE id = p_listing;
  INSERT INTO "Trade" ("id", "buyerId", "sellerId", "itemId", "qty", "priceUnit", "total", "fee")
  VALUES (gen_random_uuid()::text, p_buyer, v_seller, v_item, p_qty, v_price, v_total, v_fee);
END;
$$;

-- create_listing: p_seller
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
  IF auth.uid()::text <> p_seller THEN
    RAISE EXCEPTION 'create_listing: user mismatch' USING ERRCODE = 'insufficient_privilege';
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

-- cancel_listing: p_user (giữ sellerId check hiện có + thêm auth guard)
CREATE OR REPLACE FUNCTION cancel_listing(
  p_listing text,
  p_user text
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_row RECORD;
  v_rows int;
BEGIN
  IF auth.uid()::text <> p_user THEN
    RAISE EXCEPTION 'cancel_listing: user mismatch' USING ERRCODE = 'insufficient_privilege';
  END IF;
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
  PERFORM add_inventory(p_user, v_row."itemId", v_row.qty);
  UPDATE "Listing" SET status = 'cancelled' WHERE id = p_listing AND status = 'active';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION 'cancel_listing: race — listing đã đổi trạng thái' USING ERRCODE = 'check_violation';
  END IF;
END;
$$;

-- spend_defense_xp: p_user
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
  IF auth.uid()::text <> p_user THEN
    RAISE EXCEPTION 'spend_defense_xp: user mismatch' USING ERRCODE = 'insufficient_privilege';
  END IF;
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
  INSERT INTO "DefenseConfig" ("id", "userId", "slot", "type", "payload", "updatedAt")
  VALUES (gen_random_uuid()::text, p_user, p_slot, p_target, jsonb_build_object('level', p_level), now())
  ON CONFLICT ("userId", "slot", "type") DO UPDATE
    SET payload = "DefenseConfig".payload || jsonb_build_object('level', p_level),
        "updatedAt" = now();
END;
$$;

-- gift_item: p_from (p_to không cần guard — nhận gift là passively safe)
CREATE OR REPLACE FUNCTION gift_item(
  p_from text, p_to text, p_item text, p_qty int
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_friend int;
  v_today_count int;
  v_new_qty int;
BEGIN
  IF auth.uid()::text <> p_from THEN
    RAISE EXCEPTION 'gift_item: user mismatch' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT 1 INTO v_friend FROM "Friendship"
  WHERE status='accepted' AND (
    ("userAId"=p_from AND "userBId"=p_to) OR ("userAId"=p_to AND "userBId"=p_from)
  ) FOR UPDATE;
  IF v_friend IS NULL THEN
    RAISE EXCEPTION 'gift_item: không phải bạn bè' USING ERRCODE = 'check_violation';
  END IF;
  SELECT count(*) INTO v_today_count FROM "GiftLog"
  WHERE "fromId"=p_from AND "toId"=p_to AND "createdAt" >= CURRENT_DATE;
  IF v_today_count >= 5 THEN
    RAISE EXCEPTION 'gift_item: vượt cap 5/ngày' USING ERRCODE = 'check_violation';
  END IF;
  IF p_item LIKE 'tool_%' OR p_item LIKE 'quest_%' OR p_item LIKE 'ket_%' OR p_item LIKE 'gold%' THEN
    RAISE EXCEPTION 'gift_item: item % không được gift', p_item USING ERRCODE = 'check_violation';
  END IF;
  SELECT deduct_inventory(p_from, p_item, p_qty) INTO v_new_qty;
  IF v_new_qty IS NULL THEN
    RAISE EXCEPTION 'gift_item: không đủ %', p_item USING ERRCODE = 'check_violation';
  END IF;
  INSERT INTO "Inventory" ("id", "userId", "itemId", "qty")
  VALUES (gen_random_uuid()::text, p_to, p_item, p_qty)
  ON CONFLICT ("userId", "itemId") DO UPDATE SET qty = "Inventory".qty + p_qty;
  INSERT INTO "GiftLog" ("id", "fromId", "toId", "itemId", "qty")
  VALUES (gen_random_uuid()::text, p_from, p_to, p_item, p_qty);
END;
$$;
