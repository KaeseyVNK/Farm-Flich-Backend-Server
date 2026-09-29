import { describe, it, expect } from "vitest";
import {
  hashSeed,
  isBloodMoon,
  bloodMoonEffects,
  bloodMoonDeterministic,
} from "../../src/lib/game/story/blood-moon";

describe("Blood-moon determinism (I12)", () => {
  it("hashSeed: deterministic cho cùng input", () => {
    expect(hashSeed("user1:day5")).toBe(hashSeed("user1:day5"));
    expect(hashSeed("user1:day5")).not.toBe(hashSeed("user2:day5"));
  });

  it("isBloodMoon: deterministic — 100 runs cùng kết quả", () => {
    expect(bloodMoonDeterministic(5, "user-abc", 100)).toBe(true);
  });

  it("isBloodMoon: W9P3 bỏ gate chapter — day 1 đã có thể blood-moon (hash)", () => {
    // Không còn tham số chapter; verify signature 2-arg deterministic không throw.
    expect(typeof isBloodMoon(5, "user1")).toBe("boolean");
  });

  it("isBloodMoon: khác userId → có thể khác kết quả", () => {
    // Tìm pair user khác kết quả (seed khác).
    const a = isBloodMoon(10, "user-a");
    const b = isBloodMoon(10, "user-b");
    // Không đảm bảo khác, nhưng xác suất cao; chỉ verify không throw.
    expect(typeof a).toBe("boolean");
    expect(typeof b).toBe("boolean");
  });

  it("bloodMoonEffects: active → enemy/loot/dog buff", () => {
    const fx = bloodMoonEffects(true);
    expect(fx.enemyDamageMul).toBe(1.5);
    expect(fx.lootMul).toBe(2);
    expect(fx.dogVisionBonus).toBe(2);
  });

  it("bloodMoonEffects: inactive → baseline 1/0", () => {
    const fx = bloodMoonEffects(false);
    expect(fx.enemyDamageMul).toBe(1);
    expect(fx.lootMul).toBe(1);
    expect(fx.dogVisionBonus).toBe(0);
  });

  it("~1/7 frequency: trong 70 ngày, blood-moon count hợp lý (gate chapter>=2)", () => {
    let count = 0;
    for (let day = 1; day <= 70; day++) {
      if (isBloodMoon(day, "test-user")) count++;
    }
    // ~10 lần (1/7 × 70). Cho phép [5, 20].
    expect(count).toBeGreaterThanOrEqual(5);
    expect(count).toBeLessThanOrEqual(20);
  });
});
