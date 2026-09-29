-- Phase 4: MaskRecipe table + craft_mask RPC atomic.
-- MaskRecipe seeded app-side (mask-catalog.ts). craft_mask: lock inv + check ingredients + deduct + INSERT Mask.

CREATE TABLE IF NOT EXISTS "MaskRecipe" (
    "id" TEXT NOT NULL,
    "maskId" TEXT NOT NULL,
    "tier" INTEGER NOT NULL DEFAULT 1,
    "ingredients" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "goldCost" INTEGER NOT NULL DEFAULT 0,
    "durabilityCap" INTEGER NOT NULL DEFAULT 10,
    CONSTRAINT "MaskRecipe_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MaskRecipe_maskId_key" ON "MaskRecipe"("maskId");

-- craft_mask(p_user, p_mask, p_durability_cap): kiểm tra User chưa sở hữu mask + deduct gold.
-- Ingredients check app-side (pattern deduct_inventory per item). RPC chỉ lock gold + insert Mask.
CREATE OR REPLACE FUNCTION craft_mask(
  p_user text,
  p_mask text,
  p_gold_cost int,
  p_durability_cap int
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_gold int;
BEGIN
  SELECT gold INTO v_gold FROM "User" WHERE id = p_user FOR UPDATE;
  IF v_gold IS NULL THEN
    RAISE EXCEPTION 'craft_mask: user % không tồn tại', p_user USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF v_gold < p_gold_cost THEN
    RAISE EXCEPTION 'craft_mask: không đủ gold (cần %, có %)', p_gold_cost, v_gold
      USING ERRCODE = 'check_violation';
  END IF;
  UPDATE "User" SET gold = v_gold - p_gold_cost WHERE id = p_user;
  INSERT INTO "Mask" ("id", "userId", "maskId", "durability", "equipped")
  VALUES (gen_random_uuid()::text, p_user, p_mask, p_durability_cap, false)
  ON CONFLICT ("userId", "maskId") DO NOTHING;
END;
$$;
