import { describe, it, expect } from "bun:test";
import { isFarmNewbieProtected } from "../src/newbie-immunity.js";

const NOW = Date.parse("2026-08-20T00:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

describe("isFarmNewbieProtected", () => {
  it("createdAt trong 3 ngày → bảo vệ", () => {
    expect(isFarmNewbieProtected(new Date(NOW - DAY), NOW)).toBe(true);
    expect(isFarmNewbieProtected(new Date(NOW - 2 * DAY).toISOString(), NOW)).toBe(true);
  });

  it("createdAt đủ 3 ngày → raid được", () => {
    expect(isFarmNewbieProtected(new Date(NOW - 3 * DAY), NOW)).toBe(false);
    expect(isFarmNewbieProtected(new Date(NOW - 30 * DAY), NOW)).toBe(false);
  });

  it("thiếu / timestamp hỏng → fail-closed (bảo vệ)", () => {
    expect(isFarmNewbieProtected(undefined, NOW)).toBe(true);
    expect(isFarmNewbieProtected(null, NOW)).toBe(true);
    expect(isFarmNewbieProtected("", NOW)).toBe(true);
    expect(isFarmNewbieProtected("not-a-date", NOW)).toBe(true);
  });
});
