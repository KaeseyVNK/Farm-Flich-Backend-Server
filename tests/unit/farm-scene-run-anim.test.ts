// @vitest-environment jsdom
// Import farm-scene kéo theo Phaser (cần DOM + canvas) — mock phaser để tránh
// side-effect canvas trong jsdom (convention boot-scene-race.test.ts).
// Phần test vẫn thuần convention (anim key + frame count).
import { describe, it, expect, vi } from "vitest";

vi.mock("phaser", () => {
  class Scene {}
  return { Phaser: { Scene }, default: { Scene } };
});

import { farmerAnimKey, FARMER_SHEET_FRAMES } from "@/components/game/scenes/farm-scene";

describe("farmer anim key conventions", () => {
  it("anim key theo locomotion + hướng", () => {
    expect(farmerAnimKey("run", "left")).toBe("farmer-run-a");
    expect(farmerAnimKey("idle", "up")).toBe("farmer-idle-u");
    expect(farmerAnimKey("walk", "down")).toBe("farmer-walk-d");
  });
  it("sheet frame count đúng grid pack", () => {
    expect(FARMER_SHEET_FRAMES.run).toBe(8);
    expect(FARMER_SHEET_FRAMES.walk).toBe(6);
    expect(FARMER_SHEET_FRAMES.idle).toBe(4);
  });
});
