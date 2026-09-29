-- upsert_trap atomic: cap check + insert/update trong 1 tx với User row FOR UPDATE.
-- Trước đây defense-config-service.ts: count (read) → upsert (write) RMW race.
-- 2 concurrent upsert khác slot cùng đọc count=5 < 6 → cả hai pass → 8 trap.
-- Pattern khớp spend_defense_xp / steal_with_loss_cap (FOR UPDATE sentinel).
-- Auth guard: p_user phải khớp auth.uid() (trust boundary, client-callable).
-- Cap 6 (TRAP_CAP_PER_FARM) áp dụng chỉ type='trap', exclude slot đang upsert.
CREATE OR REPLACE FUNCTION upsert_trap(
  p_user text,
  p_slot int,
  p_payload jsonb
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_dummy int;
  v_count int;
BEGIN
  IF auth.uid()::text <> p_user THEN
    RAISE EXCEPTION 'upsert_trap: user mismatch' USING ERRCODE = 'insufficient_privilege';
  END IF;
  -- Lock User row: serialize tất cả trap ops per-user (ms-scale, negligible).
  SELECT 1 INTO v_dummy FROM "User" WHERE id = p_user FOR UPDATE;
  IF v_dummy IS NULL THEN
    RAISE EXCEPTION 'upsert_trap: user % không tồn tại', p_user USING ERRCODE = 'foreign_key_violation';
  END IF;
  -- Count trap hiện tại (exclude slot đang upsert — giữ logic cũ).
  SELECT count(*) INTO v_count FROM "DefenseConfig"
  WHERE "userId" = p_user AND type = 'trap' AND slot <> p_slot;
  IF v_count >= 6 THEN
    RAISE EXCEPTION 'upsert_trap: vượt cap 6 trap/farm' USING ERRCODE = 'check_violation';
  END IF;
  -- Upsert (composite unique userId_slot_type).
  INSERT INTO "DefenseConfig" ("id", "userId", "slot", "type", "payload", "updatedAt")
  VALUES (gen_random_uuid()::text, p_user, p_slot, 'trap', p_payload, now())
  ON CONFLICT ("userId", "slot", "type") DO UPDATE
    SET payload = p_payload, "updatedAt" = now();
END;
$$;
