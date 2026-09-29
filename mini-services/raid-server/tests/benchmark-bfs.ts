/**
 * BFS benchmark (audit C3/perf). Map 30×22 = 660 tile. Dog path-find mỗi tick.
 * Mục tiêu: < 1ms/path trên map full grass (L1 cache hit khi target không đổi).
 * Run: bun run tests/benchmark-bfs.ts
 */
import { bfsNext, solidFromTerrain } from "../src/dog";
import { MAP_COLS, T } from "../src/constants";

const ROWS = 22;
const grass = (): number[] => new Array(MAP_COLS * ROWS).fill(T.GRASS);
const solid = solidFromTerrain(grass());

const N = 1000;
const start = { x: 0, y: 0 };
const target = { x: MAP_COLS - 1, y: ROWS - 1 };

// Warm cache
bfsNext(start, target, solid);

const t0 = performance.now();
for (let i = 0; i < N; i++) bfsNext(start, target, solid);
const elapsed = performance.now() - t0;

const perCall = elapsed / N;
console.log(`BFS ${N} calls: ${elapsed.toFixed(2)}ms total, ${perCall.toFixed(4)}ms/call`);
console.log(`Map ${MAP_COLS}x${ROWS} (${MAP_COLS * ROWS} tiles). Target: ${perCall < 1 ? "✓" : "✗"} < 1ms/call`);
if (perCall >= 1) {
  console.error("FAIL: BFS vượt 1ms/call budget");
  process.exit(1);
}
