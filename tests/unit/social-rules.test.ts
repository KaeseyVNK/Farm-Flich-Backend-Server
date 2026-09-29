import { describe, it, expect } from "vitest";
import {
  STICKER_IDS,
  isStickerId,
  GUESTBOOK_MAX_CHARS,
  GUESTBOOK_KEEP,
  sanitizeGuestbookMessage,
  dayKey,
} from "../../src/lib/social/social-rules";

describe("social-rules (W4)", () => {
  it("12 sticker id duy nhất, isStickerId whitelist chặn id lạ", () => {
    expect(STICKER_IDS).toHaveLength(12);
    expect(new Set(STICKER_IDS).size).toBe(12);
    expect(isStickerId("heart")).toBe(true);
    expect(isStickerId("hack")).toBe(false);
    expect(isStickerId("'; DROP TABLE FarmLike; --")).toBe(false);
  });

  it("sanitize: trim + collapse spaces, giữ nội dung", () => {
    expect(sanitizeGuestbookMessage("  farm   đẹp quá!  ")).toBe("farm đẹp quá!");
    expect(sanitizeGuestbookMessage("a\nb\tc")).toBe("a b c");
  });

  it("sanitize: control chars bị thay bằng space (chống glitch UI)", () => {
    expect(sanitizeGuestbookMessage("he\x00llo\x1f")).toBe("he llo");
    expect(sanitizeGuestbookMessage("del\x7f")).toBe("del");
  });

  it("sanitize: rỗng/toàn space → null", () => {
    expect(sanitizeGuestbookMessage("")).toBeNull();
    expect(sanitizeGuestbookMessage("   \n\t  ")).toBeNull();
  });

  it("sanitize: dài hơn 200 → TRUNCATE (không mất lời nhắn), đúng max", () => {
    const long = "a".repeat(500);
    const out = sanitizeGuestbookMessage(long);
    expect(out).toHaveLength(GUESTBOOK_MAX_CHARS);
    expect(out).toBe("a".repeat(GUESTBOOK_MAX_CHARS));
  });

  it("giữ nguyên message hợp lệ (không double-space, không cắt)", () => {
    expect(sanitizeGuestbookMessage("chào bạn!")).toBe("chào bạn!");
  });

  it("dayKey: YYYYMMDD UTC — cùng ngày cùng key, khác ngày khác key", () => {
    expect(dayKey(new Date(Date.UTC(2026, 7, 19)))).toBe(20260819); // tháng 8 = idx 7
    expect(dayKey(new Date(Date.UTC(2026, 7, 19, 23, 59)))).toBe(20260819);
    expect(dayKey(new Date(Date.UTC(2026, 7, 20)))).toBe(20260820);
    // ranh giới UTC không lệch theo múi giờ local: 2026-08-20 00:30 UTC vẫn 20
    expect(dayKey(new Date(Date.UTC(2026, 7, 20, 0, 30)))).toBe(20260820);
  });

  it("hằng số keep/limit hợp lý", () => {
    expect(GUESTBOOK_KEEP).toBe(50);
    expect(GUESTBOOK_MAX_CHARS).toBe(200);
  });
});
