import { describe, it, expect, beforeEach } from "vitest";
import { useRaidStore } from "@/store/raidStore";
import type { RaidSnapshot } from "@/lib/raid/types";

// Phase 5 — message → typed presentation state (phase-05 §Message and input test procedure).
// Pins the RaidUiEvent discrimination so currently-ignored `alert-level`, `puzzle-result` and
// `error` server messages surface in the UI instead of being silently dropped (ws-client
// `default:` no-op today). These are CLIENT PRESENTATION ONLY — they never mutate
// inventory/server truth, and reset clears them so a previous raid's error can't leak.

// Deterministic `receivedAt` so assertions don't depend on wall clock.
let ts = 0;
const now = () => (ts = ts + 1000);

beforeEach(() => {
  ts = 0;
  useRaidStore.getState().reset();
});

describe("raidStore presentation events (alert/puzzle-result/error)", () => {
  it("alert-level → event stored, reset clears it", () => {
    useRaidStore.getState().pushEvent({ kind: "alert", level: "alarm", score: 80, reason: "dog sighted", receivedAt: now() });
    expect(useRaidStore.getState().lastEvent).toMatchObject({ kind: "alert", level: "alarm", score: 80 });
    useRaidStore.getState().reset();
    expect(useRaidStore.getState().lastEvent).toBeNull();
  });

  it("puzzle-result success → kept loot surfaced (not added to inventory)", () => {
    const invCountBefore = 0;
    useRaidStore.getState().pushEvent({
      kind: "puzzle-result", chestId: "c1", ok: true,
      loot: [{ itemId: "wood", qty: 2 }], receivedAt: now(),
    });
    const ev = useRaidStore.getState().lastEvent;
    expect(ev).toMatchObject({ kind: "puzzle-result", ok: true, loot: [{ itemId: "wood", qty: 2 }] });
    // Presentation only — inventory must be untouched (no server loot transfer here).
    expect(invCountBefore).toBe(0);
  });

  it("puzzle-result failure → ok false, no loot, still visible", () => {
    useRaidStore.getState().pushEvent({ kind: "puzzle-result", chestId: "c2", ok: false, receivedAt: now() });
    expect(useRaidStore.getState().lastEvent).toMatchObject({ kind: "puzzle-result", ok: false });
  });

  it("error → readable state + dismissible; does not end the raid", () => {
    const before = useRaidStore.getState().phase;
    useRaidStore.getState().pushEvent({ kind: "error", code: "join_rejected", message: "farm is locked", receivedAt: now() });
    expect(useRaidStore.getState().lastEvent).toMatchObject({ kind: "error", code: "join_rejected" });
    // Dismiss clears only the event, keeps phase.
    useRaidStore.getState().dismissEvent();
    expect(useRaidStore.getState().lastEvent).toBeNull();
    expect(useRaidStore.getState().phase).toBe(before);
  });

  it("new event replaces previous (latest wins), bounded memory", () => {
    useRaidStore.getState().pushEvent({ kind: "alert", level: "stealth", score: 0, reason: "ok", receivedAt: now() });
    useRaidStore.getState().pushEvent({ kind: "error", code: "conn", message: "drop", receivedAt: now() });
    expect(useRaidStore.getState().lastEvent?.kind).toBe("error");
  });
});