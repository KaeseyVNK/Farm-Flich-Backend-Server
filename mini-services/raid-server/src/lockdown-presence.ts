import type { SupabaseClient } from "@supabase/supabase-js";
import type { OwnerPresence } from "./lockdown.js";

/**
 * Owner presence auto-detect (phase 9 F9.2).
 * raid-server subscribe `farm-status:<ownerId>` Realtime channel.
 * Owner track `{status: "playing"|"away"}`. Transition away/offline → playing + active raid → auto lockdown.
 */

interface PresencePayload {
  status?: string;
}

/** Pure: derive owner presence state từ Realtime presenceState map. */
export function derivePresenceState(
  state: Record<string, PresencePayload[]>,
  ownerId: string,
): OwnerPresence {
  const list = state[ownerId] ?? [];
  if (list.length === 0) return "offline";
  return list.some((p) => p.status === "playing") ? "playing" : "away";
}

/**
 * Check presence một lần (cho join/lobby gate — audit M5): subscribe channel,
 * đợi sync, đọc presenceState, rồi unsubscribe. Trả OwnerPresence.
 * Presence = HINT (gate chính vẫn là RaidSession status DB), nhưng chặn
 * join farm đang có owner `playing` (audit M5 — owner đang ở farm).
 */
export async function checkOwnerPresenceOnce(
  supabase: SupabaseClient,
  ownerId: string,
  timeoutMs = 3000,
): Promise<OwnerPresence> {
  const channel = supabase.channel(`farm-status:${ownerId}`);
  try {
    const state = await new Promise<Record<string, PresencePayload[]>>((resolve) => {
      const timer = setTimeout(() => resolve({}), timeoutMs);
      channel
        .on("presence", { event: "sync" }, () => {
          clearTimeout(timer);
          resolve(channel.presenceState<PresencePayload>());
        })
        .subscribe((status) => {
          // Nếu subscribe thành công ngay và đã có presence state → resolve.
          if (status === "SUBSCRIBED") {
            const st = channel.presenceState<PresencePayload>();
            if (Object.keys(st).length > 0) {
              clearTimeout(timer);
              resolve(st);
            }
          }
        });
    });
    return derivePresenceState(state, ownerId);
  } finally {
    await supabase.removeChannel(channel);
  }
}

/**
 * Subscribe owner farm-status presence. Emit state mỗi transition.
 * Caller check shouldTriggerAutoLockdown + grace debounce (2s) trước khi triggerLockdown.
 * Trả unsubscribe fn.
 */
export function subscribeOwnerPresence(
  supabase: SupabaseClient,
  ownerId: string,
  onState: (next: OwnerPresence) => void,
): () => void {
  let prev: OwnerPresence = "offline";
  const channel = supabase.channel(`farm-status:${ownerId}`);
  channel
    .on("presence", { event: "sync" }, () => {
      const next = derivePresenceState(
        channel.presenceState<PresencePayload>(),
        ownerId,
      );
      if (next === prev) return;
      prev = next;
      onState(next);
    })
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
