// @vitest-environment jsdom
// Import ambient-particles kéo theo Phaser — mock phaser để tránh side-effect
// canvas trong jsdom (convention footstep-fx.test.ts). ambientKindFor thuần
// nên không đụng phần Phaser.
import { describe, it, expect, vi } from "vitest";

vi.mock("phaser", () => ({ default: {} }));

import { ambientKindFor } from "@/components/game/phaser/ambient-particles";

describe("ambientKindFor", () => {
  it("farm spring/summer → butterflies", () => {
    expect(ambientKindFor({ zone: "farm", season: "Spring" })).toBe("butterflies");
    expect(ambientKindFor({ zone: "farm", season: "Summer" })).toBe("butterflies");
  });
  it("farm fall → leaves", () => {
    expect(ambientKindFor({ zone: "farm", season: "Fall" })).toBe("leaves");
  });
  it("farm winter → snow", () => {
    expect(ambientKindFor({ zone: "farm", season: "Winter" })).toBe("snow");
  });
  it("house/cave → none", () => {
    expect(ambientKindFor({ zone: "house", season: "Spring" })).toBe("none");
    expect(ambientKindFor({ zone: "cave", season: "Spring" })).toBe("none");
  });
  it("village/beach cũng có ambient (butterflies mặc định)", () => {
    expect(ambientKindFor({ zone: "village", season: "Spring" })).toBe("butterflies");
    expect(ambientKindFor({ zone: "beach", season: "Winter" })).toBe("snow");
  });
});
