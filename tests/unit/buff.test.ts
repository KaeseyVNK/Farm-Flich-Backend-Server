import { describe, it, expect } from "vitest";
import {
  absMinute,
  applyBuff,
  activeBuffs,
  speedMultiplier,
  xpMultiplier,
  clearBuffs,
  scaleKinetics,
  BUFF_TUNE,
  type BuffState,
} from "../../src/lib/game/buff";
import { DEFAULT_KINETICS } from "../../src/lib/game/phaser/movement-kinetics";

describe("buff (W2 P3) — hệ buff theo phút tuyệt đối", () => {
  it("absMinute: day*1440 + timeMinutes", () => {
    expect(absMinute(1, 360)).toBe(1800);
    expect(absMinute(2, 0)).toBe(2880);
  });

  it("applyBuff: speed đặt untilAbs đúng duration", () => {
    const s = applyBuff({}, "speed", 3, 1500, 120);
    expect(s.speedUntilAbs).toBe(absMinute(3, 1620));
    expect(s.xpUntilAbs).toBeUndefined();
  });

  it("applyBuff chồng lấn: giữ mốc MUỘN nhất (buff mới không ghi đè buff lâu hơn)", () => {
    const base: BuffState = { speedUntilAbs: absMinute(3, 1700) };
    const s = applyBuff(base, "speed", 3, 1500, 60); // until 1560 < 1700
    expect(s.speedUntilAbs).toBe(absMinute(3, 1700));
    const s2 = applyBuff(base, "speed", 3, 1650, 120); // until 1770 > 1700
    expect(s2.speedUntilAbs).toBe(absMinute(3, 1770));
  });

  it("activeBuffs: active trước hạn, expire sau hạn, sống qua ranh giới ngày", () => {
    const s = applyBuff({}, "speed", 3, 1500, 120); // until abs(3,1620)
    expect(activeBuffs(s, 3, 1550).speed).toBe(true);
    expect(activeBuffs(s, 3, 1621).speed).toBe(false);
    // ngủ ngày 3 → ngày 4: abs tăng → hết hạn tự nhiên
    expect(activeBuffs(s, 4, 400).speed).toBe(false);
    // buff granted sát cuối ngày, kéo qua nửa đêm logic abs vẫn đúng
    const s2 = applyBuff({}, "speed", 3, 1540, 120); // until abs(3,1660) ~ 27:40
    expect(activeBuffs(s2, 4, 100).speed).toBe(true);
  });

  it("multipliers: 1 khi không active, đúng hằng số khi active", () => {
    expect(speedMultiplier({}, 3, 500)).toBe(1);
    expect(xpMultiplier({}, 3, 500)).toBe(1);
    const s = applyBuff(applyBuff({}, "speed", 3, 500, 60), "xp", 3, 500, 1000);
    expect(speedMultiplier(s, 3, 510)).toBeCloseTo(BUFF_TUNE.speedMult);
    expect(xpMultiplier(s, 3, 510)).toBeCloseTo(BUFF_TUNE.xpMult);
    expect(speedMultiplier(s, 3, 700)).toBe(1);
  });

  it("clearBuffs → {}", () => {
    expect(clearBuffs()).toEqual({});
  });

  it("scaleKinetics: nhân walk/run, giữ accel/braking", () => {
    const k = scaleKinetics(DEFAULT_KINETICS, 1.2);
    expect(k.walkSpeed).toBeCloseTo(DEFAULT_KINETICS.walkSpeed * 1.2);
    expect(k.runSpeed).toBeCloseTo(DEFAULT_KINETICS.runSpeed * 1.2);
    expect(k.accel).toBe(DEFAULT_KINETICS.accel);
    expect(k.braking).toBe(DEFAULT_KINETICS.braking);
  });
});
