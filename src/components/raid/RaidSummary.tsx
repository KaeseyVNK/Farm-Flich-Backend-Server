"use client";

import type { RaidEndState } from "@/store/raidStore";
import { ItemArt } from "@/components/game-ui/item-art";
import { getItem } from "@/lib/game/data";

/** Raid-end summary (audit H4 — loot temp hiển thị; inventory áp phase 6 finalize). */
export function RaidSummary(props: { end: RaidEndState; onDone: () => void }) {
  const { end } = props;
  const title =
    end.reason === "exit" ? "Thoát thành công" : end.reason === "caught" ? "Bị bắt!" : "Hết giờ";
  return (
    <div className="absolute inset-0 z-[8] flex items-center justify-center bg-black/70">
      <div className="w-80 rounded border-2 border-[#4a3119] bg-[#fffaf0] p-5 text-center">
        <h3 className="f-display mb-2 text-base text-[#4e7d3a]">{title}</h3>
        <p className="mb-2 text-sm text-[#3b2f23]">
          Loot giữ được: <b className="f-num text-[#d99a2a]">{end.keptLoot.reduce((s, l) => s + l.qty, 0)}</b>
        </p>
        {end.keptLoot.length > 0 && (
          <div className="mb-3 flex flex-wrap justify-center gap-2">
            {end.keptLoot.map((l) => (
              <span key={l.itemId} className="inline-flex items-center gap-1 text-xs text-[#3b2f23]">
                <ItemArt itemId={l.itemId} size={18} />
                {getItem(l.itemId)?.name ?? l.itemId} ×{l.qty}
              </span>
            ))}
          </div>
        )}
        <p className="mb-4 text-xs text-[#6b5b45]">Mặt nạ -{end.maskDurabilityLoss} độ bền</p>
        <button
          onClick={props.onDone}
          className="rounded border-2 border-[#4a3119] bg-[#e7b94e] px-4 py-2 text-sm font-bold text-[#4a3318]"
        >
          Về farm
        </button>
      </div>
    </div>
  );
}
