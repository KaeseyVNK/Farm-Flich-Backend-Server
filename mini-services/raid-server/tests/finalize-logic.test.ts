import { describe, it, expect } from "bun:test";
import {
  computeShieldUntil,
  SHIELD_MS,
  type ShieldReason,
} from "../src/shield";
import { shouldGrantDefenseXP } from "../src/defense-xp";
import { triggerLockdown, LOCKDOWN_CLOSE_TICKS } from "../src/lockdown";
import { computeStealableNow, PER_RAID_CAP_PCT, PER_DAY_CAP_PCT } from "../src/loss-cap";
// Import trực tiếp từ module errors (không kéo supabase side-effect).
import { FinalizePhase1Error } from "../src/finalize-errors.js";
import type { RaidEventRow } from "../src/replay-types";

const NOW = new Date("2026-08-10T12:00:00Z");

describe("computeShieldUntil (concept §4/§12/§13)", () => {
  it("onlineAway → +30 min", () => {
    const u = computeShieldUntil("onlineAway", NOW);
    expect(u.getTime() - NOW.getTime()).toBe(SHIELD_MS.onlineAway);
  });
  it("afterRaid → +2h", () => {
    const u = computeShieldUntil("afterRaid", NOW);
    expect(u.getTime() - NOW.getTime()).toBe(SHIELD_MS.afterRaid);
  });
  it("newPlayer → +24h", () => {
    const u = computeShieldUntil("newPlayer", NOW);
    expect(u.getTime() - NOW.getTime()).toBe(SHIELD_MS.newPlayer);
  });
});

describe("shouldGrantDefenseXP (anti-self-farm — red-team #18)", () => {
  const ev = (type: string, actorId: string): RaidEventRow => ({
    tick: 1,
    seq: 0,
    type,
    actorId,
    payload: {},
  });
  const OWNER = "owner-1";

  it("KHÔNG cấp nếu raider chỉ 1 hành động (dưới threshold)", () => {
    expect(shouldGrantDefenseXP([ev("move", "thief-1")], OWNER)).toBe(false);
  });
  it("cấp nếu raider ≥ 2 hành động thật", () => {
    expect(
      shouldGrantDefenseXP([ev("move", "thief-1"), ev("puzzleFail", "thief-1")], OWNER),
    ).toBe(true);
  });
  it("KHÔNG tính event của owner (self-farm)", () => {
    expect(
      shouldGrantDefenseXP([ev("move", OWNER), ev("puzzleFail", OWNER)], OWNER),
    ).toBe(false);
  });
  it("KHÔNG tính event system/dog", () => {
    expect(
      shouldGrantDefenseXP([ev("tick", "system"), ev("alert", "dog")], OWNER),
    ).toBe(false);
  });
  it("KHÔNG tính trap (audit H5 — trap = roadmap)", () => {
    // trap-sprung không trong RAIDER_ACTION_TYPES → move count, trap ignore → chỉ 1 < 2 → false
    expect(
      shouldGrantDefenseXP([ev("move", "thief-1"), ev("trap-sprung", "thief-1")], OWNER),
    ).toBe(false);
    // 2 move + trap → 2 counted (trap ignored) → true
    expect(
      shouldGrantDefenseXP(
        [ev("move", "thief-1"), ev("move", "thief-1"), ev("trap-sprung", "thief-1")],
        OWNER,
      ),
    ).toBe(true);
  });
});

describe("triggerLockdown (concept §11, audit M11)", () => {
  it("gateCloseTick = nowTick + LOCKDOWN_CLOSE_TICKS", () => {
    const nowTick = 1000;
    const { gateCloseTick } = triggerLockdown(nowTick);
    expect(gateCloseTick - nowTick).toBe(LOCKDOWN_CLOSE_TICKS);
  });
  it("default nowTick=0 — gateCloseTick = LOCKDOWN_CLOSE_TICKS", () => {
    const { gateCloseTick } = triggerLockdown();
    expect(gateCloseTick).toBe(LOCKDOWN_CLOSE_TICKS);
  });
});

describe("computeStealableNow (concept §13 loss-cap)", () => {
  it("per-raid 10% pool", () => {
    expect(computeStealableNow(100, 0)).toBe(10);
  });
  it("per-day 25% — còn 15 sau đã mất 10", () => {
    expect(computeStealableNow(100, 10)).toBe(10); // min(10, 25-10=15) = 10
    expect(computeStealableNow(100, 20)).toBe(5); // min(10, 25-20=5) = 5
  });
  it("per-day cạn → 0", () => {
    expect(computeStealableNow(100, 25)).toBe(0);
  });
  it("pool nhỏ → floor 0", () => {
    expect(computeStealableNow(5, 0)).toBe(0); // floor(0.5) = 0
  });
  it("hằng số đúng concept", () => {
    expect(PER_RAID_CAP_PCT).toBe(0.1);
    expect(PER_DAY_CAP_PCT).toBe(0.25);
  });
});

describe("FinalizePhase1Error (phase phân biệt — caller chặn lootApplied sai)", () => {
  it("instanceof Error + name FinalizePhase1Error", () => {
    const e = new FinalizePhase1Error(new Error("network down"));
    expect(e instanceof Error).toBe(true);
    expect(e instanceof FinalizePhase1Error).toBe(true);
    expect(e.name).toBe("FinalizePhase1Error");
    expect(e.message).toContain("finalize_raid RPC failed");
    expect(e.message).toContain("network down");
  });
  it("generic Error KHÔNG phải FinalizePhase1Error — caller set lootApplied", () => {
    const phase1 = new FinalizePhase1Error(new Error("mask fetch"));
    const generic = new Error("loot loop item 3 fail");
    expect(phase1 instanceof FinalizePhase1Error).toBe(true);
    expect(generic instanceof FinalizePhase1Error).toBe(false);
    // caller: if (!(e instanceof FinalizePhase1Error)) lootApplied=true;
    // → phase1 (loot chưa chạy) KHÔNG set flag, generic (loot partial) set flag.
  });
  it("string cause + non-Error cause", () => {
    expect(new FinalizePhase1Error("str").message).toContain("str");
    expect(new FinalizePhase1Error({ x: 1 }).message).toContain("[object Object]");
  });
});
