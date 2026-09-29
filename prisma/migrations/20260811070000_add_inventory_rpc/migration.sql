-- add_inventory: atomic increment (mirror deduct_inventory).
-- INSERT mới HOẶC increment qty hiện có. Trả về qty mới.
-- Fix C3: finalize thief loot — trước đó upsert OVERWRITE (thief có 10 iron + steal 3 → mất 7).
CREATE OR REPLACE FUNCTION add_inventory(p_user text, p_item text, p_delta int)
RETURNS int LANGUAGE sql AS $$
  INSERT INTO "Inventory" ("id", "userId", "itemId", "qty")
  VALUES (gen_random_uuid()::text, p_user, p_item, p_delta)
  ON CONFLICT ("userId", "itemId") DO UPDATE SET qty = "Inventory".qty + p_delta
  RETURNING qty;
$$;
