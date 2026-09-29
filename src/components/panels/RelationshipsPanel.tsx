"use client";

import { useState } from "react";
import { useNpcStore, HEARTS_MAX, POINTS_PER_HEART, FRIENDSHIP_MAX } from "@/store/npcStore";
import { useUiStore } from "@/store/uiStore";
import { useInventoryStore } from "@/store/inventoryStore";
import { NPCS, getItem } from "@/lib/game/data";
import { gameActions } from "@/lib/game/actions";
import { Heart, MessageCircle, Gift, X, Star } from "lucide-react";
import { ItemArt } from "@/components/game-ui/item-art";
import { Button } from "@/components/ui/button";

export function RelationshipsPanel() {
  const friendship = useNpcStore((s) => s.friendship);
  const talkedToday = useNpcStore((s) => s.talkedToday);
  const giftedToday = useNpcStore((s) => s.giftedToday);
  const openDialogue = useUiStore((s) => s.openDialogue);
  const openGiftPicker = useUiStore((s) => s.openGiftPicker);
  const [giftFor, setGiftFor] = useState<string | null>(null);

  // Subscribe slots (KHÔNG getState snapshot) — giftables list phải update khi
  // inventory đổi (tặng/dùng/nhận item). Trước đây stale snapshot từ first render.
  const slots = useInventoryStore((s) => s.slots);
  const giftables = slots
    .filter((s): s is { itemId: string; qty: number } => !!s)
    .filter((s) => {
      const def = getItem(s.itemId);
      return def && def.type !== "tool";
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border-2 border-[#d2bf96] bg-[#fffaf0] p-3">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-[#8a6238]">
          <Heart className="h-4 w-4" /> Townsfolk
        </h3>
        <p className="text-xs font-medium text-[#5a4a36]">
          Kết thân với người dân bằng cách nói chuyện hằng ngày và tặng quà họ yêu thích. Mỗi trái tim
          = 250 điểm (tối đa {HEARTS_MAX} trái tim).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {Object.values(NPCS).map((npc) => {
          const pts = friendship[npc.id] ?? 0;
          const hearts = Math.min(HEARTS_MAX, Math.floor(pts / POINTS_PER_HEART));
          const talked = talkedToday[npc.id];
          const gifted = giftedToday[npc.id];
          return (
            <div
              key={npc.id}
              className="overflow-hidden rounded-xl border-2 border-[#d2bf96] bg-[#fffaf0]"
            >
              <div
                className="flex items-center gap-3 p-3"
                style={{ background: `linear-gradient(135deg, ${npc.color}33, #fffaf0)` }}
              >
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-[#4a3119] text-3xl shadow-inner"
                  style={{ background: npc.color }}
                >
                  {npc.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-base font-extrabold text-[#3b2f23]">{npc.name}</h4>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8a6238]">
                    {npc.role}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {Array.from({ length: HEARTS_MAX }).map((_, i) => (
                      <Heart
                        key={i}
                        className={`h-3.5 w-3.5 ${
                          i < hearts ? "fill-[#d9694e] text-[#d9694e]" : "fill-[#d8c69e] text-[#d8c69e]"
                        }`}
                      />
                    ))}
                    <span className="ml-1 text-[10px] font-bold text-[#6b5b45]">
                      {pts}/{FRIENDSHIP_MAX}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 p-3">
                <p className="rounded-lg bg-[#efe6d2] p-2 text-[11px] italic text-[#5a4a36]">
                  &ldquo;{npc.schedule}&rdquo;
                </p>
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-[#5a4a36]">
                  <span>Thích:</span>
                  {npc.loves.map((id) => (
                    <span key={id} className="inline-flex items-center gap-0.5 text-[#3b2f23]">
                      <ItemArt itemId={id} size={14} />
                      {getItem(id)?.name}
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => openDialogue(npc.id)}
                    className="btn-shine h-8 flex-1 gap-1.5 border-2 border-[#4a3119] bg-[#4e7d3a] text-[#fbf7ec] hover:bg-[#5a8e44]"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    {talked ? "Trò chuyện lại" : "Nói chuyện"}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setGiftFor(giftFor === npc.id ? null : npc.id)}
                    className="btn-shine h-8 flex-1 gap-1.5 border-2 border-[#4a3119] bg-[#e7b94e] text-[#3b2f23] hover:bg-[#f0c964]"
                  >
                    <Gift className="h-3.5 w-3.5" />
                    {gifted ? "Đã tặng" : "Tặng quà"}
                  </Button>
                </div>

                {/* Inline gift picker */}
                {giftFor === npc.id && (
                  <div className="animate-pop-in rounded-lg border-2 border-[#d2bf96] bg-[#fffaf0] p-2">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-[#8a6238]">
                        Chọn quà
                      </span>
                      <button
                        onClick={() => setGiftFor(null)}
                        className="text-[#6b5b45] hover:text-[#3b2f23]"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {giftables.length === 0 ? (
                      <p className="text-[11px] text-[#6b5b45]">
                        Không có món quà nào. Hãy thu hoạch hoặc nhặt lượm gì đó trước!
                      </p>
                    ) : (
                      <div className="grid grid-cols-5 gap-1.5">
                        {giftables.map((s) => {
                          const def = getItem(s.itemId)!;
                          const loved = npc.loves.includes(s.itemId);
                          const liked = npc.likes.includes(s.itemId);
                          return (
                            <button
                              key={s.itemId}
                              onClick={() => {
                                gameActions.giveGift(npc.id, s.itemId);
                                setGiftFor(null);
                              }}
                              className="slot relative flex aspect-square items-center justify-center rounded-md hover:scale-105"
                              title={`${def.name}${loved ? " (loved!)" : liked ? " (liked)" : ""}`}
                            >
                              <ItemArt def={def} size={20} />
                              {loved && (
                                <Star className="absolute -right-1 -top-1 h-3 w-3 fill-[#e7b94e] text-[#e7b94e]" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
