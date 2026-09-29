"use client";

import { useEffect, useState } from "react";
import { VenetianMask } from "lucide-react";
import { MASK_CATALOG } from "@/lib/game/mask-catalog";
import { craftMaskAction, equipMaskAction, loadMasksAction } from "@/app/actions/mask";
import { fetchGold } from "@/app/actions/wallet";
import { useGameStore } from "@/store/gameStore";

interface OwnedMask {
  maskId: string;
  durability: number;
  equipped: boolean;
}

const label = (maskId: string) => MASK_CATALOG.find((m) => m.maskId === maskId)?.label ?? maskId;

/** Notice phân biệt ok/error — success không hiện màu alarm (IA phase 5). */
interface Notice {
  ok: boolean;
  text: string;
}
const FAIL = (err?: string) => ({ ok: false, text: err ?? "Không thực hiện được — thử lại." });

export default function MasksPage() {
  const [owned, setOwned] = useState<OwnedMask[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);
  // busy: chặn duplicate submit khi server action đang pending (phase 5 plan §9).
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = () => loadMasksAction().then(setOwned);
  useEffect(() => {
    refresh();
  }, []);

  const onCraft = async (maskId: string, goldCost: number) => {
    if (busy) return;
    setBusy(maskId);
    // Review H4: craft trừ cloud gold — check trước + deduct local khi OK.
    const cloud = await fetchGold();
    if (cloud >= 0 && cloud < goldCost) {
      setBusy(null);
      setNotice(FAIL(`Vàng cloud không đủ (${cloud}/${goldCost}g)`));
      return;
    }
    const res = await craftMaskAction(maskId);
    setBusy(null);
    setNotice(res.ok ? { ok: true, text: `Đã chế tạo ${label(maskId)}` } : FAIL(res.error));
    if (res.ok) {
      useGameStore.getState().addGold(-goldCost);
      refresh();
    }
  };
  const onEquip = async (maskId: string) => {
    if (busy) return;
    setBusy(maskId);
    const res = await equipMaskAction(maskId);
    setBusy(null);
    setNotice(res.ok ? { ok: true, text: `Đang dùng ${label(maskId)}` } : FAIL(res.error));
    if (res.ok) refresh();
  };

  return (
    <main className="f-body min-h-screen bg-[#fffaf0] p-6 text-[#3b2f23]">
      <h1 className="f-display mb-4 flex items-center gap-2 text-3xl text-[var(--mystic)]">
        <VenetianMask aria-hidden className="h-7 w-7" /> Mặt nạ
      </h1>
      {notice && (
        <p className={`mb-3 text-sm ${notice.ok ? "text-[#4e7d3a]" : "text-[var(--alarm)]"}`}>{notice.text}</p>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {MASK_CATALOG.map((m) => {
          const own = owned.find((o) => o.maskId === m.maskId);
          return (
            <div
              key={m.maskId}
              className="rounded-xl border-2 border-[#4a3119] bg-[#efe2c4] p-4"
            >
              <h2 className="f-display text-lg text-[#4e7d3a]">{m.label}</h2>
              <p className="mb-2 text-xs opacity-70">{m.desc}</p>
              <p className="mb-1 text-xs">
                Cost: {m.goldCost}g + {Object.entries(m.ingredients).map(([k, v]) => `${v} ${k}`).join(", ")}
              </p>
              {own ? (
                <div className="space-y-1">
                  <p className="text-xs font-bold">
                    Đã sở hữu · durability {own.durability} {own.equipped && "· Đang dùng"}
                  </p>
                  {!own.equipped && (
                    <button
                      onClick={() => onEquip(m.maskId)}
                      disabled={busy !== null}
                      className="w-full rounded border-2 border-[#4a3119] bg-[#4e7d3a] py-1 text-xs font-bold text-[#fbf7ec] disabled:opacity-50"
                    >
                      Dùng
                    </button>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => onCraft(m.maskId, m.goldCost)}
                  disabled={busy !== null}
                  className="w-full rounded border-2 border-[#4a3119] bg-[var(--mystic)] py-1 text-xs font-bold text-white disabled:opacity-50"
                >
                  Craft
                </button>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
