-- Visit selected pondFish but Farm had no such column (PostgREST 42703 →
-- visit mapped to "farm không tồn tại"). Pond fish are local-save only until this.
-- createdAt is the newbie-immunity clock: owner JSON gameMeta.day is spoofable.
-- Backfill from User.createdAt so existing farms keep their real age.

ALTER TABLE "Farm" ADD COLUMN IF NOT EXISTS "pondFish" JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "Farm" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE "Farm" AS f
SET "createdAt" = u."createdAt"
FROM "User" AS u
WHERE u.id = f."ownerId";
