import { describe, it, expect, beforeEach } from "bun:test";
import { checkJoinRateLimit, resetJoinRateLimit } from "../src/rate-limit.js";
import { JOIN_RATE_MAX, JOIN_RATE_WINDOW_MS } from "../src/constants.js";

/**
 * Rate-limit join (audit M10): tối đa JOIN_RATE_MAX lần / JOIN_RATE_WINDOW_MS / user.
 * Chống scan farm hàng loạt. Pure in-memory, KHÔNG cần DB.
 */
describe("join rate-limit (audit M10)", () => {
  beforeEach(() => resetJoinRateLimit("thief-1"));

  it("cho phép JOIN_RATE_MAX lần đầu", () => {
    for (let i = 0; i < JOIN_RATE_MAX; i++) {
      expect(checkJoinRateLimit("thief-1")).toBe(true);
    }
  });

  it("chặn lần vượt quá cap", () => {
    for (let i = 0; i < JOIN_RATE_MAX; i++) checkJoinRateLimit("thief-1");
    expect(checkJoinRateLimit("thief-1")).toBe(false);
  });

  it("reset sau window hết hạn (fake timers)", () => {
    const now = Date.now;
    let fake = 0;
    // @ts-ignore test-only override
    Date.now = () => fake;
    try {
      for (let i = 0; i < JOIN_RATE_MAX; i++) checkJoinRateLimit("thief-1");
      expect(checkJoinRateLimit("thief-1")).toBe(false);
      fake += JOIN_RATE_WINDOW_MS + 1;
      expect(checkJoinRateLimit("thief-1")).toBe(true);
    } finally {
      Date.now = now;
    }
  });

  it("rate-limit riêng biệt theo user", () => {
    for (let i = 0; i < JOIN_RATE_MAX; i++) checkJoinRateLimit("thief-1");
    expect(checkJoinRateLimit("thief-2")).toBe(true); // user khác không bị ảnh hưởng
  });
});
