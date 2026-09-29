-- REVOKE EXECUTE FROM anon cho add_inventory + deduct_inventory (defense-in-depth).
-- Loop 9 delta guard chặn exploit sign-flip (p_delta âm = add vô hạn) NHƯNG RPC
-- vẫn client-callable (Supabase default grant EXECUTE to anon). IDOR hiện có:
-- attacker login A → POST /rpc/add_inventory {p_user: victimUid, ...} → +item
-- cho victim bất kỳ (hoặc self-bypass crafting). Delta guard không chặn IDOR.
--
-- Fix: REVOKE EXECUTE FROM anon. authenticated + service_role vẫn GRANT (server
-- action dùng authenticated key từ cookie session, raid-server dùng service-role).
-- Client path (craft_mask, gift_item, create_listing) gọi add/deduct NỘI BỘ
-- trong RPC guarded → không cần client gọi add/deduct trực tiếp.
--
-- Roles anon/authenticated chỉ tồn tại trong Supabase (không có trong docker
-- postgres test). DO block idempotent: chỉ REVOKE/GRANT khi role tồn tại.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE EXECUTE ON FUNCTION add_inventory(text, text, int) FROM anon;
    REVOKE EXECUTE ON FUNCTION deduct_inventory(text, text, int) FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION add_inventory(text, text, int) TO authenticated;
    GRANT EXECUTE ON FUNCTION deduct_inventory(text, text, int) TO authenticated;
  END IF;
END $$;
-- ponytail ceiling: full RLS trên economy tables (loop 8 D1 / F1 loop 10) =
-- trust-boundary thực. REVOKE EXECUTE = band-aid; RLS = root fix. Product
-- decision khi rollout RLS migration.
