-- Atomic per-day raid loss cap enforcement.
-- Trước đây finalize.ts đọc RaidLossDaily (SELECT) → compute stealable → upsert
-- amount=already+stealable ngoài transaction → concurrent raids cùng victim cùng
-- ngày bypass cap 25% (read-modify-write race). RPC này thực hiện deduct-victim +
-- cap-check + bump-loss trong 1 transaction với FOR UPDATE lock trên RaidLossDaily.
--
-- Trả về số lượng thực tế steal được (sau cap) — caller dùng để add_inventory cho thief.
-- Trả về NULL nếu victim không đủ qty (deduct fail) → caller skip item.
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
  -- Lock loss row FOR UPDATE (serialize concurrent raids cùng victim+ngày).
  SELECT COALESCE(amount, 0) INTO v_already
  FROM "RaidLossDaily"
  WHERE "ownerId" = p_owner AND date = v_today AND category = 'warehouse'
  FOR UPDATE;
  IF NOT FOUND THEN
    -- Row chưa tồn tại: INSERT placeholder + lock (cùng transaction).
    INSERT INTO "RaidLossDaily" ("ownerId", date, category, amount)
    VALUES (p_owner, v_today, 'warehouse', 0)
    ON CONFLICT ("ownerId", date, category) DO UPDATE SET amount = "RaidLossDaily".amount
    RETURNING amount INTO v_already;
    -- Re-lock sau upsert (ON CONFLICT path).
    SELECT COALESCE(amount, 0) INTO v_already
    FROM "RaidLossDaily"
    WHERE "ownerId" = p_owner AND date = v_today AND category = 'warehouse'
    FOR UPDATE;
  END IF;

  -- Per-day remaining = cap - already lost (bonus chỉ apply per-raid, không per-day).
  v_day_remaining := GREATEST(0, floor(p_pool * p_per_day_pct) - v_already);
  v_stealable := GREATEST(0, LEAST(v_per_raid, v_day_remaining, p_requested));
  IF v_stealable <= 0 THEN
    RETURN 0;
  END IF;

  -- Deduct victim atomic (NULL khi qty < delta — victim không đủ).
  SELECT deduct_inventory(p_owner, p_item, v_stealable) INTO v_new_qty;
  IF v_new_qty IS NULL THEN
    RETURN NULL;
  END IF;

  -- Bump loss tally (đã lock → không race).
  UPDATE "RaidLossDaily"
  SET amount = v_already + v_stealable
  WHERE "ownerId" = p_owner AND date = v_today AND category = 'warehouse';

  RETURN v_stealable;
END;
$$;
