-- Phase 8 F8.10 fix: VillageChat.id cần default — insert qua supabase-js không tự gen
-- TEXT uuid. Đổi type → uuid DEFAULT gen_random_uuid() (data cũ dạng TEXT chứa uuid hợp lệ
-- sẽ cast được; nếu có giá trị không phải uuid, migration sẽ fail — dự kiến không có).
ALTER TABLE "VillageChat"
  ALTER COLUMN "id" TYPE uuid USING "id"::uuid,
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
