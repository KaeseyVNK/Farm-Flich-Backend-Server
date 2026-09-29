-- Review F6: rate-limit DB-backed — in-memory Map per-process (PM2 instances:"max"
-- = limit × N worker; restart = reset). Bảng window-counter đơn giản: 1 row
-- (userId, kind, windowStart) với count. UPSERT atomic + check trong WHERE.
-- Không cần cron dọn: window cũ bị overwrite tự nhiên (ON CONFLICT), row rác
-- theo (userId×kind×window) bounded bởi traffic.

CREATE TABLE IF NOT EXISTS "RateWindow" (
  "id" text NOT NULL,
  "userId" text NOT NULL,
  "kind" text NOT NULL, -- chat | visit | guestbook | sticker
  "windowStart" timestamptz NOT NULL, -- đầu window 60s (UTC)
  "count" integer NOT NULL DEFAULT 0,
  CONSTRAINT "RateWindow_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RateWindow_user_kind_window_key"
  ON "RateWindow"("userId", "kind", "windowStart");

ALTER TABLE "RateWindow" ENABLE ROW LEVEL SECURITY;
-- Chỉ server action qua service-role/Prisma DIRECT_URL chạm bảng này — client
-- không grant gì (RLS enabled + no policy = deny-all cho anon/authenticated).

/**
 * Atomic window counter. Trả true nếu còn slot (đã tăng), false nếu vượt max.
 * Window 60s cố định, đủ dùng cho mọi kind hiện tại (chat 10, guestbook 3,
 * visit/sticker 10).
 */
CREATE OR REPLACE FUNCTION check_rate_window(
  p_user text,
  p_kind text,
  p_max int
) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE
  v_window timestamptz := date_trunc('minute', now());
  v_count int;
BEGIN
  INSERT INTO "RateWindow" ("id", "userId", "kind", "windowStart", "count")
  VALUES (gen_random_uuid()::text, p_user, p_kind, v_window, 1)
  ON CONFLICT ("userId", "kind", "windowStart")
  DO UPDATE SET "count" = "RateWindow"."count" + 1
  WHERE "RateWindow"."count" < p_max
  RETURNING "count" INTO v_count;

  -- INSERT mới thành công → RETURNING count=1. Conflict mà WHERE chặn → v_count NULL.
  IF v_count IS NULL THEN
    -- Có thể là INSERT path không trả row? Không — INSERT luôn RETURNING khi thành công.
    -- NULL = conflict + WHERE count < p_max false → vượt limit.
    RETURN false;
  END IF;
  RETURN true;
END;
$$;
