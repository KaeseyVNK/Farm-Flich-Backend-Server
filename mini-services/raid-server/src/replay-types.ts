/**
 * Pure replay types + helpers (KHÔNG import supabase — test được không cần env).
 * Replay log (concept §12, red-team #7). Tick-based event cho replay roadmap (full re-sim).
 * audit M2: unique (sessionId, tick, seq).
 */
export interface RaidEventRow {
  tick: number;
  seq: number;
  type: string; // move | chestOpen | puzzleFail | puzzleSolve | bite | alert | lockdown | exit
  actorId: string;
  payload: Record<string, unknown>;
}

/** Pure: events chưa in-flight flush (seq > flushedSeq). Test được không cần DB. */
export function filterUnflushedEvents(
  events: RaidEventRow[],
  flushedSeq: number,
): RaidEventRow[] {
  return events.filter((e) => e.seq > flushedSeq);
}
