import { describe, it, expect } from "vitest";
import { advanceVelocity, DEFAULT_KINETICS } from "@/lib/game/phaser/movement-kinetics";

describe("advanceVelocity", () => {
  it("tiệm cận target theo accel — không nhảy tức thời", () => {
    const r = advanceVelocity(0, 0, 1, 0, false, DEFAULT_KINETICS, 0.016);
    expect(r.vx).toBeGreaterThan(0);
    expect(r.vx).toBeLessThan(DEFAULT_KINETICS.walkSpeed);
  });

  it("đạt đúng walk speed khi đủ thời gian", () => {
    let vx = 0, vy = 0;
    for (let i = 0; i < 120; i++) ({ vx, vy } = advanceVelocity(vx, vy, 1, 0, false, DEFAULT_KINETICS, 1 / 60));
    expect(vx).toBeCloseTo(DEFAULT_KINETICS.walkSpeed, 0);
    expect(vy).toBe(0);
  });

  it("run nhanh hơn walk", () => {
    let vx = 0, vy = 0;
    for (let i = 0; i < 240; i++) ({ vx, vy } = advanceVelocity(vx, vy, 1, 0, true, DEFAULT_KINETICS, 1 / 60));
    expect(vx).toBeCloseTo(DEFAULT_KINETICS.runSpeed, 0);
  });

  it("thả phím → braking về 0, không đảo chiều", () => {
    let { vx, vy } = advanceVelocity(DEFAULT_KINETICS.walkSpeed, 0, 0, 0, false, DEFAULT_KINETICS, 0.05);
    expect(vx).toBeLessThan(DEFAULT_KINETICS.walkSpeed);
    expect(vx).toBeGreaterThan(-1); // không âm (không đảo chiều)
    // đủ thời gian → đứng yên
    let s = { vx: DEFAULT_KINETICS.walkSpeed, vy: 0 };
    for (let i = 0; i < 120; i++) s = advanceVelocity(s.vx, s.vy, 0, 0, false, DEFAULT_KINETICS, 1 / 60);
    expect(s.vx).toBe(0);
  });

  it("đường chéo được normalize (dir thô 1,1)", () => {
    let s = { vx: 0, vy: 0 };
    for (let i = 0; i < 120; i++) s = advanceVelocity(s.vx, s.vy, 1, 1, false, DEFAULT_KINETICS, 1 / 60);
    expect(Math.hypot(s.vx, s.vy)).toBeCloseTo(DEFAULT_KINETICS.walkSpeed, 1);
  });
});
