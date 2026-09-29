import { describe, expect, it } from "vitest";
import { tileFrameName } from "../../src/lib/game/phaser/texture-frames";

describe("texture frames", () => {
  it("names a 16px cell from source x/y", () => {
    expect(tileFrameName(144, 32)).toBe("t144_32");
  });
});
