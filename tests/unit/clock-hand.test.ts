import { describe, it, expect } from "vitest";
import {
  hourHandAngle,
  minuteHandAngle,
  rotateTransform,
  normalizeAngle,
} from "../../src/lib/ui/clock-hand";

describe("Clock hand rotation", () => {
  it("hourHandAngle: 0 min (midnight) = 0deg", () => {
    expect(hourHandAngle(0)).toBe(0);
  });

  it("hourHandAngle: 360 min (6h) = 90deg", () => {
    expect(hourHandAngle(360)).toBe(90);
  });

  it("hourHandAngle: 720 min (noon) = 180deg", () => {
    expect(hourHandAngle(720)).toBe(180);
  });

  it("hourHandAngle: 1440 min = full rotation = 360deg → wrap", () => {
    expect(hourHandAngle(1440)).toBe(0);
  });

  it("hourHandAngle: handle overflow (> 1440)", () => {
    // 1440 + 360 = 1800 → same as 360 → 90deg
    expect(hourHandAngle(1800)).toBe(90);
  });

  it("minuteHandAngle: 0 min = 0deg; 30 min = 180deg; 60 min = 360 wrap", () => {
    expect(minuteHandAngle(0)).toBe(0);
    expect(minuteHandAngle(30)).toBe(180);
    expect(minuteHandAngle(60)).toBe(0);
  });

  it("rotateTransform format CSS", () => {
    expect(rotateTransform(90)).toBe("rotate(90deg)");
  });

  it("normalizeAngle: wrap [0,360)", () => {
    expect(normalizeAngle(370)).toBe(10);
    expect(normalizeAngle(-10)).toBe(350);
    expect(normalizeAngle(720)).toBe(0);
  });
});
