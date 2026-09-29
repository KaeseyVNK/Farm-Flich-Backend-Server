import { db } from "@/lib/db";

/**
 * Rate-limit DB-backed (review F6) — thay in-memory Map per-process cho các
 * server action web (chat/visit/guestbook/sticker). PM2 instances:"max" từng làm
 * limit × N worker; restart reset. Window 60s cố định, atomic UPSERT.
 *
 * Fail-open khi DB lỗi? KHÔNG — rate-limit fail-closed an toàn hơn (spam chặn
 * nhầm user hiếm hơn spam xuyên thủng). Caller bọc error → trả "rate-limited".
 */

const KIND_LIMITS = {
  chat: 10,
  visit: 10,
  sticker: 10,
  guestbook: 3,
} as const;

export type RateKind = keyof typeof KIND_LIMITS;

/** True nếu còn slot trong window hiện tại (đã consume 1 slot). */
export async function checkRateLimitDb(userId: string, kind: RateKind): Promise<boolean> {
  const max = KIND_LIMITS[kind];
  const rows = await db.$queryRaw<{ check_rate_window: boolean }[]>`
    SELECT check_rate_window(${userId}::text, ${kind}::text, ${max}::int)`;
  return rows[0]?.check_rate_window === true;
}

/** Test helper — dọn bảng. */
export async function resetRateWindowsForTest(): Promise<void> {
  await db.$executeRaw`DELETE FROM "RateWindow"`;
}
