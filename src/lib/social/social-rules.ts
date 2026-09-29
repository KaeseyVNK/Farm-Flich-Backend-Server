// W4 — pure rules cho farm-visit social (like/sticker/guestbook).
// Không import DB/React — unit test trực tiếp. Service layer (social-service)
// bọc các rule này quanh Supabase calls.

/** 12 sticker cố định (id ổn định để đếm tally + i18n sau). */
export const STICKER_IDS = [
  "heart", "star", "laugh", "gift", "flower", "sun",
  "moon", "fish", "cat", "dog", "party", "thumb",
] as const;
export type StickerId = (typeof STICKER_IDS)[number];

export function isStickerId(id: string): id is StickerId {
  return (STICKER_IDS as readonly string[]).includes(id);
}

export const GUESTBOOK_MAX_CHARS = 200;
/**
 * Chủ farm hiển thị N tin gần nhất (UI cap — panel limit 50). KHÔNG trim DB:
 * VisitLog append-only (RLS không có DELETE) — giữ toàn bộ làm audit trail.
 */
export const GUESTBOOK_KEEP = 50;
/** 1 tin / lượt visit — service enforce bằng visit-key; rules chỉ giới hạn độ dài. */
export const GUESTBOOK_RATE_MAX = 3; // /phút

export const VISIT_LOG_KINDS = ["visit", "like", "sticker", "guestbook"] as const;
export type VisitLogKind = (typeof VISIT_LOG_KINDS)[number];

/**
 * Sanitize lời nhắn guestbook: trim + bỏ control chars (giữ \n thành space —
 * guestbook hiển thị 1 dòng), collapse spaces, chặn >200 ký tự (truncate KHÔNG
 * reject — người chơi không mất lời nhắn vì gõ dài). Return null khi rỗng.
 */
export function sanitizeGuestbookMessage(raw: string): string | null {
  // bỏ control chars (0x00-0x1F, 0x7F) — chống glitch UI/render-null chars
  const stripped = raw.replace(/[\x00-\x1f\x7f]/g, " ");
  const collapsed = stripped.replace(/\s+/g, " ").trim();
  if (collapsed.length === 0) return null;
  return collapsed.slice(0, GUESTBOOK_MAX_CHARS);
}

/**
 * Day-key dedupe like: 1 like / người / farm / NGÀY (UTC). Server tính —
 * client KHÔNG truyền day (anti-abuse: đổi ngày client để spam like).
 * Dạng YYYYMMDD (20260819) làm Int column — so sánh/index rẻ.
 */
export function dayKey(d: Date = new Date()): number {
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}
