-- Phase 8: VillageChat — social lobby chat. Realtime INSERT broadcast.
CREATE TABLE IF NOT EXISTS "VillageChat" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "msg" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VillageChat_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "VillageChat_createdAt_idx" ON "VillageChat"("createdAt" DESC);
