import { describe, it, expect } from "vitest";
import { nextLocomotion } from "@/lib/game/phaser/locomotion-state";

describe("nextLocomotion", () => {
  it("đứng yên khi speed ≈ 0", () => {
    expect(nextLocomotion({ anim: "walk", facing: "down" }, 0, "down").anim).toBe("idle");
  });
  it("walk khi speed giữa walkMin và runMin", () => {
    expect(nextLocomotion({ anim: "idle", facing: "down" }, 120, "down").anim).toBe("walk");
  });
  it("run khi speed ≥ runMin", () => {
    expect(nextLocomotion({ anim: "walk", facing: "down" }, 190, "down").anim).toBe("run");
  });
  it("hysteresis: run→walk ở 168 (giữa 2 ngưỡng) giữ run", () => {
    expect(nextLocomotion({ anim: "run", facing: "down" }, 168, "down").anim).toBe("run");
  });
  it("facing luôn được cập nhật từ input", () => {
    const s = nextLocomotion({ anim: "idle", facing: "down" }, 0, "left");
    expect(s.facing).toBe("left");
    expect(s.anim).toBe("idle");
  });
});
