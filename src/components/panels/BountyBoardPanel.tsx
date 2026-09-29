"use client";

import { useEffect, useState } from "react";
import {
  topThievesAction,
  loadBountiesAction,
  placeBountyAction,
  cancelBountyAction,
  revengeTargetsAction,
  type TopThief,
  type BountyRow,
  type RevengeTarget,
} from "@/app/actions/bounty";
import { fetchGold } from "@/app/actions/wallet";
import { useGameStore } from "@/store/gameStore";

/**
 * W7d-P3 — Bảng truy nã (§14). Công khai: top thief thoát thành công 7 ngày +
 * bounty đang treo. Chủ farm đặt thưởng (gold cloud, trừ ngay — RPC atomic),
 * hủy hoàn đủ. Quest trả đũa display-only (raid ngược OUT theo plan).
 */

const FMT = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
};

export function BountyBoardPanel() {
  const [top, setTop] = useState<TopThief[]>([]);
  const [bounties, setBounties] = useState<BountyRow[]>([]);
  const [revenge, setRevenge] = useState<RevengeTarget[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [amount, setAmount] = useState<Record<string, number>>({});
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = async (uid: string | null) => {
    const [t, b, r] = await Promise.all([topThievesAction(), loadBountiesAction(), revengeTargetsAction().catch(() => [])]);
    setTop(t);
    setBounties(b);
    setRevenge(r);
    if (uid) setMyId(uid);
    setLoading(false);
  };

  useEffect(() => {
    // myId từ supabase client session (chỉ để tag bounty của mình).
    void import("@/lib/supabase/client").then(async ({ createClient }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      await refresh(user?.id ?? null);
    });
  }, []);

  const place = async (thiefId: string) => {
    const gold = amount[thiefId] ?? 100;
    // Review H4: bounty trừ cloud gold — check trước + deduct local khi OK.
    const cloud = await fetchGold();
    if (cloud >= 0 && cloud < gold) {
      setMsg(`Vàng cloud không đủ (${cloud}/${gold}g)`);
      return;
    }
    const res = await placeBountyAction(thiefId, gold);
    setMsg(res.ok ? `Đã treo ${gold}g lên đầu trộm này!` : res.error ?? "Thất bại");
    if (res.ok) {
      useGameStore.getState().addGold(-gold);
      await refresh(myId);
    }
  };

  const cancel = async (bountyId: string, refundGold: number) => {
    const res = await cancelBountyAction(bountyId);
    setMsg(res.ok ? "Đã hủy — hoàn đủ vàng" : res.error ?? "Thất bại");
    if (res.ok) {
      // Refund cloud → cộng lại local (hội tụ 2 balance).
      useGameStore.getState().addGold(refundGold);
      await refresh(myId);
    }
  };

  if (loading) return <p className="text-xs text-[#6b5b45]">Đang tải bảng truy nã…</p>;

  return (
    <div className="space-y-4 text-[#3b2f23]">
      <p className="rounded border-2 border-[#c9b68c] bg-[#fff7e2] p-2 text-[11px] text-[#5a4a36]">
        🪧 Trộm thoát thành công 7 ngày qua. Treo thưởng trừ vàng cloud NGAY, hủy hoàn đủ —
        chưa có &quot;đi bắt&quot; (MVP §14).
      </p>

      {revenge.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-extrabold text-[#c0452f]">Nhiệm vụ trả đũa (sắp có)</h3>
          {revenge.map((r) => (
            <div key={r.thiefId} className="mb-1 rounded border-2 border-[#c0452f]/40 bg-[#fbe4df] p-2 text-xs" data-testid="revenge-quest">
              🔪 Truy lại <span className="font-bold">Trộm {r.thiefId.slice(0, 8)}</span> — đã lấy đồ của bạn{" "}
              {r.times} lần (gần nhất {FMT(r.lastAt)}). Raid farm họ thành công để trả đũa!
              <span className="ml-1 opacity-60">(chỉ hiển thị — thưởng xử lý sau)</span>
            </div>
          ))}
        </section>
      )}

      <section>
        <h3 className="mb-2 text-sm font-extrabold text-[#4e7d3a]">Top trộm tuần này</h3>
        {top.length === 0 && <p className="text-xs text-[#6b5b45]">Chưa ai thoát thành công tuần này — bình yên quá!</p>}
        <div className="space-y-2">
          {top.map((t) => {
            const existing = bounties.find((b) => b.thiefId === t.thiefId && b.ownerId === myId);
            return (
              <div key={t.thiefId} className="rounded border-2 border-[#c9b68c] bg-[#fff7e2] p-2" data-testid="bounty-thief">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold">
                      🥷 {t.name} {t.bountyGold > 0 && <span className="text-[#c0452f]">💰 {t.bountyGold}g</span>}
                    </p>
                    <p className="text-[11px] text-[#6b5b45]">Thoát thành công {t.escapes} lần</p>
                  </div>
                  {existing ? (
                    <button
                      onClick={() => cancel(existing.id, existing.gold)}
                      className="rounded border-2 border-[#c0452f] px-2 py-1 text-xs font-bold text-[#c0452f] hover:bg-[#fbe4df]"
                    >
                      Hủy ({existing.gold}g)
                    </button>
                  ) : (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={50}
                        max={5000}
                        step={50}
                        value={amount[t.thiefId] ?? 100}
                        onChange={(e) => setAmount((a) => ({ ...a, [t.thiefId]: Number(e.target.value) || 100 }))}
                        className="w-16 rounded border-2 border-[#4a3119] bg-[#fbf7ec] px-1 py-1 text-xs"
                        aria-label={`Số vàng treo thưởng ${t.name}`}
                      />
                      <button
                        onClick={() => place(t.thiefId)}
                        className="rounded border-2 border-[#4a3119] bg-[#e7b94e] px-2 py-1 text-xs font-bold hover:bg-[#f0c964]"
                      >
                        Treo
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-extrabold text-[#4e7d3a]">Thưởng đang treo ({bounties.length})</h3>
        {bounties.map((b) => (
          <div key={b.id} className="mb-1 flex items-center justify-between rounded border border-[#c9b68c] bg-[#f6ecd6] px-2 py-1 text-xs">
            <span>
              💰 {b.gold}g — Trộm {b.thiefId.slice(0, 8)} (bởi {b.ownerId === myId ? "bạn" : b.ownerId.slice(0, 8)})
            </span>
            {b.ownerId === myId && (
              <button onClick={() => cancel(b.id, b.gold)} className="font-bold text-[#c0452f]">
                Hủy
              </button>
            )}
          </div>
        ))}
      </section>

      {msg && <p className="text-center text-xs font-bold text-[#4e7d3a]">{msg}</p>}
    </div>
  );
}
