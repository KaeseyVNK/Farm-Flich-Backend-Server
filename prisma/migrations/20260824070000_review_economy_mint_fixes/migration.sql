-- Code-review parallel audit (2026-08-24) — Critical economy-mint fixes:
-- C3 spend_defense_xp: p_level âm bypass level-check khi chưa có row
--    (v_existing IS NULL → v_existing >= p_level = NULL→false) → XP mint.
-- C4 create_listing: không validate p_price → giá âm + marketplace_buy sign-blind
--    `gold - v_total` = gold print 2 tài khoản. Band ±60% app-layer only.
-- C2 add_inventory/deduct_inventory: GRANT authenticated cho phép self-mint item
--    qua /rpc trực tiếp. Client path chỉ cần nội bộ trong guarded RPC → REVOKE
--    authenticated, giữ service_role (raid-server loot/finalize).
-- C6 User RLS FOR ALL cho phép PATCH cột gold của chính mình qua REST → column-level
--    UPDATE grant chỉ cho server role.

-- ── C3: spend_defense_xp — clamp level ≥1 + guard âm ─────────────────────────
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
  IF p_level IS NULL OR p_level < 1 OR p_level > 3 THEN
    RAISE EXCEPTION 'spend_defense_xp: level phải 1-3' USING ERRCODE = 'check_violation';
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

-- ── C4: create_listing — price > 0 + band ±60% NPC (mirror npc-shop-prices) ──
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
  -- Band ±60% quanh giá NPC (sync src/lib/game/npc-shop-prices.ts PRICE_BAND=0.6).
  -- Item ngoài bảng → default 10 (floor 4 / ceiling 16) khớp client logic.
  v_floor numeric;
  v_ceiling numeric;
BEGIN
  IF auth.uid()::text <> p_seller THEN
    RAISE EXCEPTION 'create_listing: user mismatch' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_price IS NULL OR p_price <= 0 THEN
    RAISE EXCEPTION 'create_listing: giá phải > 0' USING ERRCODE = 'check_violation';
  END IF;
  IF p_qty IS NULL OR p_qty <= 0 THEN
    RAISE EXCEPTION 'create_listing: qty phải > 0' USING ERRCODE = 'check_violation';
  END IF;
  v_floor := GREATEST(1, FLOOR(COALESCE((
      CASE p_item
        WHEN 'wood' THEN 5 WHEN 'stone' THEN 8 WHEN 'iron' THEN 15
        WHEN 'cloth' THEN 12 WHEN 'gem' THEN 50 WHEN 'gold_ore' THEN 30
        WHEN 'parsnip' THEN 35 WHEN 'potato' THEN 80 WHEN 'tomato' THEN 60
        ELSE 10
      END
    ), 10) * 0.4));
  v_ceiling := CEIL(COALESCE((
      CASE p_item
        WHEN 'wood' THEN 5 WHEN 'stone' THEN 8 WHEN 'iron' THEN 15
        WHEN 'cloth' THEN 12 WHEN 'gem' THEN 50 WHEN 'gold_ore' THEN 30
        WHEN 'parsnip' THEN 35 WHEN 'potato' THEN 80 WHEN 'tomato' THEN 60
        ELSE 10
      END
    ), 10) * 1.6);
  IF p_price < v_floor OR p_price > v_ceiling THEN
    RAISE EXCEPTION 'create_listing: giá % ngoài band [%-%]', p_price, v_floor, v_ceiling
      USING ERRCODE = 'check_violation';
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

-- ── C2: inventory building-block RPCs — service-role only ────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE EXECUTE ON FUNCTION add_inventory(text, text, int) FROM authenticated;
    REVOKE EXECUTE ON FUNCTION deduct_inventory(text, text, int) FROM authenticated;
  END IF;
END $$;

-- ── C6: User.gold column — chặn REST PATCH gold của chính mình ───────────────
-- RLS row-level vẫn FOR ALL owner; đây là column-level grant: authenticated mất
-- UPDATE trên cột nhạy cảm (gold, defenseXp, defenseXpToday, migratedAt).
-- Prisma/server action chạy cùng role authenticated... NHƯNG mọi write gold hợp lệ
-- đã đi qua RPC security-definer (craft_mask/marketplace_buy/place_bounty/
-- finalize_raid service-role) hoặc Prisma DIRECT_URL (service role bypass RLS +
-- grants) → revoke an toàn với flow hiện tại.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE UPDATE ("gold") ON TABLE "User" FROM authenticated;
    REVOKE UPDATE ("defenseXp") ON TABLE "User" FROM authenticated;
    REVOKE UPDATE ("defenseXpToday") ON TABLE "User" FROM authenticated;
    REVOKE UPDATE ("defenseXpDate") ON TABLE "User" FROM authenticated;
    REVOKE UPDATE ("migratedAt") ON TABLE "User" FROM authenticated;
  END IF;
END $$;
