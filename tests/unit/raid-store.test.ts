import { describe, it, expect, beforeEach } from "vitest";
import { useRaidStore } from "@/store/raidStore";
import type { RaidSnapshot } from "@/lib/raid/types";

const snap = (overrides: Partial<RaidSnapshot> = {}): RaidSnapshot => ({
  tick: 1,
  you: { id: "you", x: 1, y: 1, dx: 0, dy: 0, facing: "down" },
  dogs: [{ id: "dog0", x: 5, y: 5, dx: 0, dy: 0, facing: "down" }],
  chests: [{ id: "c1", x: 20, y: 10, open: false }],
  alert: { level: "stealth", score: 0 },
  lockdown: false,
  ...overrides,
});

beforeEach(() => useRaidStore.getState().reset());

describe("raidStore applySnapshot", () => {
  it("apply lần 1 → phase active, snapshot set, prev null", () => {
    useRaidStore.getState().applySnapshot(snap());
    const st = useRaidStore.getState();
    expect(st.phase).toBe("active");
    expect(st.snapshot?.tick).toBe(1);
    expect(st.prevSnapshot).toBeNull();
  });
  it("apply lần 2 → prev = snapshot cũ", () => {
    useRaidStore.getState().applySnapshot(snap({ tick: 1 }));
    useRaidStore.getState().applySnapshot(snap({ tick: 2 }));
    const st = useRaidStore.getState();
    expect(st.snapshot?.tick).toBe(2);
    expect(st.prevSnapshot?.tick).toBe(1);
  });
});

describe("raidStore phase transitions", () => {
  it("setLobby → phase lobby + farmName", () => {
    useRaidStore.getState().setLobby("Sunny");
    expect(useRaidStore.getState().phase).toBe("lobby");
    expect(useRaidStore.getState().farmName).toBe("Sunny");
  });
  it("setEnd → phase ended + endState", () => {
    useRaidStore.getState().setEnd({ reason: "caught", keptLoot: [], maskDurabilityLoss: 1 });
    expect(useRaidStore.getState().phase).toBe("ended");
    expect(useRaidStore.getState().endState?.reason).toBe("caught");
  });
  it("reset → idle, snapshot null", () => {
    useRaidStore.getState().applySnapshot(snap());
    useRaidStore.getState().reset();
    expect(useRaidStore.getState().phase).toBe("idle");
    expect(useRaidStore.getState().snapshot).toBeNull();
  });
});
