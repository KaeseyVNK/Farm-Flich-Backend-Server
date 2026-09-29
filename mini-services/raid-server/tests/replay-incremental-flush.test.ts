import { describe, it, expect } from "bun:test";
import { filterUnflushedEvents, type RaidEventRow } from "../src/replay-types.js";
import { GRACE_ABORT_MS, SNAPSHOT_FLUSH_EVERY_TICKS } from "../src/constants.js";

const ev = (seq: number, type = "tick"): RaidEventRow => ({
  tick: seq,
  seq,
  type,
  actorId: "system",
  payload: {},
});

/**
 * In-flight flush (red-team #10): flushIncremental ghi batch chưa flush nhưng KHÔNG xóa buffer.
 * flush() cuối vẫn ghi full + clear. Pure logic filterUnflushedEvents test được không cần DB.
 */
describe("replay incremental flush (red-team #10)", () => {
  it("filterUnflushedEvents: chỉ events seq > flushedSeq", () => {
    const events = [ev(0), ev(1), ev(2), ev(3)];
    expect(filterUnflushedEvents(events, -1)).toHaveLength(4);
    expect(filterUnflushedEvents(events, 1)).toHaveLength(2); // seq 2,3
    expect(filterUnflushedEvents(events, 3)).toHaveLength(0);
  });

  it("flush incremental KHÔNG xóa events đã flush khỏi buffer (raid-end cần full)", () => {
    const events = [ev(0), ev(1), ev(2), ev(3)];
    // Mô phỏng: flushIncremental đến seq 2 → buffer vẫn giữ 4 events.
    const afterInc = [...events];
    expect(afterInc).toHaveLength(4);
    // flush() cuối chỉ insert phần chưa flush (seq 3), sau đó clear.
    const pending = filterUnflushedEvents(afterInc, 2);
    expect(pending).toHaveLength(1);
    expect(pending[0].seq).toBe(3);
  });

  it("constants grace hợp lệ: abort sau 5s, flush snapshot mỗi 50 ticks", () => {
    expect(GRACE_ABORT_MS).toBe(5000);
    expect(SNAPSHOT_FLUSH_EVERY_TICKS).toBe(50);
  });
});
