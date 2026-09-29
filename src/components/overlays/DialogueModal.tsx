"use client";

import { useUiStore } from "@/store/uiStore";
import { useNpcStore, HEARTS_MAX } from "@/store/npcStore";
import { NPCS, getItem } from "@/lib/game/data";
import { dialogueLineIndex } from "@/lib/game/week-quest";
import { useInventoryStore } from "@/store/inventoryStore";
import { useQuestStore } from "@/store/questStore";
import { useTutorialStore } from "@/store/tutorialStore";
import { getTutorialStep, TUTORIAL_ORDER } from "@/lib/game/tutorial/tutorial-catalog";
import { useWorldStore } from "@/store/worldStore";
import { useGameStore } from "@/store/gameStore";
import { useGameStore as useGameStoreRef } from "@/store/gameStore";
import { isFestivalDay, festivalTheme, type Season } from "@/lib/game/festival/festival-schedule";
import { useRef, useState } from "react";
import { MessageCircle, Gift, X, Heart, Star, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ItemArt } from "@/components/game-ui/item-art";
import { useFocusTrap } from "@/hooks/use-focus-trap";

export function DialogueModal() {
  const npcId = useUiStore((s) => s.dialogueNpc);
  const closeDialogue = useUiStore((s) => s.closeDialogue);
  const openGiftPicker = useUiStore((s) => s.openGiftPicker);
  const talk = useNpcStore((s) => s.talk);
  const talkedToday = useNpcStore((s) => s.talkedToday);
  const hearts = useNpcStore((s) => s.hearts);
  const [justTalked, setJustTalked] = useState(false);
  // Phase 7 story wire: choiceMade = lựa chọn vừa chọn (show feedback 1 lần).
  const [choiceMade, setChoiceMade] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(!!npcId, dialogRef);
  const completed = useQuestStore((s) => s.completed);
  const wellRepaired = useWorldStore((s) => s.wellRepaired);
  const day = useGameStore((s) => s.day);
  const season = useGameStoreRef((s) => s.season);
  const invSlots = useInventoryStore((s) => s.slots);
  void completed;
  void wellRepaired;
  void day;
  void invSlots;

  // State reset khi đổi NPC được xử lý bằng key={dialogueNpc} ở mount site
  // (GameLayout remount) — không cần effect setState ở đây.

  if (!npcId) return null;
  const npc = NPCS[npcId];
  if (!npc) return null;

  const talked = talkedToday[npcId];
  const h = hearts(npcId);

    const handleTalk = () => {
    const first = talk(npcId);
    setJustTalked(first);
    setChoiceMade(null);
    import("@/lib/game/npc-quests").then(({ resolveNpcQuests }) => resolveNpcQuests(npcId));
  };

  // Phase 7 story wire — RETIRED (W9P3): story 5-chapter thay bằng tutorial.
  // Choice vẫn render (dialogueChoices cũ) nhưng flag accumulation là no-op —
  // không còn branch/ending. Giữ UI nhất quán cho NPC cũ.
  const handleChoice = (flag: string) => {
    setChoiceMade(flag);
    useUiStore.getState().notify("Quyết định của bạn đã được ghi nhận…", "info");
  };

  const lineIdx = dialogueLineIndex(npcId);
  const line = npc.dialogue[lineIdx] ?? npc.dialogue[0];
  // W9: NPC đang dạy tutorial step (hiện tại) → ưu tiên line hướng dẫn thay vì
  // dialogue cũ. Game single-locale VN: hint từ catalog (không i18n — đồng bộ
  // với HUD pin). Step đã claim → fallback dialogue thường.
  const tutorialActiveId = useQuestStore.getState().tutorialActive();
  const tutorialStepDef =
    tutorialActiveId && getTutorialStep(tutorialActiveId)?.npc === npcId
      ? getTutorialStep(tutorialActiveId)
      : null;
  const tutorialClaimed = useQuestStore.getState().tutorialClaimed;
  const tutorialLine =
    tutorialStepDef && !tutorialClaimed.includes(tutorialStepDef.id)
      ? `${tutorialStepDef.title} — ${tutorialStepDef.hint}`
      : null;
  const hasChoices = npc.dialogueChoices && npc.dialogueChoices.length > 0 && !choiceMade;
  // W8: NPC là chủ trì lễ HÔM NAY (13/24) → nút mở bảng hoạt động festival.
  const festivalKind = isFestivalDay(day >= 1 && day <= 28 ? (season as Season) : "Spring", day);
  const isHostToday = festivalKind !== null && festivalTheme(season as Season).hostNpc === npcId;

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Hội thoại" className="pointer-events-auto absolute inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="animate-slide-in-up w-full max-w-2xl overflow-hidden rounded-2xl border-2 border-[#4a3119] bg-[#fffaf0] shadow-2xl">
        {/* Header */}
        <div
          className="wood-panel-flat flex items-center gap-3 px-4 py-3"
          style={{ background: `linear-gradient(90deg, ${npc.color}cc, var(--wood-frame))` }}
        >
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-[#fbf7ec] text-3xl shadow-inner"
            style={{ background: npc.color }}
          >
            {npc.emoji}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-extrabold text-[#fbf7ec] drop-shadow hud-text">{npc.name}</h3>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#fbf7ec]/80">
              {npc.role}
            </p>
            <div className="mt-0.5 flex items-center gap-0.5">
              {Array.from({ length: HEARTS_MAX }).map((_, i) => (
                <Heart
                  key={i}
                  className={`h-3.5 w-3.5 ${
                    i < h ? "fill-[#e0473a] text-[#e0473a]" : "fill-[#fbf7ec]/30 text-[#fbf7ec]/30"
                  }`}
                />
              ))}
            </div>
          </div>
          <button
            onClick={closeDialogue}
            className="flex h-8 w-8 items-center justify-center rounded-lg border-2 border-[#4a3119] bg-[#efe2c4] text-[#5a4a36] hover:bg-[#fff7e2]"
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Dialogue body */}
        <div className="p-4">
          <div className="rounded-xl border-2 border-[#d2bf96] bg-[#efe6d2] p-4">
            <p className="font-serif text-base italic leading-relaxed text-[#3b2f23]">
              &ldquo;{tutorialLine ?? line}&rdquo;
            </p>
          </div>

          {justTalked && (
            <p className="mt-2 text-center text-xs font-bold text-[#4e7d3a] animate-pop-in">
              +20 thân thiết với {npc.name}!
            </p>
          )}

          {/* Phase 7 story choices — NPC có dialogueChoices → render branch options.
              Chọn set flag nhánh (mercy/corruption/selfless) → ending resolve khi ch5. */}
          {hasChoices && (
            <div className="mt-3">
              <p className="mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-[#5a4a36]">
                <Scale className="h-3.5 w-3.5" /> Quyết định của bạn:
              </p>
              <div className="grid grid-cols-1 gap-1.5">
                {npc.dialogueChoices!.map((c) => (
                  <button
                    key={c.setFlag}
                    onClick={() => handleChoice(c.setFlag)}
                    className="rounded-lg border-2 border-[#4a3119] bg-[#fff7e2] px-3 py-2 text-left text-sm font-semibold text-[#3b2f23] transition hover:bg-[#e7b94e]/30"
                  >
                    {c.text}
                  </button>
                ))}
              </div>
            </div>
          )}
          {choiceMade && (
            <p className="mt-2 text-center text-xs font-bold text-[#4e7d3a] animate-pop-in">
              Quyết định ghi nhận.
            </p>
          )}

          {/* Actions */}
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Button
              onClick={handleTalk}
              className="btn-shine h-10 gap-1.5 border-2 border-[#4a3119] bg-[#4e7d3a] text-[#fbf7ec] hover:bg-[#5a8e44]"
            >
              <MessageCircle className="h-4 w-4" />
              {talked ? "Trò chuyện lại" : "Nói chuyện"}
            </Button>
            <Button
              onClick={() => {
                closeDialogue();
                openGiftPicker(npcId);
              }}
              className="btn-shine h-10 gap-1.5 border-2 border-[#4a3119] bg-[#e7b94e] text-[#3b2f23] hover:bg-[#f0c964]"
            >
              <Gift className="h-4 w-4" />
              Tặng quà
            </Button>
            {isHostToday && (
              <Button
                onClick={() => {
                  closeDialogue();
                  useUiStore.getState().openPanel("festival");
                }}
                className="btn-shine h-10 gap-1.5 border-2 border-[#4a3119] bg-[#4e7d3a] text-[#fbf7ec] hover:bg-[#5a8e44]"
              >
                🎉 Lễ hội hôm nay
              </Button>
            )}
            {npcId === "jack" && (
              <Button
                onClick={() => {
                  closeDialogue();
                  useUiStore.getState().openPanel("blackmarket");
                }}
                className="btn-shine h-10 gap-1.5 border-2 border-[#4a3119] bg-[#8b3a2e] text-[#fbf7ec] hover:bg-[#a34a3c]"
              >
                🏴‍☠️ Chợ đen
              </Button>
            )}
            <Button
              onClick={closeDialogue}
              className="h-10 gap-1.5 border-2 border-[#4a3119] bg-[#efe2c4] text-[#3b2f23] hover:bg-[#fff7e2]"
            >
              <X className="h-4 w-4" />
              Rời đi
            </Button>
          </div>

          {/* Loved gifts hint */}
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-[#fff7e2] p-2 text-[11px] text-[#5a4a36]">
            <span className="font-bold">Thích:</span>
            <span className="flex items-center gap-1">
              <Star className="h-3 w-3 fill-[#e7b94e] text-[#e7b94e]" />
              {npc.loves.map((id) => (
                <span key={id} title={getItem(id)?.name} className="inline-flex">
                  <ItemArt itemId={id} size={16} />
                </span>
              ))}
            </span>
            <span className="font-bold">· Hợp:</span>
            <span>
              {npc.likes.map((id) => (
                <span key={id} title={getItem(id)?.name} className="inline-flex">
                  <ItemArt itemId={id} size={16} />
                </span>
              ))}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
