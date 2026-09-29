// W7a-P3 — cloud farm sync: payload shape (blood-moon cần gameMeta.day) + throttle.
import { describe, expect, it, beforeEach } from "vitest";
import {
  collectFarmCloudPayload,
  syncFarmCloud,
  resetCloudSyncThrottleForTest,
} from "@/lib/game/actions";
import { useGameStore } from "@/store/gameStore";
import { useFarmStore } from "@/store/farmStore";
import { T } from "@/lib/game/constants";

describe("collectFarmCloudPayload", () => {
  it("gameMeta chứa day/season/year/timeMinutes/energy/player (sync.ts shape)", () => {
    useGameStore.getState().hydrate?.({ day: 7, season: "Summer", year: 2, timeMinutes: 500, energy: 123 });
    const p = collectFarmCloudPayload();
    expect(p.gameMeta).toMatchObject({ day: 7, season: "Summer", year: 2, timeMinutes: 500, energy: 123 });
    expect(p.gameMeta.player).toEqual({ x: 19, y: 20 }); // bridge chưa mount → default
    // farm fields passthrough
    expect(Array.isArray(p.terrain)).toBe(true);
    expect(typeof p.crops).toBe("object");
    expect(Array.isArray(p.placedDecor)).toBe(true);
    expect(Array.isArray(p.pondFish)).toBe(true);
  });
});

describe("syncFarmCloud throttle", () => {
  beforeEach(() => resetCloudSyncThrottleForTest());

  it("lần đầu chạy, lần 2 trong <60s bị chặn", () => {
    expect(syncFarmCloud()).toBe(true);
    expect(syncFarmCloud()).toBe(false);
  });

  it("reset throttle → chạy lại được", () => {
    syncFarmCloud();
    resetCloudSyncThrottleForTest();
    expect(syncFarmCloud()).toBe(true);
  });
});
