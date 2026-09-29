"use client";

import { useEffect, useState } from "react";
import { BLACK_MARKET_MASKS } from "@/lib/game/mask-catalog";
import { REPUTATION_EFFECTS } from "@/lib/raid/constants";
import { buyBlackMaskAction, loadMasksAction } from "@/app/actions/mask";
import { fetchGold } from "@/app/actions/wallet";
import { useGameStore } from "@/store/gameStore";
import { useInventoryStore } from "@/store/inventoryStore";
import { useReputationStore } from "@/store/reputationStore";
import { useUiStore } from "@/store/uiStore";
import { getItem } from "@/lib/game/data";
import { ItemArt } from "@/components/game-ui/item-art";

/**
 * W7d-P2 — Chợ đen Jack (§14). Mở qua dialogue Jack (beach wharf) — KHÔNG hotkey.
 * Gate: thief rep ≥ 50 (server-check mask, client-check tool hiển thị).
 * - Masks tier 2: server (buyBlackMaskAction → RPC craft_mask trừ gold cloud).
 * - Tools: local (spendGold + addItem — pattern buyMount; gold cloud sync sau).
 */

const TOOLS: { id: string; price: number }[] = [
  { id: "tool_lockpick", price: 150 },
  { id: "tool_smoke", price: 200 },
  { id: "tool_toy", price: 250 },
];

export function BlackMarketPanel() {
  const gold = useGameStore((s) => s.gold);
  const thiefRep = useReputationStore((s) => s.thief);
  const [owned, setOwned] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Owned masks từ server (mask là DB row — không phải local inventory).
    void loadMasksAction()
      .then((rows) => setOwned(rows.map((r) => r.maskId)))
      .catch(() => setOwned([]));
  }, []);

  const unlocked = thiefRep >= REPUTATION_EFFECTS.THIEF_MASK_TIER2_AT;

  const buyMask = async (maskId: string, price: number, label: string) => {
    if (busy) return;
    setBusy(true);
    try {
      // Review H4: check cloud gold trước sink — cloud là nguồn trừ cho mask.
      // -1 = offline/chưa auth → skip preview (RPC DB vẫn chặn thiếu vàng).
      const cloud = await fetchGold();
      if (cloud >= 0 && cloud < price) {
        setMsg(`Vàng cloud không đủ (${cloud}/${price}g)`);
        return;
      }
      const res = await buyBlackMaskAction(maskId);
      if (res.ok) {
        setOwned((o) => [...o, maskId]);
        // Sink thành công → trừ local để 2 balance hội tụ.
        useGameStore.getState().addGold(-price);
        setMsg(`Đã mua ${label} (${price}g) — vào trang Masks để đeo!`);
        useUiStore.getState().notify(`🏴‍☠️ Mua ${label} thành công`, "success");
      } else {
        setMsg(res.error ?? "Mua thất bại");
      }
    } finally {
      setBusy(false);
    }
  };

  const buyTool = (id: string, price: number) => {
    const game = useGameStore.getState();
    const inv = useInventoryStore.getState();
    if (!game.spendGold(price)) {
      setMsg("Không đủ vàng");
      return;
    }
    if (inv.addItem(id, 1) !== 0) {
      game.addGold(price); // túi đầy — hoàn vàng
      setMsg("Túi đồ đầy");
      return;
    }
    setMsg(`Đã mua ${getItem(id)?.name} (${price}g) — dùng trong raid!`);
  };

  return (
    <div className="space-y-4 text-[#3b2f23]">
      <div className="rounded border-2 border-[#4a3119] bg-[#2b2118] p-3 text-[#fbf7ec]">
        <p className="text-xs">
          🏴‍☠️ <span className="font-bold">Jack thì thầm:</span> "Hàng này không bán cho dân lành…"
        </p>
        <p className="mt-1 text-[11px] text-[#fbf7ec]/70">
          Danh tiếng Trộm: <span className={`font-bold ${unlocked ? "text-[#7fc46a]" : "text-[#e8a13c]"}`}>{thiefRep}/50</span>
          {unlocked ? " — cửa mở rồi, vào đi" : " — thoát raid thành công nhiều hơn để mở (exit +3/caught −2)"}
        </p>
        <p className="text-[11px] text-[#fbf7ec]/50">Vàng: {gold}g (mask trừ vàng cloud, tool trừ vàng túi)</p>
      </div>

      <section>
        <h3 className="mb-2 text-sm font-extrabold text-[#4e7d3a]">Mặt nạ tier 2 (hiệu ứng ×1.15, bền 20)</h3>
        <div className="space-y-2">
          {BLACK_MARKET_MASKS.map((m) => {
            const has = owned.includes(m.maskId);
            return (
              <div key={m.maskId} className="flex items-center justify-between rounded border-2 border-[#c9b68c] bg-[#fff7e2] p-2" data-testid={`black-mask-${m.maskId}`}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{m.label}</p>
                  <p className="text-[11px] text-[#6b5b45]">{m.desc}</p>
                </div>
                {has ? (
                  <span className="ml-2 shrink-0 rounded bg-[#4e7d3a] px-2 py-1 text-[11px] font-bold text-[#fbf7ec]">Đã có</span>
                ) : (
                  <button
                    onClick={() => buyMask(m.maskId, m.goldCost, m.label)}
                    disabled={!unlocked || busy}
                    className="ml-2 shrink-0 rounded border-2 border-[#4a3119] bg-[#e7b94e] px-2 py-1 text-xs font-bold text-[#3b2f23] hover:bg-[#f0c964] disabled:opacity-40"
                  >
                    {m.goldCost}g
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-extrabold text-[#4e7d3a]">Dụng cụ trộm (1 lần dùng mỗi raid)</h3>
        <div className="space-y-2">
          {TOOLS.map((t) => {
            const def = getItem(t.id);
            return (
              <div key={t.id} className="flex items-center justify-between rounded border-2 border-[#c9b68c] bg-[#fff7e2] p-2" data-testid={`black-tool-${t.id}`}>
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  {def ? <ItemArt def={def} size={22} /> : null}
                  <div className="min-w-0">
                    <p className="text-sm font-bold">{def?.name}</p>
                    <p className="text-[11px] text-[#6b5b45]">{def?.description}</p>
                  </div>
                </div>
                <button
                  onClick={() => buyTool(t.id, t.price)}
                  disabled={!unlocked}
                  className="ml-2 shrink-0 rounded border-2 border-[#4a3119] bg-[#e7b94e] px-2 py-1 text-xs font-bold text-[#3b2f23] hover:bg-[#f0c964] disabled:opacity-40"
                >
                  {t.price}g
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {msg && <p className="text-center text-xs font-bold text-[#4e7d3a]">{msg}</p>}
    </div>
  );
}
