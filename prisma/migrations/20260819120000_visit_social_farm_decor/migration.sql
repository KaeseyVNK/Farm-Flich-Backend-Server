-- W4 farm-visit social: FarmLike + VisitLog (like/sticker/guestbook, concept §14)
-- + Farm.placedDecor (visit render decor W3; DECOR_STEALABLE=false — raid không đọc).
-- Additive + idempotent — an toàn chạy lại trên staging (deploy migrate initContainer).
--
-- id DEFAULT gen_random_uuid()::text — insert qua supabase-js KHÔNG tự gen id
-- (precedent: 20260811070900_village_chat_id_default — NULL violation crash).

-- Farm.placedDecor: JSONB array PlacedDecor[] (đã sanitize client-side hydrate).
ALTER TABLE "Farm" ADD COLUMN IF NOT EXISTS "placedDecor" JSONB NOT NULL DEFAULT '[]';

-- FarmLike: 1 like / người / farm / ngày (UTC dayKey YYYYMMDD).
CREATE TABLE IF NOT EXISTS "FarmLike" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "farmOwnerId" TEXT NOT NULL,
  "visitorId" TEXT NOT NULL,
  "day" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "FarmLike_pkey" PRIMARY KEY ("id")
);
-- Tên index = Prisma @@unique expectation (tránh migrate-diff drift drop/recreate).
CREATE UNIQUE INDEX IF NOT EXISTS "FarmLike_farmOwnerId_visitorId_day_key" ON "FarmLike"("farmOwnerId", "visitorId", "day");
CREATE INDEX IF NOT EXISTS "FarmLike_farmOwnerId_idx" ON "FarmLike"("farmOwnerId");

-- VisitLog: dòng thời gian ghé thăm (visit/like/sticker/guestbook) — chủ đọc.
CREATE TABLE IF NOT EXISTS "VisitLog" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "farmOwnerId" TEXT NOT NULL,
  "visitorId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "stickerId" TEXT,
  "message" TEXT,
  "day" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "VisitLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "VisitLog_farmOwnerId_createdAt_idx" ON "VisitLog"("farmOwnerId", "createdAt");

-- Pre-existing fix (review W4 #pre): Friendship/GiftLog id TEXT không default —
-- supabase-js insert (sendRequestAction upsert) null-id fail theo repo migrations.
-- Thêm default additive, không đụng data cũ.
ALTER TABLE "Friendship" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "GiftLog" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;

-- RLS (guard auth schema prod Supabase — pattern progression_story_cloud_tables):
--   SELECT: chủ farm HOẶC bạn đã accepted (concept §4: ghé thăm chỉ bạn bè).
--   INSERT: visitor chính chủ + PHẢI là friend accepted — anon key public nên
--   DB policy là layer duy nhất không bypass được (PostgREST trực tiếp bỏ qua
--   server action sanitize/rate-limit). KHÔNG UPDATE/DELETE (append-only).
--   CREATE POLICY không có IF NOT EXISTS → DROP IF EXISTS trước (idempotent).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    ALTER TABLE "FarmLike" ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS farm_like_read ON "FarmLike";
    DROP POLICY IF EXISTS farm_like_insert ON "FarmLike";
    EXECUTE 'CREATE POLICY farm_like_read ON "FarmLike" FOR SELECT USING (auth.uid()::text = "farmOwnerId" OR EXISTS (SELECT 1 FROM "Friendship" f WHERE f.status = ''accepted'' AND ((f."userAId" = auth.uid()::text AND f."userBId" = "FarmLike"."farmOwnerId") OR (f."userBId" = auth.uid()::text AND f."userAId" = "FarmLike"."farmOwnerId"))))';
    EXECUTE 'CREATE POLICY farm_like_insert ON "FarmLike" FOR INSERT WITH CHECK (auth.uid()::text = "visitorId" AND EXISTS (SELECT 1 FROM "Friendship" f WHERE f.status = ''accepted'' AND ((f."userAId" = auth.uid()::text AND f."userBId" = "farmOwnerId") OR (f."userBId" = auth.uid()::text AND f."userAId" = "farmOwnerId"))))';

    ALTER TABLE "VisitLog" ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS visit_log_read ON "VisitLog";
    DROP POLICY IF EXISTS visit_log_insert ON "VisitLog";
    EXECUTE 'CREATE POLICY visit_log_read ON "VisitLog" FOR SELECT USING (auth.uid()::text = "farmOwnerId" OR EXISTS (SELECT 1 FROM "Friendship" f WHERE f.status = ''accepted'' AND ((f."userAId" = auth.uid()::text AND f."userBId" = "VisitLog"."farmOwnerId") OR (f."userBId" = auth.uid()::text AND f."userAId" = "VisitLog"."farmOwnerId"))))';
    EXECUTE 'CREATE POLICY visit_log_insert ON "VisitLog" FOR INSERT WITH CHECK (auth.uid()::text = "visitorId" AND EXISTS (SELECT 1 FROM "Friendship" f WHERE f.status = ''accepted'' AND ((f."userAId" = auth.uid()::text AND f."userBId" = "farmOwnerId") OR (f."userBId" = auth.uid()::text AND f."userAId" = "farmOwnerId"))))';
  END IF;
END $$;
