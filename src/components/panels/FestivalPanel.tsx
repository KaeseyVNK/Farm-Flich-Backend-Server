"use client";

import { useEffect, useMemo, useState } from "react";
import { isFestivalDay, festivalTheme, type ActivityId } from "@/lib/game/festival/festival-schedule";
import { rewardsForSeason, rewardTierForScore, ACTIVITY_TROPHY } from "@/lib/game/festival/festival-catalog";
import { decorScore, derbyScore, puzzleScore, COOKOFF_MAX_DISHES } from "@/lib/game/festival/festival-scoring";
import { decorById } from "@/lib/game/decor/decor-catalog";
import { KITCHEN_RECIPES } from "@/lib/game/cooking/recipe-catalog";
import { getItem } from "@/lib/game/data";
import { ItemArt } from "@/components/game-ui/item-art";
import { useGameStore } from "@/store/gameStore";
import { useFarmStore } from "@/store/farmStore";
import { useInventoryStore } from "@/store/inventoryStore";
import { useQuestStore } from "@/store/questStore";
import { useFestivalStore } from "@/store/festivalStore";
import { useUiStore } from "@/store/uiStore";
import { gameActions } from "@/lib/game/actions";
import { FestivalPuzzleBooth } from "./festival-puzzle-booth";
import { festivalFriendContestAction } from "@/app/actions/festival";
import type { FestivalFriendRow } from "@/lib/game/festival/festival-friend-contest";
import { FestivalFriendBoard } from "./festival-friend-board";

/**
 * W8 — Bảng hoạt động festival (§14). Mở qua dialogue host NPC ngày lễ (13/24)
 * — panel "festival". 4 hoạt động chấm điểm real-time; claim thưởng 1 lần mỗi
 * hoạt động mỗi lễ (questStore key fest_{y}_{mùa}_{ngày}_{activity}).
 * Event decor + trophy (§17/§7) vào decorOwned — nhóm không-trộm.
 */

const ACTIVITY_LABEL: Record<ActivityId, string> = {
  contest: "🎨 Thi trang trí",
  derby: "🎣 Đua câu cá",
  cookoff: "🍳 Nấu ăn",
  puzzle: "🧩 Gian giải đố",
};

export function FestivalPanel() {
  const day = useGameStore((s) => s.day);
  const season = useGameStore((s) => s.season);
  const year = useGameStore((s) => s.year);
  const catchLog = useGameStore((s) => s.catchLog);
  const placedDecor = useFarmStore((s) => s.placedDecor);
  const decorOwned = useFarmStore((s) => s.decorOwned);
  const invSlots = useInventoryStore((s) => s.slots);
  const completed = useQuestStore((s) => s.completed);
  const cookoffDishes = useFestivalStore((s) => s.cookoffDishes);
  const cookoffTotal = useFestivalStore((s) => s.cookoffScore);
  const puzzleSolved = useFestivalStore((s) => s.puzzleSolved);
  const [msg, setMsg] = useState("");
  const [board, setBoard] = useState<FestivalFriendRow[] | null>(null);

  // Review W8 HIGH: session điểm sống trong store (đóng panel KHÔNG mất) —
  // đổi ngày tự reset về 0.
  const fest = useFestivalStore;
  useEffect(() => {
    useFestivalStore.getState().syncDay(year, season, day);
  }, [year, season, day]);

  const kind = isFestivalDay(season, day);
  const theme = festivalTheme(season);
  const open = kind ? (kind === "main" ? theme.mainActivities : theme.sideActivities) : [];
  const rewards = rewardsForSeason(season);
  const showContest = open.includes("contest");

  useEffect(() => {
    if (!showContest) {
      setBoard(null);
      return;
    }
    let cancelled = false;
    void festivalFriendContestAction().then((rows) => {
      if (!cancelled) setBoard(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [showContest, year, season, day]);

  const scores = useMemo(
    () => ({
      contest: decorScore(placedDecor.filter((d) => d.zone === "farm"), 0),
      derby: derbyScore(catchLog.map((fishId) => ({ fishId }))),
      cookoff: cookoffTotal,
      puzzle: puzzleScore(puzzleSolved),
    }),
    [placedDecor, catchLog, cookoffTotal, puzzleSolved],
  );

  // Món nấu trong túi (để nộp cook-off).
  const cookedDishes = invSlots
    .filter((s): s is { itemId: string; qty: number } => {
      if (!s) return false;
      return KITCHEN_RECIPES.some((r) => r.outputItemId === s.itemId);
    })
    .slice(0, 6);

  const claim = (act: ActivityId) => {
    const key = `fest_${year}_${season}_${day}_${act}`;
    if (completed[key]) return;
    const score = scores[act];
    const reward = rewards.find((r) => r.tier === rewardTierForScore(score)) ?? null;
    if (!reward) {
      setMsg("Chưa đủ điểm bronze (30) — cố lên!");
      return;
    }
    // Review W8 MEDIUM: chốt key TRƯỚC khi award — markCompleted atomic guard
    // chống double-gold khi 2 invoke cùng tick.
    if (!useQuestStore.getState().markCompleted(key)) return;
    const game = useGameStore.getState();
    const farm = useFarmStore.getState();
    game.addGold(reward.gold);
    if (reward.decorId && !decorOwned[reward.decorId]) farm.ownDecor(reward.decorId);
    if (reward.trophy) {
      const trophyId = ACTIVITY_TROPHY[act];
      if (trophyId && !decorOwned[trophyId]) farm.ownDecor(trophyId);
    }
    useUiStore.getState().notify(
      `🎉 ${ACTIVITY_LABEL[act]} đạt ${reward.tier.toUpperCase()} — +${reward.gold}g!`,
      "success",
    );
    setMsg(`Đã nhận thưởng ${reward.tier} (${reward.gold}g${reward.decorId ? " + đồ lễ" : ""})`);
  };

  return (
    <div className="space-y-4 text-[#3b2f23]">
      <div className="rounded border-2 border-[#4a3119] bg-[#4e7d3a] p-3 text-[#fbf7ec]">
        <p className="text-sm font-extrabold">
          🎉 {theme.name} {kind === "main" ? "(lễ chính)" : "(lễ phụ)"} — ngày {day}
        </p>
        <p className="mt-1 text-[11px] text-[#fbf7ec]/80">
          Hoạt động hôm nay: {open.map((a) => ACTIVITY_LABEL[a]).join(" · ")}
        </p>
        <p className="text-[11px] text-[#fbf7ec]/60">
          Chủ trì: {theme.hostNpc} · Ngưỡng: đồng 30 / bạc 100 / vàng 200
        </p>
      </div>

      {!kind && (
        <p className="rounded border-2 border-[#c0452f] bg-[#fbe4df] p-2 text-xs text-[#c0452f]">
          Hôm nay không phải ngày lễ — festival vào ngày 13 (chính) và 24 (phụ) mỗi mùa.
        </p>
      )}

      {open.map((act) => {
        const key = `fest_${year}_${season}_${day}_${act}`;
        const claimed = !!completed[key];
        const score = scores[act];
        const tier = rewardTierForScore(score);
        const reward = rewards.find((r) => r.tier === tier) ?? null;
        return (
          <div key={act} className="rounded border-2 border-[#c9b68c] bg-[#fff7e2] p-2" data-testid={`fest-${act}`}>
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{ACTIVITY_LABEL[act]}</p>
                <p className="text-[11px] text-[#6b5b45]">
                  Điểm: <span className="font-bold">{score}</span>
                  {reward ? ` — đạt ${reward.tier.toUpperCase()} (+${reward.gold}g${reward.decorId ? ` + ${decorById(reward.decorId)?.name ?? ""}` : ""})` : " — chưa đạt đồng (30)"}
                </p>
              </div>
              {claimed ? (
                <span className="ml-2 shrink-0 rounded bg-[#4e7d3a] px-2 py-1 text-[11px] font-bold text-[#fbf7ec]">Đã nhận</span>
              ) : (
                <button
                  onClick={() => claim(act)}
                  disabled={!kind}
                  className="ml-2 shrink-0 rounded border-2 border-[#4a3119] bg-[#e7b94e] px-2 py-1 text-xs font-bold text-[#3b2f23] hover:bg-[#f0c964] disabled:opacity-40"
                >
                  Nhận
                </button>
              )}
            </div>
            {act === "contest" && <FestivalFriendBoard board={board} />}
            {act === "cookoff" && (
              <div className="mt-2 border-t border-[#c9b68c] pt-2">
                <p className="mb-1 text-[11px] font-bold text-[#5a4a36]">
                  Nộp món ({cookoffDishes}/{COOKOFF_MAX_DISHES}):
                </p>
                {cookedDishes.length === 0 && (
                  <p className="text-[11px] text-[#6b5b45]">Không có món nấu trong túi — vào bếp nấu trước nhé!</p>
                )}
                <div className="flex flex-wrap gap-1">
                  {cookedDishes.map((d) => (
                    <button
                      key={d.itemId}
                      disabled={cookoffDishes >= COOKOFF_MAX_DISHES}
                      onClick={() => {
                        if (fest.getState().cookoffDishes >= COOKOFF_MAX_DISHES) {
                          setMsg("Đã nộp đủ 3 món hôm nay!");
                          return;
                        }
                        const s = gameActions.submitCookoffDishes([d.itemId]);
                        if (s != null) {
                          if (!fest.getState().submitCookoffDish(s)) {
                            useInventoryStore.getState().addItem(d.itemId, 1);
                            setMsg("Đã nộp đủ 3 món hôm nay!");
                            return;
                          }
                          setMsg(`Nộp ${getItem(d.itemId)?.name} — +${s} điểm cook-off`);
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded border border-[#4a3119] bg-[#f6ecd6] px-2 py-1 text-[11px] hover:bg-[#efe2c4] disabled:opacity-40"
                    >
                      <ItemArt itemId={d.itemId} size={16} />
                      {getItem(d.itemId)?.name ?? d.itemId} ×{d.qty}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {act === "puzzle" && (
              <div className="mt-2 border-t border-[#c9b68c] pt-2">
                <FestivalPuzzleBooth
                  solved={puzzleSolved}
                  onSolved={() => {
                    fest.getState().solvePuzzle();
                    setMsg("🧩 Giải đúng! +10 điểm");
                  }}
                />
              </div>
            )}
          </div>
        );
      })}

      {msg && <p className="text-center text-xs font-bold text-[#4e7d3a]">{msg}</p>}
    </div>
  );
}
