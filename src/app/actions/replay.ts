"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { RaidSnapshot } from "@/lib/raid/types";

/**
 * Replay action (concept §12, audit M9 owner-only authz).
 * Load RaidEvent timeline cho sessionId — chỉ owner farm hoặc thief được xem.
 * Phase 9: owner → thêm snaps (full re-sim qua raid-server /replay endpoint).
 */

export interface ReplayEventDto {
  tick: number;
  seq: number;
  type: string;
  actorId: string;
}

export async function loadReplayAction(
  sessionId: string,
): Promise<
  | { events: ReplayEventDto[]; reason: string | null; snaps?: RaidSnapshot[] }
  | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthorized" };

  const { data: session, error } = await supabase
    .from("RaidSession")
    .select("ownerId, thiefId, status, resultJson")
    .eq("id", sessionId)
    .maybeSingle();
  if (error || !session) return { error: "not_found" };
  const s = session as { ownerId: string; thiefId: string; resultJson: unknown };
  if (s.ownerId !== user.id && s.thiefId !== user.id) return { error: "forbidden" };

  const { data: rows } = await supabase
    .from("RaidEvent")
    .select("tick, seq, type, actorId")
    .eq("sessionId", sessionId)
    .order("tick", { ascending: true })
    .order("seq", { ascending: true });

  const events = (rows ?? []) as ReplayEventDto[];
  const reason = (s.resultJson as { reason?: string } | null)?.reason ?? null;

  // Phase 9: owner → load snaps qua raid-server re-sim. Forward cookie cho authz.
  let snaps: RaidSnapshot[] | undefined;
  if (s.ownerId === user.id) {
    try {
      const h = await headers();
      const base = process.env.RAID_HTTP_URL ?? "http://localhost:3002";
      const r = await fetch(`${base}/replay?sessionId=${encodeURIComponent(sessionId)}`, {
        headers: { cookie: h.get("cookie") ?? "" },
      });
      if (r.ok) {
        const data = (await r.json()) as { snaps?: RaidSnapshot[] };
        snaps = data.snaps;
      }
    } catch {
      // raid-server offline → fallback timeline-only
    }
  }

  return { events, reason, snaps };
}
