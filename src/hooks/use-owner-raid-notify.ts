"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUiStore } from "@/store/uiStore";

/**
 * Owner raid notify (concept §11). Subscribe Realtime RaidSession INSERT (ownerId=self).
 * Khi farm bị raid → toast. Nếu owner đang ở farm view → POST /lockdown trigger.
 *
 * audit M5: owner presence online → raid ineligible. Hook này là cạnh báo + lockdown trigger.
 * Review M: deps [] — subscribe 1 lần, isPlayingFarm đọc qua ref (trước đây
 * resubscribe mỗi lần play-state flip = missed-toast windows). Toast qua uiStore
 * (console.warn không user-visible).
 */
export function useOwnerRaidNotify(isPlayingFarm: boolean) {
  const playingRef = useRef(isPlayingFarm);

  useEffect(() => {
    playingRef.current = isPlayingFarm;
  }, [isPlayingFarm]);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (!active || !data.user) return;
      channel = supabase
        .channel(`owner-raid:${data.user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "RaidSession",
            filter: `ownerId=eq.${data.user.id}`,
          },
          (payload) => {
            const farmId = (payload.new as { farmId?: string })?.farmId;
            useUiStore.getState().notify("⚠️ Farm đang bị trộm cướp!", "error");
            // Owner đang ở farm → trigger lockdown (concept §11). Trước đây
            // .catch(()=>{}) silent — network blip/5xx/CORS → owner không biết
            // lockdown fail, raider vẫn loot. Log + retry 1 lần.
            if (playingRef.current && farmId) {
              const url = `${process.env.NEXT_PUBLIC_RAID_HTTP_URL ?? "http://localhost:3002"}/lockdown?farmId=${farmId}`;
              void fetch(url, { method: "POST", credentials: "include" })
                .catch((e) => {
                  console.error("[raid] lockdown trigger fail, retry 1:", e);
                  return fetch(url, { method: "POST", credentials: "include" });
                })
                .catch((e) => console.error("[raid] lockdown trigger fail (final):", e));
            }
          },
        )
        .subscribe();
    });
    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);
}
