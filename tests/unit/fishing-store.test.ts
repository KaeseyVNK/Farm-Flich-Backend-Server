// Wave 1 P4 — fishingStore mirror cho FishingOverlay (React không đọc Phaser).
import { describe, it, expect, beforeEach } from "vitest";
import { useFishingStore } from "../../src/store/fishingStore";
import { idleSession, nextFishing, FISHING_TUNE } from "../../src/lib/game/fishing/fishing-sm";

const RNG = () => {
  let i = 0;
  return () => [0.5, 0.5, 0.5][i++ % 3];
};

describe("fishingStore (W1P4)", () => {
  beforeEach(() => {
    useFishingStore.getState().reset();
  });

  it("setFromSession(idle) → active false", () => {
    useFishingStore.getState().setFromSession(idleSession());
    expect(useFishingStore.getState().active).toBe(false);
  });

  it("setFromSession(wait) → active, phase wait, không reel", () => {
    let s = nextFishing(idleSession(), { type: "cast", now: 0, zone: "pond", level: 1 }, RNG());
    s = nextFishing(s, { type: "tick", now: FISHING_TUNE.castMs + 1 }, RNG());
    useFishingStore.getState().setFromSession(s);
    const st = useFishingStore.getState();
    expect(st.active).toBe(true);
    expect(st.phase).toBe("wait");
    expect(st.reel).toBeNull();
  });

  it("setFromSession(reel) → mirror reel snapshot (bar/fish/progress)", () => {
    const rare = nextFishing(
      idleSession(),
      { type: "cast", now: 0, zone: "lake", level: 4 },
      (() => {
        let i = 0;
        return () => [0.99, 0.5, 0.5, 0.5, 0.5][i++ % 5];
      })(),
    );
    let s = nextFishing(rare, { type: "tick", now: FISHING_TUNE.castMs + 1 }, RNG());
    s = nextFishing(s, { type: "tick", now: s.biteAt! + 1 }, RNG());
    s = nextFishing(s, { type: "tap", now: s.biteAt! + 5 }, RNG());
    expect(s.phase).toBe("reel");
    useFishingStore.getState().setFromSession(s);
    const st = useFishingStore.getState();
    expect(st.phase).toBe("reel");
    expect(st.reel).not.toBeNull();
    expect(st.reel!.progress).toBeGreaterThanOrEqual(0);
    expect(st.reel!.progress).toBeLessThanOrEqual(1);
  });

  it("setHolding + requestCancel + reset", () => {
    useFishingStore.getState().setHolding(true);
    expect(useFishingStore.getState().holding).toBe(true);
    useFishingStore.getState().requestCancel();
    expect(useFishingStore.getState().cancelRequested).toBe(true);
    useFishingStore.getState().reset();
    const st = useFishingStore.getState();
    expect(st.active).toBe(false);
    expect(st.holding).toBe(false);
    expect(st.cancelRequested).toBe(false);
  });
});
