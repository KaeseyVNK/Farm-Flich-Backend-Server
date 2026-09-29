-- M1: VillageChat RLS — chặn anon spoof userId (Supabase prod).
-- Guard auth schema (local docker không có → skip, prod Supabase có → apply).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    ALTER TABLE "VillageChat" ENABLE ROW LEVEL SECURITY;
    EXECUTE 'CREATE POLICY village_chat_select ON "VillageChat" FOR SELECT USING (true)';
    EXECUTE 'CREATE POLICY village_chat_insert ON "VillageChat" FOR INSERT WITH CHECK (auth.uid()::text = "userId")';
  END IF;
END $$;
