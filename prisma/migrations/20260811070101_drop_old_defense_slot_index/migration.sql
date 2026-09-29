-- Drop old standalone unique index (userId, slot) — audit C4 follow-up.
-- Migration 20260811070100 dùng DROP CONSTRAINT nhưng index này là standalone INDEX (không phải constraint),
-- nên DROP CONSTRAINT không xóa. Composite (userId, slot, type) đã thêm ở migration trước.
DROP INDEX IF EXISTS "DefenseConfig_userId_slot_key";
