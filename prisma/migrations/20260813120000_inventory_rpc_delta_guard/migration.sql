-- Guard delta > 0 cho add_inventory + deduct_inventory (building-block RPC).
-- Trước đây:
-- - deduct_inventory(p_delta âm): WHERE qty >= p_delta luôn true (qty >= -5),
--   `qty - p_delta` = qty+5 → âm delta = ADD vô hạn (exploit nếu client gọi trực tiếp).
-- - add_inventory(p_delta âm): qty + p_delta = subtract không check → qty âm.
-- Cả 2 RPC client-callable (no REVOKE EXECUTE, Supabase default grant anon).
-- Auth guard không khả thi: dual caller — client (gift_item có auth.uid) +
-- raid-server service-role (steal_with_loss_cap, auth.uid=null). Service-role
-- auth.uid()=null → guard `null <> p_user` RAISE → phá raid loot. Chỉ guard
-- delta > 0 (local, không phụ thuộc caller) chặn exploit chính.
-- ponytail: REVOKE EXECUTE từ anon cho 2 RPC này = defense-in-depth, cần verify
-- không break server action (dùng authenticated key).

CREATE OR REPLACE FUNCTION deduct_inventory(p_user text, p_item text, p_delta int)
RETURNS int LANGUAGE plpgsql AS $$
DECLARE
  v_qty int;
BEGIN
  IF p_delta IS NULL OR p_delta <= 0 THEN
    RAISE EXCEPTION 'deduct_inventory: delta phải > 0' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE "Inventory" SET qty = qty - p_delta
  WHERE "userId" = p_user AND "itemId" = p_item AND qty >= p_delta
  RETURNING qty INTO v_qty;
  RETURN v_qty;
END;
$$;

CREATE OR REPLACE FUNCTION add_inventory(p_user text, p_item text, p_delta int)
RETURNS int LANGUAGE plpgsql AS $$
DECLARE
  v_qty int;
BEGIN
  IF p_delta IS NULL OR p_delta <= 0 THEN
    RAISE EXCEPTION 'add_inventory: delta phải > 0' USING ERRCODE = 'check_violation';
  END IF;
  INSERT INTO "Inventory" ("id", "userId", "itemId", "qty")
  VALUES (gen_random_uuid()::text, p_user, p_item, p_delta)
  ON CONFLICT ("userId", "itemId") DO UPDATE SET qty = "Inventory".qty + p_delta
  RETURNING qty INTO v_qty;
  RETURN v_qty;
END;
$$;
