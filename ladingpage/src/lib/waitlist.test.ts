import { describe, expect, test } from "bun:test";
import { giftCodeForDate, parseWaitlistEmail } from "./waitlist";

describe("parseWaitlistEmail", () => {
  test("accepts a trimmed valid email", () => {
    const result = parseWaitlistEmail("  NongDan@example.com ");
    expect(result).toEqual({ ok: true, email: "nongdan@example.com" });
  });

  test("rejects empty input", () => {
    expect(parseWaitlistEmail("")).toEqual({
      ok: false,
      error: "Nhập email để nhận thư khi game mở.",
    });
  });

  test("rejects invalid email", () => {
    expect(parseWaitlistEmail("khong-phai-email")).toEqual({
      ok: false,
      error: "Email chưa đúng định dạng.",
    });
  });
});

describe("giftCodeForDate", () => {
  test("returns Sunday code on Sunday", () => {
    expect(giftCodeForDate(new Date("2026-09-13T10:00:00+07:00"))).toBe(
      "CHUNHAT_SOM",
    );
  });

  test("returns Friday code on Friday", () => {
    expect(giftCodeForDate(new Date("2026-09-11T10:00:00+07:00"))).toBe(
      "THUSAU_SOM",
    );
  });
});
