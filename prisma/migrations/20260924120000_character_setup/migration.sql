ALTER TABLE "User"
  ADD COLUMN "characterSetupRequired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "characterGender" TEXT,
  ADD COLUMN "characterAppearance" JSONB;
