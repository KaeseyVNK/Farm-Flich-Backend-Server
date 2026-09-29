-- Phase 7 blood-moon raid: persist blood-moon flag vào RaidSession cho replay re-sim.
-- RaidRoom nhận `bloodMoon` constructor param → biome override (vision/hearing ×1.5,
-- decay ×0.9). Replay /replay cần biết flag để tái tạo biome đúng — nếu không,
-- re-sim dùng biome baseline ≠ live raid (diverge vision/decay).
ALTER TABLE "RaidSession" ADD COLUMN IF NOT EXISTS "bloodMoon" BOOLEAN NOT NULL DEFAULT false;
