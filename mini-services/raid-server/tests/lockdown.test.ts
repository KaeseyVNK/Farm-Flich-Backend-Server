import { test, expect } from "bun:test";
import { triggerLockdown, LOCKDOWN_CLOSE_TICKS, shouldTriggerAutoLockdown } from "../src/lockdown.js";

test("triggerLockdown returns tick-based gateCloseTick (now + 200)", () => {
  const r = triggerLockdown(100);
  expect(r.gateCloseTick).toBe(300);
  expect(r.gateCloseTick - 100).toBe(LOCKDOWN_CLOSE_TICKS);
});

test("triggerLockdown default now = 0", () => {
  expect(triggerLockdown().gateCloseTick).toBe(LOCKDOWN_CLOSE_TICKS);
});

test("shouldTriggerAutoLockdown: away→playing + active + !lockdown → true", () => {
  expect(
    shouldTriggerAutoLockdown({
      prev: "away",
      next: "playing",
      sessionActive: true,
      lockdown: false,
    }),
  ).toBe(true);
});

test("shouldTriggerAutoLockdown: offline→playing triggers", () => {
  expect(
    shouldTriggerAutoLockdown({
      prev: "offline",
      next: "playing",
      sessionActive: true,
      lockdown: false,
    }),
  ).toBe(true);
});

test("shouldTriggerAutoLockdown: playing→playing no-op", () => {
  expect(
    shouldTriggerAutoLockdown({
      prev: "playing",
      next: "playing",
      sessionActive: true,
      lockdown: false,
    }),
  ).toBe(false);
});

test("shouldTriggerAutoLockdown: no active session → false", () => {
  expect(
    shouldTriggerAutoLockdown({
      prev: "away",
      next: "playing",
      sessionActive: false,
      lockdown: false,
    }),
  ).toBe(false);
});

test("shouldTriggerAutoLockdown: already lockdown → false (idempotent)", () => {
  expect(
    shouldTriggerAutoLockdown({
      prev: "away",
      next: "playing",
      sessionActive: true,
      lockdown: true,
    }),
  ).toBe(false);
});

test("shouldTriggerAutoLockdown: playing→away → false (owner rời đi)", () => {
  expect(
    shouldTriggerAutoLockdown({
      prev: "playing",
      next: "away",
      sessionActive: true,
      lockdown: false,
    }),
  ).toBe(false);
});
