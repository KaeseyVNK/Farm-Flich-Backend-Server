-- Review #7 (TOCTOU pool): steal_with_loss_cap từng tin p_pool từ caller
-- (finalize.ts đọc Inventory qty rồi truyền vào) — pool stale nếu victim
-- buy/sell/gift trong window read→RPC → cap 10%/25% tính trên pool lệch.
-- Fix: RPC tự đọc qty FOR UPDATE (lock Inventory row, serialize với mọi
-- deduct/add trên cùng row). p_pool giữ trong signature cho backward-compat
-- nhưng bị bỏ qua (caller không cần đổi; test cũ vẫn pass).

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
  v_per_raid int;
  v_day_remaining int;
  v_stealable int;
  v_new_qty int;
BEGIN
  -- Lock Inventory row TRƯỚC (serialize với marketplace_buy/gift/cancel refund).
  SELECT qty INTO v_new_qty FROM "Inventory"
  WHERE "userId" = p_owner AND "itemId" = p_item
  FOR UPDATE;
  IF v_new_qty IS NULL THEN
    RETURN NULL; -- victim không có item → caller skip (khớp contract cũ NULL = skip)
  END IF;

  -- Lock loss row FOR UPDATE (serialize concurrent raids cùng victim+ngày).
  SELECT COALESCE(amount, 0) INTO v_already
  FROM "RaidLossDaily"
  WHERE "ownerId" = p_owner AND date = v_today AND category = 'warehouse'
  FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO "RaidLossDaily" ("id", "ownerId", date, category, amount)
    VALUES (gen_random_uuid()::text, p_owner, v_today, 'warehouse', 0)
    ON CONFLICT ("ownerId", date, category) DO UPDATE SET amount = "RaidLossDaily".amount;
    SELECT COALESCE(amount, 0) INTO v_already
    FROM "RaidLossDaily"
    WHERE "ownerId" = p_owner AND date = v_today AND category = 'warehouse'
    FOR UPDATE;
  END IF;

  -- Caps tính trên POOL THẬT vừa lock (không còn stale).
  v_per_raid := floor(v_new_qty * p_per_raid_pct);
  v_day_remaining := GREATEST(0, floor(v_new_qty * p_per_day_pct) - v_already);
  v_stealable := GREATEST(0, LEAST(v_per_raid, v_day_remaining, p_requested));
  IF v_stealable <= 0 THEN
    RETURN 0;
  END IF;

  -- Deduct victim (row đã lock — luôn thành công khi v_stealable ≤ qty).
  UPDATE "Inventory" SET qty = qty - v_stealable
  WHERE "userId" = p_owner AND "itemId" = p_item
  RETURNING qty INTO v_new_qty;

  -- Bump loss tally (đã lock → không race).
  UPDATE "RaidLossDaily"
  SET amount = v_already + v_stealable
  WHERE "ownerId" = p_owner AND date = v_today AND category = 'warehouse';

  RETURN v_stealable;
END;
$$;
