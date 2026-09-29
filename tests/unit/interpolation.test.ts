import { describe, it, expect } from "vitest";
import { interpolateEntity, computeAlpha } from "@/lib/raid/interpolation";
import type { RaidEntity } from "@/lib/raid/types";

const e = (x: number, y: number, dx = 0, dy = 0): RaidEntity => ({
  id: "e",
  x,
  y,
  dx,
  dy,
  facing: "right",
});

describe("interpolateEntity", () => {
  it("alpha 0 → vị trí prev", () => {
    expect(interpolateEntity(e(0, 0), e(10, 0), 0).x).toBe(0);
  });
  it("alpha 0.5 → trung điểm", () => {
    expect(interpolateEntity(e(0, 0), e(10, 0), 0.5).x).toBe(5);
  });
  it("alpha 1 → vị trí cur", () => {
    expect(interpolateEntity(e(0, 0), e(10, 0), 1).x).toBe(10);
  });
  it("alpha > 1 → extrapolate theo velocity (cap 0.5)", () => {
    const r = interpolateEntity(e(0, 0), e(10, 0), 1.5);
    // x = 10 + dx(0)*... nhưng dx=0 → 10
    expect(r.x).toBe(10);
    // với velocity dx=1, alpha 1.5 → extra 0.5
    const r2 = interpolateEntity(e(0, 0), e(10, 0, 1, 0), 1.5);
    expect(r2.x).toBe(10.5);
  });
  it("alpha âm → clamp 0", () => {
    expect(interpolateEntity(e(0, 0), e(10, 0), -1).x).toBe(0);
  });
});

describe("computeAlpha", () => {
  it("giữa 2 ts → tỉ lệ", () => {
    expect(computeAlpha(0, 100, 50)).toBe(0.5);
  });
  it("now > curTs → > 1 (extrapolate)", () => {
    expect(computeAlpha(0, 100, 150)).toBe(1.5);
  });
  it("clamp trên 1.5", () => {
    expect(computeAlpha(0, 100, 1000)).toBe(1.5);
  });
  it("prevTs === curTs → 1 (tránh chia 0)", () => {
    expect(computeAlpha(100, 100, 100)).toBe(1);
  });
});
