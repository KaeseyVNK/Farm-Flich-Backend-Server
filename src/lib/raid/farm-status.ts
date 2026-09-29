"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { FarmStatus } from "@/lib/raid/eligibility";

/**
 * useFarmStatus — báo trạng thái farm (away|playing|offline) qua Supabase Realtime presence.
 * - `playing` = GameCanvas mounted (owner đang ở farm) → chặn raid (audit M5).
 * - Heartbeat 30s giữ presence sống; expire 60s server-side → offline.
 *
 * raid-server + lobby query presence channel `farm-status:<ownerId>` để biết owner vắng mặt.
 * Presence = HINT (không phải authoritative gate); gate = RaidSession.status (DB).
 */
const HEARTBEAT_MS = 30_000;

export function useFarmStatus(ownerId: string | null, status: FarmStatus) {
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);

  useEffect(() => {
    if (!ownerId) return;
    const supabase = createClient();
    const channel = supabase.channel(`farm-status:${ownerId}`, {
      config: { presence: { key: ownerId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {})
      .subscribe(async (state) => {
        if (state === "SUBSCRIBED") {
          await channel.track({ ownerId, status, ts: Date.now() });
        }
      });
    channelRef.current = channel;

    // Heartbeat — refresh status + ts để server biết còn sống.
    const hb = setInterval(() => {
      channel.track({ ownerId, status, ts: Date.now() });
    }, HEARTBEAT_MS);

    return () => {
      clearInterval(hb);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [ownerId, status]);
}
