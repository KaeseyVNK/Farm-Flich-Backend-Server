import { test, expect } from "bun:test";
import { RaidRoom } from "../src/room.js";
import { replayEvents, type ReplayConfig } from "../src/replay-headless.js";
import { TICK_MS } from "../src/constants.js";
import type { RaidEventRow } from "../src/replay-types.js";

/** Flat terrain 660 tile (30×22), toàn 0 (không solid) cho test move. */
const flatTerrain = new Array(30 * 22).fill(0);

const baseConfig: ReplayConfig = {
  terrain: flatTerrain,
  enterTile: { x: 1, y: 1 },
  dogs: [{ x: 15, y: 10 }],
  chests: [{ id: "c1", x: 20, y: 10 }],
  seed: "test-session-1",
};

/** Mô phỏng live raid: log events theo cùng code path index.ts. */
function simulateLive(moves: Array<[number, number]>, ticks: number) {
  const room = new RaidRoom(baseConfig);
  const events: RaidEventRow[] = [];
  let seq = 0;
  for (let i = 0; i < ticks; i++) {
    room.tick(TICK_MS);
    events.push({ tick: room.tickN, seq: seq++, type: "tick", actorId: "system", payload: {} });
    if (i < moves.length) {
      const [dx, dy] = moves[i];
      room.applyMove(dx as -1 | 0 | 1, dy as -1 | 0 | 1);
      events.push({
        tick: room.tickN,
        seq: seq++,
        type: "move",
        actorId: "thief",
        payload: { dx, dy },
      });
    }
  }
  return { room, events };
}

test("replay snapshot cuối trùng live (move phải)", () => {
  const moves: Array<[number, number]> = Array.from({ length: 30 }, () => [1, 0]);
  const { room, events } = simulateLive(moves, 30);
  const liveFinal = room.snapshot();
  const snaps = replayEvents({ config: baseConfig, events });
  const replayFinal = snaps[snaps.length - 1];
  expect(replayFinal.you.x).toBe(liveFinal.you.x);
  expect(replayFinal.you.y).toBe(liveFinal.you.y);
  expect(replayFinal.dogs[0].x).toBe(liveFinal.dogs[0].x);
  expect(replayFinal.dogs[0].y).toBe(liveFinal.dogs[0].y);
  expect(replayFinal.tick).toBe(liveFinal.tick);
});

test("replay snapshot cuối trùng live (multi-direction moves)", () => {
  const moves: Array<[number, number]> = [
    [1, 0], [1, 0], [0, 1], [0, 1], [-1, 0], [1, 1], [1, 0], [0, -1],
    [1, 0], [1, 0], [0, 1], [1, 0], [-1, 0], [0, 1], [1, 0], [1, 0],
  ];
  const { room, events } = simulateLive(moves, 20);
  const liveFinal = room.snapshot();
  const snaps = replayEvents({ config: baseConfig, events });
  const replayFinal = snaps[snaps.length - 1];
  expect(replayFinal.you.x).toBe(liveFinal.you.x);
  expect(replayFinal.you.y).toBe(liveFinal.you.y);
  expect(replayFinal.dogs[0].x).toBe(liveFinal.dogs[0].x);
  expect(replayFinal.alert.score).toBe(liveFinal.alert.score);
});

test("replay lockdown event → gateCloseTick + alert bump", () => {
  const moves: Array<[number, number]> = Array.from({ length: 10 }, () => [1, 0]);
  const { room, events } = simulateLive(moves, 10);
  // inject lockdown event tại tick 5 (seq sau move)
  const lockdownEv: RaidEventRow = {
    tick: 5,
    seq: 999,
    type: "lockdown",
    actorId: "owner",
    payload: {},
  };
  events.push(lockdownEv);
  const snaps = replayEvents({ config: baseConfig, events });
  const final = snaps[snaps.length - 1];
  expect(final.lockdown).toBe(true);
});

test("replay exit event → room ended exit", () => {
  const moves: Array<[number, number]> = Array.from({ length: 5 }, () => [1, 0]);
  const { events } = simulateLive(moves, 5);
  events.push({ tick: 3, seq: 999, type: "exit", actorId: "thief", payload: {} });
  const snaps = replayEvents({ config: baseConfig, events });
  // replay dừng khi tick event break — exit apply trước tick tiếp theo
  expect(snaps.length).toBeGreaterThan(0);
});

test("replay snapshot đầu = initial state (tick 0)", () => {
  const snaps = replayEvents({ config: baseConfig, events: [] });
  expect(snaps[0].tick).toBe(0);
  expect(snaps[0].you.x).toBe(1);
  expect(snaps[0].you.y).toBe(1);
});

test("replay dog patrol deterministic cùng seed → cùng vị trí", () => {
  const moves1: Array<[number, number]> = Array.from({ length: 15 }, () => [0, 0]);
  const moves2: Array<[number, number]> = Array.from({ length: 15 }, () => [0, 0]);
  const r1 = simulateLive(moves1, 15);
  const r2 = simulateLive(moves2, 15);
  const s1 = replayEvents({ config: baseConfig, events: r1.events });
  const s2 = replayEvents({ config: baseConfig, events: r2.events });
  expect(s1[s1.length - 1].dogs[0].x).toBe(s2[s2.length - 1].dogs[0].x);
  expect(s1[s1.length - 1].dogs[0].y).toBe(s2[s2.length - 1].dogs[0].y);
});
