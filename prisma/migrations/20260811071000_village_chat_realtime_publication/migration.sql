-- Phase 8 F8.10 fix: thêm VillageChat vào supabase_realtime publication.
-- Thiếu publication → postgres_changes không broadcast INSERT → chat chỉ lưu DB,
-- client không nhận realtime push. Cần REPLICA IDENTITY FULL để payload đủ cột.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER TABLE "VillageChat" REPLICA IDENTITY FULL;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'VillageChat'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE "VillageChat";
    END IF;
  END IF;
END $$;
