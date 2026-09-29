-- Tạo 2 bảng ghost (đã khai báo trong schema.prisma từ phase 6/7 nhưng CHƯA
-- từng được migrate). `prisma migrate status` báo "up to date" vì production URL
-- không có shadow DB → không detect drift. Probe production: UserProgression +
-- UserStoryFlags "Could not find the table" → bảng không tồn tại thật.
--
-- Hệ quả: progression cloud sync (phase 6) + story cloud sync (phase 7) — kế thừa
-- cloud-sync-base — đều trỏ tới bảng không tồn tại. Hiện zero caller (local-only
-- ponytail) nên không có runtime error, nhưng bảng phải tồn tại trước khi wire
-- cloud sync. Migration này tạo bảng + RLS owner-only (khớp VillageChat pattern).

-- UserProgression: cloud-synced RPG progression (phase 6). LWW conflict (ADR-005).
CREATE TABLE IF NOT EXISTS "UserProgression" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "level" INTEGER NOT NULL DEFAULT 1,
  "xp" INTEGER NOT NULL DEFAULT 0,
  "totalXp" INTEGER NOT NULL DEFAULT 0,
  "skillPoints" INTEGER NOT NULL DEFAULT 0,
  "perkAllocations" JSONB NOT NULL DEFAULT '{}',
  "friendship" JSONB NOT NULL DEFAULT '{}',
  "version" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "UserProgression_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "UserProgression" ADD CONSTRAINT "UserProgression_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "UserProgression_userId_key" ON "UserProgression"("userId");
CREATE INDEX "UserProgression_userId_idx" ON "UserProgression"("userId");

-- UserStoryFlags: cloud-synced story flags (phase 7). RLS owner-only.
CREATE TABLE IF NOT EXISTS "UserStoryFlags" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "chapterId" TEXT NOT NULL DEFAULT 'ch1',
  "nodeId" TEXT NOT NULL DEFAULT 'start',
  "visitedNodes" JSONB NOT NULL DEFAULT '[]',
  "endingUnlocked" JSONB NOT NULL DEFAULT '[]',
  "version" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "UserStoryFlags_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "UserStoryFlags" ADD CONSTRAINT "UserStoryFlags_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "UserStoryFlags_userId_key" ON "UserStoryFlags"("userId");
CREATE INDEX "UserStoryFlags_userId_idx" ON "UserStoryFlags"("userId");

-- RLS owner-only (khớp VillageChat pattern, guard auth schema prod Supabase).
-- Chặn anon spoof userId: policy WITH CHECK auth.uid()::text = "userId".
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    ALTER TABLE "UserProgression" ENABLE ROW LEVEL SECURITY;
    EXECUTE 'CREATE POLICY user_progression_owner ON "UserProgression" FOR ALL USING (auth.uid()::text = "userId") WITH CHECK (auth.uid()::text = "userId")';

    ALTER TABLE "UserStoryFlags" ENABLE ROW LEVEL SECURITY;
    EXECUTE 'CREATE POLICY user_story_flags_owner ON "UserStoryFlags" FOR ALL USING (auth.uid()::text = "userId") WITH CHECK (auth.uid()::text = "userId")';
  END IF;
END $$;
