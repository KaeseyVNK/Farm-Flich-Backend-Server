import { supabase } from "./supabase.js";
import { filterUnflushedEvents, type RaidEventRow } from "./replay-types.js";

/**
 * Replay log (concept §12, red-team #7). Ring-buffer per room, flush Postgres khi raid-end.
 * Event tick-based (không wall-clock) cho replay roadmap (full re-sim). audit M2: unique (sessionId, tick, seq).
 */

export { filterUnflushedEvents, type RaidEventRow } from "./replay-types.js";

export class ReplayLogger {
  private events: RaidEventRow[] = [];
  private seq = 0;
  /** Đã in-flight flush đến seq này (KHÔNG xóa khỏi buffer — raid-end vẫn cần full replay). */
  private flushedSeq = -1;

  log(tick: number, type: string, actorId: string, payload: Record<string, unknown> = {}): void {
    this.events.push({ tick, seq: this.seq++, type, actorId, payload });
    // Cap 20000 (~33min raid @ 10Hz tick log — audit H1). Slice batch thay shift O(n)/event.
    if (this.events.length > 20000) this.events = this.events.slice(-18000);
  }

  /** Bản sao events hiện tại (cho finalize defense-XP check trước khi flush). */
  peek(): RaidEventRow[] {
    return [...this.events];
  }

  /**
   * In-flight flush (red-team #10): ghi batch events CHƯA flush (seq > flushedSeq) mỗi 5s,
   * KHÔNG xóa buffer — dữ liệu chống mất khi crash, raid-end vẫn flush full.
   */
  async flushIncremental(sessionId: string): Promise<void> {
    const pending = filterUnflushedEvents(this.events, this.flushedSeq);
    if (pending.length === 0) return;
    const rows = pending.map((e) => ({
      id: crypto.randomUUID(),
      sessionId,
      tick: e.tick,
      seq: e.seq,
      type: e.type,
      actorId: e.actorId,
      payload: e.payload,
    }));
    const { error } = await supabase.from("RaidEvent").insert(rows);
    if (error) {
      console.error("[replay] incremental flush error", error.message);
      return;
    }
    this.flushedSeq = pending[pending.length - 1].seq;
  }

  async flush(sessionId: string): Promise<void> {
    if (this.events.length === 0) return;
    // Chỉ insert events chưa flush (tránh unique (sessionId, tick, seq) conflict — audit M2).
    const pending = filterUnflushedEvents(this.events, this.flushedSeq);
    if (pending.length > 0) {
      const rows = pending.map((e) => ({
        id: crypto.randomUUID(),
        sessionId,
        tick: e.tick,
        seq: e.seq,
        type: e.type,
        actorId: e.actorId,
        payload: e.payload,
      }));
      const { error } = await supabase.from("RaidEvent").insert(rows);
      if (error) console.error("[replay] flush error", error.message);
    }
    this.events = [];
    this.flushedSeq = -1;
  }
}
