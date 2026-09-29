-- Phase 6: expire_listing RPC atomic — sweep listing hết hạn + refund inventory.
-- bg job (marketplace-bg-job.ts) gọi định kỳ. Idempotent: chỉ đóng status='active' đã quá expiresAt.
CREATE OR REPLACE FUNCTION expire_listing(p_limit int DEFAULT 100)
RETURNS int LANGUAGE plpgsql AS $$
DECLARE
  v_row RECORD;
  v_done int := 0;
BEGIN
  FOR v_row IN
    SELECT id, "sellerId", "itemId", qty FROM "Listing"
    WHERE status = 'active' AND "expiresAt" <= now()
    ORDER BY "expiresAt"
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  LOOP
    -- Refund inventory atomic (chỉ khi thực sự đóng được active → race-safe).
    UPDATE "Listing"
    SET status = 'expired'
    WHERE id = v_row.id AND status = 'active';
    IF FOUND THEN
      PERFORM add_inventory(v_row."sellerId", v_row."itemId", v_row.qty);
      v_done := v_done + 1;
    END IF;
  END LOOP;
  RETURN v_done;
END;
$$;
