-- Phase 6: Listing + Trade + marketplace_buy RPC atomic 7-step.
-- Fee 5% void (gold sink). Partial buy OK. Self-buy/expired/insufficient → RAISE rollback.

CREATE TABLE IF NOT EXISTS "Listing" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "priceUnit" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Listing_itemId_status_idx" ON "Listing"("itemId", "status");
CREATE INDEX IF NOT EXISTS "Listing_sellerId_status_idx" ON "Listing"("sellerId", "status");

CREATE TABLE IF NOT EXISTS "Trade" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "priceUnit" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "fee" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Trade_buyerId_idx" ON "Trade"("buyerId");

-- marketplace_buy(p_buyer, p_listing, p_qty): atomic 7-step.
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
  -- 1. Lock listing active.
  SELECT "sellerId", "itemId", qty, "priceUnit", "expiresAt"
  INTO v_seller, v_item, v_avail, v_price, v_expires
  FROM "Listing" WHERE id=p_listing AND status='active' FOR UPDATE;
  IF v_seller IS NULL THEN
    RAISE EXCEPTION 'marketplace_buy: listing không active' USING ERRCODE = 'check_violation';
  END IF;
  -- 2. Guards.
  IF v_seller = p_buyer THEN
    RAISE EXCEPTION 'marketplace_buy: không tự mua' USING ERRCODE = 'check_violation';
  END IF;
  IF v_avail < p_qty OR p_qty <= 0 THEN
    RAISE EXCEPTION 'marketplace_buy: qty không hợp lệ' USING ERRCODE = 'check_violation';
  END IF;
  IF now() >= v_expires THEN
    RAISE EXCEPTION 'marketplace_buy: listing hết hạn' USING ERRCODE = 'check_violation';
  END IF;
  -- 3. Compute total + fee 5%.
  v_total := v_price * p_qty;
  v_fee := v_total / 20;  -- floor 5%
  v_receive := v_total - v_fee;
  -- 4. Deduct buyer gold (RETURNING guard).
  UPDATE "User" SET gold = gold - v_total WHERE id = p_buyer AND gold >= v_total RETURNING 1 INTO v_upd;
  GET DIAGNOSTICS v_upd = ROW_COUNT;
  IF v_upd = 0 THEN
    RAISE EXCEPTION 'marketplace_buy: không đủ gold' USING ERRCODE = 'check_violation';
  END IF;
  -- 5. Add seller gold.
  UPDATE "User" SET gold = gold + v_receive WHERE id = v_seller;
  -- 6. Insert inventory buyer.
  INSERT INTO "Inventory" ("id", "userId", "itemId", "qty")
  VALUES (gen_random_uuid()::text, p_buyer, v_item, p_qty)
  ON CONFLICT ("userId", "itemId") DO UPDATE SET qty = "Inventory".qty + p_qty;
  -- 7. Update listing qty/status + Trade.
  UPDATE "Listing"
  SET qty = qty - p_qty, status = CASE WHEN qty - p_qty = 0 THEN 'sold' ELSE 'active' END
  WHERE id = p_listing;
  INSERT INTO "Trade" ("id", "buyerId", "sellerId", "itemId", "qty", "priceUnit", "total", "fee")
  VALUES (gen_random_uuid()::text, p_buyer, v_seller, v_item, p_qty, v_price, v_total, v_fee);
END;
$$;
