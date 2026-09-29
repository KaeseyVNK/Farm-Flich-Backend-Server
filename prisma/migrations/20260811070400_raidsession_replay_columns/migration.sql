-- C6: RaidSession persist mapId + thiefMaskId cho replay re-sim chính xác.
-- Trước đó /replay hardcode biome 'farm' + DEFAULT_MASK_EFFECT → diverge cho raid non-default.
ALTER TABLE "RaidSession" ADD COLUMN IF NOT EXISTS "mapId" TEXT;
ALTER TABLE "RaidSession" ADD COLUMN IF NOT EXISTS "thiefMaskId" TEXT;
