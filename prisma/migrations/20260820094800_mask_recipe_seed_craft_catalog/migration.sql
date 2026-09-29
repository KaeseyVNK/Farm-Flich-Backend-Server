-- Seed MaskRecipe from mask-catalog.ts. craft_mask ignores client gold/ingredients/
-- durability and reads the catalog row. Tier 2 requires Reputation.thief >= 50.

INSERT INTO "MaskRecipe" ("id", "maskId", "tier", "ingredients", "goldCost", "durabilityCap")
VALUES
  ('rogue', 'rogue', 1, '{"wood": 10}'::jsonb, 100, 10),
  ('phantom', 'phantom', 1, '{"fiber": 10, "sap": 3}'::jsonb, 200, 10),
  ('bandit', 'bandit', 1, '{"stone": 12}'::jsonb, 200, 10),
  ('scout', 'scout', 1, '{"wood": 5, "fiber": 8}'::jsonb, 150, 10),
  ('rogue2', 'rogue2', 2, '{}'::jsonb, 1200, 20),
  ('phantom2', 'phantom2', 2, '{}'::jsonb, 1000, 20),
  ('bandit2', 'bandit2', 2, '{}'::jsonb, 1000, 20),
  ('scout2', 'scout2', 2, '{}'::jsonb, 900, 20)
ON CONFLICT ("maskId") DO UPDATE SET
  "tier" = EXCLUDED."tier",
  "ingredients" = EXCLUDED."ingredients",
  "goldCost" = EXCLUDED."goldCost",
  "durabilityCap" = EXCLUDED."durabilityCap";

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
  v_cost int;
  v_cap int;
  v_ing jsonb;
  v_tier int;
  v_thief int;
BEGIN
  IF auth.uid()::text <> p_user THEN
    RAISE EXCEPTION 'craft_mask: user mismatch' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT "goldCost", "durabilityCap", ingredients, tier
    INTO v_cost, v_cap, v_ing, v_tier
  FROM "MaskRecipe" WHERE "maskId" = p_mask;
  IF v_cost IS NULL THEN
    RAISE EXCEPTION 'craft_mask: unknown mask' USING ERRCODE = 'check_violation';
  END IF;
  IF v_tier >= 2 THEN
    SELECT COALESCE(thief, 0) INTO v_thief FROM "Reputation" WHERE "userId" = p_user;
    IF COALESCE(v_thief, 0) < 50 THEN
      RAISE EXCEPTION 'craft_mask: thief reputation < 50' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  SELECT gold INTO v_gold FROM "User" WHERE id = p_user FOR UPDATE;
  IF v_gold IS NULL THEN
    RAISE EXCEPTION 'craft_mask: user % không tồn tại', p_user USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM "Mask" WHERE "userId" = p_user AND "maskId" = p_mask) THEN
    RAISE EXCEPTION 'craft_mask: đã sở hữu mask %', p_mask USING ERRCODE = 'check_violation';
  END IF;
  IF v_gold < v_cost THEN
    RAISE EXCEPTION 'craft_mask: không đủ gold (cần %, có %)', v_cost, v_gold
      USING ERRCODE = 'check_violation';
  END IF;
  UPDATE "User" SET gold = v_gold - v_cost WHERE id = p_user;
  FOR v_item, v_qty IN SELECT key, (value::text)::int FROM jsonb_each_text(COALESCE(v_ing, '{}'::jsonb))
  LOOP
    IF v_qty IS NULL OR v_qty <= 0 THEN
      CONTINUE;
    END IF;
    IF deduct_inventory(p_user, v_item, v_qty) IS NULL THEN
      RAISE EXCEPTION 'craft_mask: không đủ %', v_item USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;
  INSERT INTO "Mask" ("id", "userId", "maskId", "durability", "equipped")
  VALUES (gen_random_uuid()::text, p_user, p_mask, v_cap, false);
END;
$$;

CREATE OR REPLACE FUNCTION steal_with_loss_cap(
  p_owner text,
  p_item text,
  p_requested int,
  p_pool int,
  p_per_raid_pct double precision DEFAULT 0.1,
  p_per_day_pct double precision DEFAULT 0.25
) RETURNS int LANGUAGE plpgsql AS $$
DECLARE
  v_already int;
  v_today date := now() AT TIME ZONE 'UTC';
  v_per_raid int := floor(p_pool * p_per_raid_pct);
  v_day_remaining int;
  v_stealable int;
  v_new_qty int;
BEGIN
  IF p_item LIKE 'ket_%' THEN
    RETURN 0;
  END IF;
  SELECT COALESCE(amount, 0) INTO v_already
  FROM "RaidLossDaily"
  WHERE "ownerId" = p_owner AND date = v_today AND category = 'warehouse'
  FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO "RaidLossDaily" ("ownerId", date, category, amount)
    VALUES (p_owner, v_today, 'warehouse', 0)
    ON CONFLICT ("ownerId", date, category) DO UPDATE SET amount = "RaidLossDaily".amount
    RETURNING amount INTO v_already;
    SELECT COALESCE(amount, 0) INTO v_already
    FROM "RaidLossDaily"
    WHERE "ownerId" = p_owner AND date = v_today AND category = 'warehouse'
    FOR UPDATE;
  END IF;

  v_day_remaining := GREATEST(0, floor(p_pool * p_per_day_pct) - v_already);
  v_stealable := GREATEST(0, LEAST(v_per_raid, v_day_remaining, p_requested));
  IF v_stealable <= 0 THEN
    RETURN 0;
  END IF;

  SELECT deduct_inventory(p_owner, p_item, v_stealable) INTO v_new_qty;
  IF v_new_qty IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE "RaidLossDaily"
  SET amount = v_already + v_stealable
  WHERE "ownerId" = p_owner AND date = v_today AND category = 'warehouse';

  RETURN v_stealable;
END;
$$;
