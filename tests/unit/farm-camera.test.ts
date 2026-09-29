import { describe, it, expect } from "vitest";
import { overlaySize } from "@/lib/game/phaser/farm-camera";

describe("farm-camera", () => {
  it("overlaySize(960, 704, 2/3) → 1440×1056 (phủ kín viewport ở zoom 2/3)", () => {
    expect(overlaySize(960, 704, 2 / 3)).toEqual({ w: 1440, h: 1056 });
  });
});
