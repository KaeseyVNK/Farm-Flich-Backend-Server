import { describe, it, expect } from "vitest";
import { chatRateLimit } from "../../src/lib/social/village-presence";
import { checkVisitRateLimit, resetVisitRateLimit } from "../../src/lib/social/visit-rate-limit";

// Audit: village-presence chatRateLimit + visit-rate-limit (phase 5 F5.7 / phase 8)
// chưa có unit test. Rate limit chặn spam chat + visit spam — lỗi → spam message.

describe("chatRateLimit (village-presence)", () => {
  it("dưới max → true", () => {
    const history = [1000, 2000, 3000, 4000];
    expect(chatRateLimit(history, 5000)).toBe(true); // 4 recent < 10
  });

  it("đạt max trong window → false", () => {
    const history = Array.from({ length: 10 }, (_, i) => 1000 + i * 100);
    expect(chatRateLimit(history, 5000)).toBe(false); // 10 recent
  });

  it("vượt max trong window → false", () => {
    const history = Array.from({ length: 15 }, (_, i) => 1000 + i * 100);
    expect(chatRateLimit(history, 5000)).toBe(false);
  });

  it("message cũ ngoài window 60s → không đếm (cho phép mới)", () => {
    const history = Array.from({ length: 12 }, (_, i) => 1000 + i * 100); // tới 2100
    // window 60s: only recent < now-windowMs = 3000 → từ 3000 trở đi
    expect(chatRateLimit(history, 60_000 + 3000)).toBe(true);
  });

  it("window/custom max tùy chỉnh hoạt động", () => {
    const history = Array.from({ length: 5 }, (_, i) => 1000 + i * 100);
    expect(chatRateLimit(history, 5000, 60_000, 3)).toBe(false); // 5 recent > max 3
    expect(chatRateLimit(history, 5000, 60_000, 6)).toBe(true); // 5 recent < max 6
    // tại đúng max → false (đã đủ, chặn thêm)
    expect(chatRateLimit(history, 5000, 60_000, 5)).toBe(false);
  });
});

describe("visit-rate-limit", () => {
  it("cho phép 10 visit trong window 60s", () => {
    resetVisitRateLimit("user-a");
    for (let i = 0; i < 10; i++) {
      expect(checkVisitRateLimit("user-a"), `visit ${i + 1}`).toBe(true);
    }
  });

  it("visit thứ 11 trong window → false", () => {
    resetVisitRateLimit("user-b");
    for (let i = 0; i < 10; i++) checkVisitRateLimit("user-b");
    expect(checkVisitRateLimit("user-b")).toBe(false);
  });

  it("reset → đếm lại từ đầu", () => {
    resetVisitRateLimit("user-c");
    for (let i = 0; i < 10; i++) checkVisitRateLimit("user-c");
    expect(checkVisitRateLimit("user-c")).toBe(false);
    resetVisitRateLimit("user-c");
    expect(checkVisitRateLimit("user-c")).toBe(true);
  });

  it("cô lập giữa các user khác nhau", () => {
    resetVisitRateLimit("user-d");
    resetVisitRateLimit("user-e");
    for (let i = 0; i < 10; i++) checkVisitRateLimit("user-d");
    expect(checkVisitRateLimit("user-e")).toBe(true); // user-e không bị ảnh hưởng
  });
});
