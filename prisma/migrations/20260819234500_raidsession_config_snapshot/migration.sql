-- W7 audit-fix (debt replay): persist DefenseConfig snapshot vào RaidSession lúc raid START.
-- Trước đây /replay re-sim dùng config hardcode (1 dog giữa + 1 chest + 0 trap) —
-- lệch tick-exact so raid thật (dogs breed/patrol + traps + dogLevel/trapLevel).
-- Session cũ NULL → /replay fallback default cũ (không breaking).
ALTER TABLE "RaidSession" ADD COLUMN IF NOT EXISTS "configSnapshot" JSONB;
