"use client";

import { useEffect, useState } from "react";
import { syncFarmCloud } from "@/lib/game/actions";
import { createClient } from "@/lib/supabase/client";
import { effectiveRaidCap, canRaidToday } from "@/lib/game/raid-cap";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useReputationStore } from "@/store/reputationStore";
import { useUiStore } from "@/store/uiStore";
import { VenetianMask, Wheat, Waves, Trees, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface FarmTarget {
  id: string;
  ownerId: string;
  shieldUntil: string | null;
  dailyRaidCount: number;
  owner?: { displayName: string | null };
}

/**
 * Check presence 1 lần cho ownerId (audit M5 — Lobby chỉ list farm owner away/offline).
 * Subscribe channel `farm-status:<ownerId>`, đợi sync, đọc status. KHÔNG phải authoritative
 * gate — đó là raid-server join (DB + presence check).
 */
async function isOwnerPlaying(ownerId: string, supabase: ReturnType<typeof createClient>): Promise<boolean> {
  const channel: RealtimeChannel = supabase.channel(`farm-status:${ownerId}`);
  try {
    return await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), 2500);
      channel
        .on("presence", { event: "sync" }, () => {
          const state = channel.presenceState<{ status?: string }>();
          const playing = Object.values(state).some((list) =>
            list.some((p) => p.status === "playing"),
          );
          clearTimeout(timer);
          resolve(playing);
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            const state = channel.presenceState<{ status?: string }>();
            if (Object.keys(state).length > 0) {
              clearTimeout(timer);
              resolve(Object.values(state).some((list) => list.some((p) => p.status === "playing")));
            }
          }
        });
    });
  } finally {
    await supabase.removeChannel(channel);
  }
}

/**
 * Lobby — list farm mục tiêu (owner away/offline + shield hết hạn + migrated).
 * Mask gate (concept §6): thief phải có mask durability > 0.
 * Presence check (audit M5): farm nào owner đang `playing` → ẩn khỏi danh sách.
 */
const MAPS: { id: string; label: string; icon: LucideIcon; hint: string }[] = [
  { id: "farm", label: "Ruộng", icon: Wheat, hint: "Cân bằng" },
  { id: "beach", label: "Biển", icon: Waves, hint: "Dog thấy xa" },
  { id: "forest", label: "Rừng", icon: Trees, hint: "Dog thấy gần" },
];

export function Lobby(props: {
  onJoin: (farmId: string, mapId: string, farmName?: string) => void;
  onClose: () => void;
}) {
  const supabase = createClient();
  const [farms, setFarms] = useState<FarmTarget[]>([]);
  const [maskOk, setMaskOk] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mapId, setMapId] = useState("farm");
  // W7d-P3 (review W7 #11): reactive + refresh sau raid (finalize bump thief rep).
  const thiefRep = useReputationStore((s) => s.thief);

  // W7a-P3: vào raid lobby — push farm mình lên cloud (throttle) để day máu
  // trăng server-read fresh trước khi tham gia (thief cũng là owner của farm khác).
  useEffect(() => {
    syncFarmCloud();
    // Review W7 #11: raid vừa finalize có thể đã bump thief rep — refresh cache.
    void import("@/app/actions/reputation")
      .then((m) => m.getReputationAction())
      .then((r) => useReputationStore.getState().setAll(r))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          if (!cancelled) setLoading(false);
          return;
        }
        // Mask gate
        const { data: mask } = await supabase
          .from("Mask")
          .select("durability")
          .eq("userId", user.id)
          .eq("equipped", true)
          .gt("durability", 0)
          .maybeSingle();
        if (!cancelled) setMaskOk(!!mask);

        const { data } = await supabase.rpc("list_raidable_farms");
        const rows = ((data ?? []) as {
          id: string;
          ownerId: string;
          shieldUntil: string | null;
          dailyRaidCount: number;
          displayName: string | null;
        }[]).map((r) => ({
          id: r.id,
          ownerId: r.ownerId,
          shieldUntil: r.shieldUntil,
          dailyRaidCount: r.dailyRaidCount,
          owner: { displayName: r.displayName },
        }));
        // Lọc farm owner đang `playing` (presence — audit M5). Parallel Promise.all
        // thay vì sequential for-await: 20 farm × 2.5s timeout = ≤50s loading → 2.5s
        // worst-case. Supabase realtime channel limit 100/ client → 20 channel an toàn.
        const playingFlags = await Promise.all(
          rows.map((f) => isOwnerPlaying(f.ownerId, supabase)),
        );
        const raidable = rows.filter((_, i) => !playingFlags[i]);
        if (!cancelled) {
          setFarms(raidable);
          setLoading(false);
        }
      } catch {
        // Network/Supabase error → setLoading(false) chặn Lobby stuck "Đang tải…".
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  return (
    <div className="absolute inset-0 z-[7] flex items-center justify-center bg-black/60">
      <div className="max-h-[80vh] w-96 overflow-y-auto rounded border-2 border-[#4a3119] bg-[#fffaf0] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="f-display flex items-center gap-1.5 text-sm text-[#8b5cf6]">
            <VenetianMask className="h-4 w-4" /> Chọn farm mục tiêu
          </h3>
          <button onClick={props.onClose} className="text-[#6b5b45]" aria-label="Đóng">
            <X className="h-4 w-4" />
          </button>
        </div>
        {!maskOk && (
          <p className="mb-3 rounded border-2 border-[#c0452f] bg-[#fbe4df] p-2 text-xs text-[#c0452f]">
            Cần mặt nạ (durability &gt; 0) để đi trộm.
          </p>
        )}
        {/* W7d-P3: bảng truy nã — top trộm + treo thưởng. */}
        <button
          onClick={() => useUiStore.getState().openPanel("bounty")}
          className="mb-3 w-full rounded border-2 border-[#4a3119] bg-[#e8d9b5] px-2 py-1.5 text-xs font-bold text-[#3b2f23] hover:bg-[#f0e3c4]"
          data-testid="open-bounty-board"
        >
          🪧 Bảng truy nã — treo thưởng kẻ trộm
        </button>
        {/* W7d-P2: thief rep — chợ đen Jack mở ở 50 (beach wharf). */}
        <p className="mb-3 rounded border-2 border-[#c9b68c] bg-[#fff7e2] p-2 text-xs text-[#5a4a36]" data-testid="lobby-thief-rep">
          🏴‍☠️ Danh tiếng Trộm: <span className="font-bold">{thiefRep}</span>/50
          {thiefRep < 50 && " — thoát raid thành công để mở chợ đen Jack"}
        </p>
        <div className="mb-3">
          <p className="mb-1 text-xs font-bold text-[#5a4a36]">Bản đồ:</p>
          <div className="flex gap-1">
            {MAPS.map((m) => (
              <button
                key={m.id}
                onClick={() => setMapId(m.id)}
                className={`flex flex-1 flex-col items-center gap-0.5 rounded border px-1 py-1.5 text-[10px] font-bold ${
                  mapId === m.id ? "border-[var(--mystic)] bg-[var(--mystic)] text-white" : "border-[#4a3119] bg-[#efe2c4] text-[#3b2f23]"
                }`}
              >
                <m.icon className="h-3.5 w-3.5" />
                {m.label}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <p className="text-sm text-[#6b5b45]">Đang tải…</p>
        ) : farms.length === 0 ? (
          <p className="text-sm text-[#6b5b45]">Không có farm mục tiêu lúc này.</p>
        ) : (
          <div className="space-y-2">
            {farms.map((f) => (
              <button
                key={f.id}
                disabled={!maskOk || !canRaidToday(f.dailyRaidCount)}
                onClick={() => props.onJoin(f.id, mapId, f.owner?.displayName ?? f.ownerId.slice(0, 6))}
                className="flex w-full items-center justify-between rounded border-2 border-[#4e7d3a] bg-[#f3e8cf] p-2 text-left disabled:opacity-40"
              >
                <span className="text-sm text-[#3b2f23]">
                  Farm {f.owner?.displayName ?? f.ownerId.slice(0, 6)}
                </span>
                <span className="text-xs text-[#6b5b45]">raid {f.dailyRaidCount}/{effectiveRaidCap()}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
