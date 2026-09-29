import { describe, it, expect } from "vitest";
import { dayLightAt } from "@/lib/game/phaser/day-night";

describe("dayLightAt", () => {
  it("giữa ngày (10:00) → trong suốt", () => {
    expect(dayLightAt(600).alpha).toBe(0);
  });
  it("giữa đêm (0:30) → tối nhất", () => {
    const n = dayLightAt(30);
    expect(n.alpha).toBeCloseTo(0.55, 2);
  });
  it("hoàng hôn (18:00) → đang tối dần, giữa ngày và đêm", () => {
    const d = dayLightAt(1080);
    expect(d.alpha).toBeGreaterThan(0);
    expect(d.alpha).toBeLessThan(0.55);
  });
  it("bình minh (5:00) → đang sáng dần", () => {
    const d = dayLightAt(300);
    expect(d.alpha).toBeGreaterThan(0);
    expect(d.alpha).toBeLessThan(0.55);
  });
  it("lien tục: không nhảy giá trị quanh mốc 19:00", () => {
    const a = dayLightAt(1139).alpha;
    const b = dayLightAt(1141).alpha;
    expect(Math.abs(a - b)).toBeLessThan(0.02);
  });
  it("tint lerp đúng từng kênh RGB (không borrow giữa kênh)", () => {
    // Giữa 18:30 (0xc76b3f) và 20:30 (0x2b1a4d): midpoint phải là trung bình
    // từng kênh: R 0x79, G 0x42, B 0x46 — lerp packed-int sai kênh blue.
    const mid = dayLightAt((1110 + 1230) / 2);
    expect(mid.tint).toBe(0x794246);
  });
});
