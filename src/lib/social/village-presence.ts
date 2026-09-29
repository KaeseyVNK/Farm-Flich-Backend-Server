"use client";

import { useEffect, useState, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

/**
 * Village presence (phase 8). Supabase Realtime presence — no game loop server.
 * Channel `village:default`. Track {displayName, maskId, x, y, ts}. Sync qua presence.
 */

export interface VillagePlayer {
  userId: string;
  displayName: string;
  maskId: string;
  x: number;
  y: number;
}

/** Rate-limit chat 10 msg/min (in-memory per user). */
export function chatRateLimit(history: number[], now: number, windowMs = 60_000, max = 10): boolean {
  const recent = history.filter((t) => now - t < windowMs);
  return recent.length < max;
}

export function useVillagePresence(initial: { x: number; y: number }) {
  const [players, setPlayers] = useState<Record<string, VillagePlayer>>({});
  const [self, setSelf] = useState<VillagePlayer>({
    userId: "",
    displayName: "",
    maskId: "rogue",
    ...initial,
  });
  const lastTrack = useRef(0);
  const channelRef = useRef<RealtimeChannel | null>(null);
  // selfRef giữ latest self cho re-track khi channel reconnect. Trước đây capture
  // `me` trong closure subscribe → re-subscribe (sau socket drop) track lại `me`
  // stale (vị trí đầu session) cho đến khi move() đầu tiên. Sync trong effect
  // (không ghi ref trong render — react-hooks/refs).
  const selfRef = useRef(self);
  useEffect(() => {
    selfRef.current = self;
  }, [self]);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active || !user) return;
      const { data: mask } = await supabase
        .from("Mask")
        .select("maskId")
        .eq("userId", user.id)
        .eq("equipped", true)
        .maybeSingle();
      // Review F6: displayName từ user_public (server-vetted) thay user_metadata
      // (user tự sửa được → impersonation). Fallback id slice khi chưa có row.
      const { data: pubRow } = await supabase
        .from("user_public")
        .select("displayName")
        .eq("id", user.id)
        .maybeSingle();
      const me: VillagePlayer = {
        userId: user.id,
        displayName:
          ((pubRow as { displayName?: string | null } | null)?.displayName || user.user_metadata?.displayName as string) ??
          user.id.slice(0, 6),
        maskId: (mask as { maskId?: string })?.maskId ?? "rogue",
        ...initial,
      };
      setSelf(me);
      selfRef.current = me;
      const channel = supabase
        .channel("village:default", { config: { presence: { key: user.id } } })
        .on("presence", { event: "sync" }, () => {
          const state = channel.presenceState() as Record<string, VillagePlayer[]>;
          const map: Record<string, VillagePlayer> = {};
          for (const [presenceKey, list] of Object.entries(state)) {
            for (const p of list) {
              if (!p.userId) continue;
              // Review F5: presence key Supabase mặc định = client-generated UUID,
              // NHƯNG ta track với key=ownerId (farm-status pattern) hoặc default.
              // Payload userId tự khai — chỉ tin khi khớp presence key HOẶC là
              // chính mình. Khác → impersonation attempt → drop.
              if (p.userId !== presenceKey && p.userId !== user.id) continue;
              // Clamp vị trí nhận được — malicious client có thể track x/y ngoài
              // grid 40×30 qua console. NaN slip qua clamp cũ → guard isFinite.
              const px = Number(p.x);
              const py = Number(p.y);
              if (!Number.isFinite(px) || !Number.isFinite(py)) continue;
              map[p.userId] = {
                ...p,
                x: Math.max(0, Math.min(39, Math.floor(px))),
                y: Math.max(0, Math.min(29, Math.floor(py))),
              };
            }
          }
          setPlayers(map);
        })
        .subscribe(async (status) => {
          // Re-track latest self trên mỗi SUBSCRIBED (kể cả reconnect sau error).
          if (status === "SUBSCRIBED") await channel.track(selfRef.current);
        });
      channelRef.current = channel;
    })();

    return () => {
      active = false;
      // Reuse supabase instance đã tạo channel — trước đây createClient() mới
      // trong cleanup → wrong-instance removeChannel (channel không rời client cũ,
      // +1 leak socket). Cùng instance gỡ đúng.
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
    // Chạy 1 lần (mount) — initial/selfRef đọc qua ref tại subscribe time, không
    // cần re-subscribe khi prop đổi. SetState selfRef effect riêng ở trên.
  }, []);

  /** Move WASD — throttle track 50ms. Re-track presence để others thấy vị trí mới. */
  const move = (dx: number, dy: number) => {
    const now = Date.now();
    if (now - lastTrack.current < 50) return;
    lastTrack.current = now;
    setSelf((s) => {
      const next = { ...s, x: Math.max(0, Math.min(39, s.x + dx)), y: Math.max(0, Math.min(29, s.y + dy)) };
      void channelRef.current?.track(next);
      return next;
    });
  };

  return { players, self, move };
}
