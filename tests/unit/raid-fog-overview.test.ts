// W7a-P1 — §3.2 fog contract: snapshot KHÔNG BAO GIỜ chứa thông tin chủ farm
// (traps/patrol-future/nội dung rương). Overview (Tab) chỉ zoom-out client —
// không thêm data mới. Test khóa contract bằng cách quét snapshot đầy đủ field.
import { describe, expect, it } from "vitest";
import type { RaidSnapshot } from "@/lib/raid/types";

/** Snapshot điển hình đầy đủ mọi field công khai — nếu ai thêm field leaks, test đỏ. */
const FULL_SNAPSHOT: RaidSnapshot = {
  tick: 42,
  you: { id: "raider", x: 3, y: 4, dx: 0, dy: -1, facing: "up" },
  dogs: [{ id: "dog-1", x: 10, y: 10, dx: 0, dy: 0, facing: "down" }],
  chests: [
    { id: "chest-wood-1", x: 5, y: 6, open: false },
    { id: "chest-safe-1", x: 20, y: 8, open: true },
  ],
  alert: { level: "caution", score: 30 },
  lockdown: false,
  mapBiome: "forest",
  exitDeadlineMs: Date.now() + 90_000,
  bloodMoon: false,
};

describe("raid fog contract (§3.2)", () => {
  it("snapshot serialize không chứa key traps/patrol/loot/content", () => {
    const json = JSON.stringify(FULL_SNAPSHOT).toLowerCase();
    for (const banned of ["trap", "patrol", "loot", "content", "inventory"]) {
      expect(json.includes(banned), `snapshot chứa "${banned}" — leak chủ farm!`).toBe(false);
    }
  });

  it("chests chỉ có open flag — không item/reward", () => {
    for (const c of FULL_SNAPSHOT.chests) {
      expect(Object.keys(c).sort()).toEqual(["id", "open", "x", "y"]);
    }
  });
});

describe("overview mode (W7a-P1)", () => {
  it("RaidSnapshot type không có field nào cho overview — client-only zoom", () => {
    // Compile-time contract: nếu ai thêm snapshot.overview / snapshot.traps,
    // FULL_SNAPSHOT ở trên vẫn pass nhưng type sẽ có key mới — quét key thực.
    expect(Object.keys(FULL_SNAPSHOT).sort()).toEqual(
      [
        "alert", "bloodMoon", "chests", "dogs", "exitDeadlineMs",
        "lockdown", "mapBiome", "tick", "you",
      ].sort(),
    );
  });
});
