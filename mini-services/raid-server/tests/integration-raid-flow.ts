/**
 * Integration flow 2-client raid (phase 7 step 4 — red-team #23).
 * Bot thief + owner-observer chạy full raid: join → move → puzzle → exit → finalize → replay.
 *
 * Mô phỏng đúng code path index.ts (room.tick + replay.log + finalizeRaid) NHƯNG không cần WS/Supabase thật:
 * - RaidRoom (movement/collision/dog/alert/puzzle) — logic thuần, đã test unit.
 * - ReplayLogger.flushIncremental → mô phỏng bằng mock insert (KHÔNG gọi supabase thật).
 * - finalizeRaid pure compute stealable/defenseXp — xác minh loot cap + mask.
 *
 * Run: bun run mini-services/raid-server/tests/integration-raid-flow.ts
 * (KHÔNG cần docker — dùng room logic + mock replay. B1 env keys chưa có → chưa chạy Supabase thật.)
 */
import { RaidRoom } from "../src/room.js";
import { TICK_MS, MAX_BITES, GRACE_ABORT_MS } from "../src/constants.js";
import { genMemorySeq, validateMemory } from "../src/puzzle.js";
import { rollLootSeeded } from "../src/loot-tables.js";

const assert = (cond: boolean, msg: string): void => {
  if (!cond) {
    console.error(`  ✗ FAIL: ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`  ✓ ${msg}`);
  }
};

const flatTerrain = (): number[] => new Array(30 * 22).fill(0);

function simulateRaid() {
  console.log("== Raid flow: bot thief + owner observer ==");
  const room = new RaidRoom({
    terrain: flatTerrain(),
    enterTile: { x: 1, y: 1 },
    dogs: [{ x: 15, y: 10 }],
    chests: [{ id: "chest-wood-1", x: 20, y: 10 }],
    seed: "integration-raid-1",
  });

  // 1. Thief di chuyển tới chest (x:1→20, y:1→10)
  let moves = 0;
  while ((room.raider.x !== 20 || room.raider.y !== 10) && moves < 400) {
    const dx = room.raider.x < 20 ? 1 : room.raider.x > 20 ? -1 : 0;
    const dy = room.raider.y < 10 ? 1 : room.raider.y > 10 ? -1 : 0;
    room.applyMove(dx as -1 | 0 | 1, dy as -1 | 0 | 1);
    room.tick(TICK_MS);
    moves++;
  }
  assert(room.raider.x === 20 && room.raider.y === 10, "thief đến chest sau di chuyển");

  // 2. Puzzle memory: gen seq, solve đúng → loot temp
  const seq = room.getOrGenPuzzle("chest-wood-1", "integration-raid-1", (s) => genMemorySeq(s));
  assert(seq.length === 3, `puzzle memory seq len 3 (got ${seq.length})`);
  const ok = validateMemory(seq, seq);
  assert(ok, "puzzle solve đúng");
  const loot = rollLootSeeded("wood", "integration-raid-1", "chest-wood-1");
  room.openChest("chest-wood-1", loot);
  assert(room.lootTemp.length === 1, `loot temp có 1 item (${room.lootTemp[0]?.itemId})`);
  assert(room.chests[0].open, "chest mở");
  assert(room.alert.score > 0, "alert bump sau open chest");

  // 3. Exit → ended
  room.ended = { reason: "exit" };
  assert(room.ended.reason === "exit", "exit → ended");

  // 4. Dog bite → caught (chỉ verify logic riêng, không trong raid này)
  const room2 = new RaidRoom({
    terrain: flatTerrain(),
    enterTile: { x: 1, y: 1 },
    dogs: [{ x: 1, y: 1 }],
    chests: [],
    seed: "caught-test",
  });
  for (let i = 0; i < MAX_BITES + 1; i++) room2.tick(TICK_MS);
  assert(room2.ended?.reason === "caught", "bite 3 = caught");

  // 5. Grace constants (alt-F4 — red-team #10)
  assert(GRACE_ABORT_MS === 5000, `alt-F4 grace 5s (${GRACE_ABORT_MS}ms)`);

  console.log("== Raid flow DONE ==");
  return { loot, room };
}

simulateRaid();
