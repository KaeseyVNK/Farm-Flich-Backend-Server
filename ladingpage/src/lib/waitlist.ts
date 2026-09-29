export const GIFT_CODES = [
  "CHUNHAT_SOM",
  "THUHAI_SOM",
  "THUBA_SOM",
  "THUTU_SOM",
  "THUNAM_SOM",
  "THUSAU_SOM",
  "THUBAY_SOM",
] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ParseWaitlistResult =
  | { ok: true; email: string }
  | { ok: false; error: string };

export function parseWaitlistEmail(raw: string): ParseWaitlistResult {
  const email = raw.trim().toLowerCase();
  if (!email) {
    return { ok: false, error: "Nhập email để nhận thư khi game mở." };
  }
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return { ok: false, error: "Email chưa đúng định dạng." };
  }
  return { ok: true, email };
}

export function giftCodeForDate(date: Date = new Date()): string {
  return GIFT_CODES[date.getDay()];
}

export function msUntilEndOfLocalDay(date: Date = new Date()): number {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return Math.max(0, end.getTime() - date.getTime());
}

export function formatTimeLeft(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `còn ${h} giờ ${m} phút` : `còn ${m} phút`;
}
