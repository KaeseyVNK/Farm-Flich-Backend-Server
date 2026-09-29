-- equip_mask atomic: set equipped=true cho 1 mask, false cho còn lại trong 1 tx.
-- Trước đây server action 2 statement riêng (update all false → update one true):
-- nếu statement 2 fail (network) → user mất hết equipped mask, finalize_raid
-- resolve maskId="rogue" mặc định (sai). Single tx chặn partial state.
-- p_user phải khớp auth.uid() — trust boundary (RPC callable trực tiếp qua REST).
CREATE OR REPLACE FUNCTION equip_mask(
  p_user text,
  p_mask text
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF auth.uid()::text <> p_user THEN
    RAISE EXCEPTION 'equip_mask: user mismatch' USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE "Mask" SET equipped = ("maskId" = p_mask) WHERE "userId" = p_user;
END;
$$;
