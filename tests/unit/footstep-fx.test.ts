// @vitest-environment jsdom
// Import footstep-fx kéo theo Phaser — mock phaser để tránh side-effect canvas
// trong jsdom (convention farm-scene-run-anim.test.ts). shouldStep thuần nên
// không đụng phần Phaser.
import { describe, it, expect, vi } from "vitest";

vi.mock("phaser", () => ({ default: {} }));

import { shouldStep } from "@/components/game/phaser/footstep-fx";

describe("shouldStep", () => {
  it("bước mỗi 2 frame của walk/run", () => {
    expect(shouldStep("farmer-walk-d", 1, 2)).toBe(true);
    expect(shouldStep("farmer-walk-d", 2, 2)).toBe(false);
    expect(shouldStep("farmer-run-a", 3, 2)).toBe(true);
  });
  it("idle không bao giờ bước", () => {
    expect(shouldStep("farmer-idle-d", 1, 2)).toBe(false);
  });
  it("tool anim không bước", () => {
    expect(shouldStep("farmer-tool-hoe-d", 1, 2)).toBe(false);
  });
});
