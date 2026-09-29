import { describe, it, expect } from "bun:test";
import {
  computeDefenseXp,
  DEFENSE_XP_BASE,
  DEFENSE_XP_ALARM_BONUS,
  DEFENSE_XP_TRAP_BONUS,
  DEFENSE_XP_CAP_PER_RAID,
  type DefenseXpModifiers,
} from "../src/defense-xp";
import type { RaidEventRow } from "../src/replay-types";

const ev = (type: string, actorId: string): RaidEventRow => ({
  tick: 1,
  seq: 0,
  type,
  actorId,
  payload: {},
});
const OWNER = "owner-1";
const THIEF = "thief-1";

describe("computeDefenseXp severity-scaled (phase 3)", () => {
  it("no-action (< threshold) → 0", () => {
    expect(computeDefenseXp([ev("move", THIEF)], OWNER)).toBe(0);
  });
  it("anti-self-farm — owner actions → 0", () => {
    expect(computeDefenseXp([ev("move", OWNER), ev("move", OWNER)], OWNER)).toBe(0);
  });
  it("threshold (2 raider actions) → BASE", () => {
    expect(computeDefenseXp([ev("move", THIEF), ev("move", THIEF)], OWNER)).toBe(DEFENSE_XP_BASE);
  });
  it("+alarm reached → BASE + ALARM_BONUS", () => {
    const mods: DefenseXpModifiers = { reachedAlarm: true };
    expect(computeDefenseXp([ev("move", THIEF), ev("move", THIEF)], OWNER, mods)).toBe(
      DEFENSE_XP_BASE + DEFENSE_XP_ALARM_BONUS,
    );
  });
  it("+trapSprung → BASE + TRAP_BONUS each (reverse audit H5)", () => {
    const events = [ev("move", THIEF), ev("move", THIEF), ev("trapSprung", THIEF), ev("trapSprung", THIEF)];
    expect(computeDefenseXp(events, OWNER)).toBe(DEFENSE_XP_BASE + 2 * DEFENSE_XP_TRAP_BONUS);
  });
  it("caught + lootValue → BASE + lootValue/10", () => {
    const mods: DefenseXpModifiers = { caught: true, lootValue: 100 };
    expect(computeDefenseXp([ev("move", THIEF), ev("move", THIEF)], OWNER, mods)).toBe(
      DEFENSE_XP_BASE + 10,
    );
  });
  it("cap PER_RAID — không vượt 50", () => {
    const events = [ev("move", THIEF), ev("move", THIEF)];
    for (let i = 0; i < 30; i++) events.push(ev("trapSprung", THIEF));
    const mods: DefenseXpModifiers = { reachedAlarm: true, caught: true, lootValue: 500 };
    const xp = computeDefenseXp(events, OWNER, mods);
    expect(xp).toBe(DEFENSE_XP_CAP_PER_RAID);
  });
  it("trapSprung của owner KHÔNG count (anti-self trigger)", () => {
    const events = [ev("move", THIEF), ev("move", THIEF), ev("trapSprung", OWNER)];
    expect(computeDefenseXp(events, OWNER)).toBe(DEFENSE_XP_BASE); // chỉ base, trap owner ignore
  });
});
