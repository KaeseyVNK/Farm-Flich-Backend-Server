"use client";

import { useUiStore } from "@/store/uiStore";
import { useInventoryStore } from "@/store/inventoryStore";
import { NPCS, getItem } from "@/lib/game/data";
import { gameActions } from "@/lib/game/actions";
import { Gift, X, Star } from "lucide-react";
import { ItemArt } from "@/components/game-ui/item-art";
import { useRef } from "react";
import { useFocusTrap } from "@/hooks/use-focus-trap";

export function GiftPickerModal() {
  const target = useUiStore((s) => s.giftTarget);
  const close = useUiStore((s) => s.closeGiftPicker);
  const slots = useInventoryStore((s) => s.slots);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(!!target, dialogRef);

  if (!target) return null;
  const npc = NPCS[target];
  if (!npc) return null;

  const giftables = slots
    .filter((s): s is { itemId: string; qty: number } => !!s)
    .filter((s) => {
      const def = getItem(s.itemId);
      return def && def.type !== "tool";
    });

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Chọn một món quà" className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="animate-pop-in w-full max-w-md overflow-hidden rounded-2xl border-2 border-[#4a3119] bg-[#fffaf0] shadow-2xl">
        <div
          className="wood-panel-flat flex items-center gap-3 px-4 py-3"
          style={{ background: `linear-gradient(90deg, ${npc.color}cc, var(--wood-frame))` }}
        >
          <span className="text-3xl">{npc.emoji}</span>
          <div className="flex-1">
            <h3 className="text-base font-extrabold text-[#fbf7ec] drop-shadow hud-text">
              Gift for {npc.name}
            </h3>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#fbf7ec]/80">
              Chọn một món quà để tặng
            </p>
          </div>
          <button
            onClick={close}
            className="flex h-8 w-8 items-center justify-center rounded-lg border-2 border-[#4a3119] bg-[#efe2c4] text-[#5a4a36] hover:bg-[#fff7e2]"
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4">
          {giftables.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-[#d2bf96] bg-[#f3e8cf]/60 p-6 text-center">
              <Gift className="mx-auto mb-2 h-8 w-8 text-[#6b5b45]" />
              <p className="text-sm font-medium text-[#5a4a36]">
                Bạn không có gì để tặng. Hãy thu hoạch hoặc nhặt lượm gì đó trước!
              </p>
            </div>
          ) : (
            <>
              <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg bg-[#fff7e2] p-2 text-[11px] text-[#5a4a36]">
                <span className="font-bold">Thích:</span>
                <span className="flex items-center gap-1">
                  <Star className="h-3 w-3 fill-[#e7b94e] text-[#e7b94e]" />
                  {npc.loves.map((id) => (
                    <span key={id} title={getItem(id)?.name} className="inline-flex">
                      <ItemArt itemId={id} size={16} />
                    </span>
                  ))}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
                {giftables.map((s) => {
                  const def = getItem(s.itemId)!;
                  const loved = npc.loves.includes(s.itemId);
                  const liked = npc.likes.includes(s.itemId);
                  return (
                    <button
                      key={s.itemId}
                      onClick={() => {
                        gameActions.giveGift(npc.id, s.itemId);
                        close();
                      }}
                      className="slot relative flex aspect-square items-center justify-center rounded-lg transition hover:scale-105"
                      title={`${def.name}${loved ? " (loved!)" : liked ? " (liked)" : ""}`}
                      aria-label={`${def.name}${loved ? " (loved!)" : liked ? " (liked)" : ""}`}
                    >
                      <ItemArt def={def} size={28} />
                      <span className="absolute bottom-0.5 right-1 text-[10px] font-bold text-[#3b2f23] hud-text">
                        {s.qty}
                      </span>
                      {loved && (
                        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-[#4a3119] bg-[#e7b94e]">
                          <Star className="h-2.5 w-2.5 fill-[#3b2f23] text-[#3b2f23]" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
