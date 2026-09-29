"use client";

import { useGameStore } from "@/store/gameStore";
import { useQuestStore, QUESTS } from "@/store/questStore";
import { useInventoryStore } from "@/store/inventoryStore";
import { useNpcStore } from "@/store/npcStore";
import {
  SEASONS,
  DAYS_PER_SEASON,
  SEASON_THEME,
} from "@/lib/game/constants";
import { activeWeekQuest } from "@/lib/game/week-quest";
import { CalendarDays, Target, Trophy, CheckCircle2, Circle, Coins, Package } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CalendarPanel() {
  const day = useGameStore((s) => s.day);
  const season = useGameStore((s) => s.season);
  const seasonIndex = useGameStore((s) => s.seasonIndex);
  const year = useGameStore((s) => s.year);
  const toolsUsed = useGameStore((s) => s.toolsUsed);
  const totalEarned = useGameStore((s) => s.totalEarned);

  const completed = useQuestStore((s) => s.completed);
  const claim = useQuestStore((s) => s.claim);
  const daysPlayed = useQuestStore((s) => s.daysPlayed);
  const shippedGold = useQuestStore((s) => s.shippedGold);
  // Subscribe backing stores cho quest progress — trước đây chỉ sub completed/
  // shippedGold/toolsUsed. q_lumberjack (wood), q_craftsman (sprinkler),
  // q_meet_townsfolk (metNpcs) progress bar stale khi panel mở (data đúng, hiển
  // thị cũ). void = trigger re-render, không render trực tiếp giá trị.
  const invSlots = useInventoryStore((s) => s.slots);
  const metNpcs = useNpcStore((s) => s.metNpcs);
  void invSlots;
  void metNpcs;
  const activeId = activeWeekQuest(completed)?.id;

  const theme = SEASON_THEME[season];

  return (
    <div className="flex flex-col gap-4">
      {/* Stats summary */}
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Số ngày chơi" value={String(daysPlayed)} />
        <Stat label="Lần dùng công cụ" value={String(toolsUsed)} />
        <Stat label="Vàng kiếm được" value={`${totalEarned}g`} />
      </div>

      {/* Calendar */}
      <div className="rounded-xl border-2 border-[#4a3119] bg-[#fffaf0] p-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-[#8a6238]">
            <CalendarDays className="h-4 w-4" /> {theme.label} Calendar
          </h3>
          <span className="text-xs font-bold text-[#5a4a36]">Năm {year}</span>
        </div>
        {/* Season selector dots */}
        <div className="mb-2 flex items-center justify-between gap-1">
          {SEASONS.map((s, i) => (
            <div
              key={s}
              className={`flex flex-1 items-center justify-center gap-1 rounded-lg border-2 px-1 py-1 text-[11px] font-bold ${
                i === seasonIndex
                  ? "border-[#e7b94e] bg-[#fff7e2] text-[#3b2f23]"
                  : "border-[#d2bf96] bg-[#efe6d2] text-[#6b5b45]"
              }`}
            >
              <span>{SEASON_THEME[s].emoji}</span>
              {s}
            </div>
          ))}
        </div>
        {/* Day grid */}
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: DAYS_PER_SEASON }).map((_, i) => {
            const d = i + 1;
            const isToday = d === day;
            const isFestival = d === 13 || d === 24;
            const isPast = d < day;
            return (
              <div
                key={i}
                className={`relative flex aspect-square items-center justify-center rounded-md border text-[11px] font-bold ${
                  isToday
                    ? "border-[#e7b94e] bg-[#e7b94e] text-[#3b2f23] shadow-md"
                    : isFestival
                      ? "border-[#d9694e] bg-[#fbe4df] text-[#c0452f]"
                      : isPast
                        ? "border-[#d2bf96] bg-[#efe6d2] text-[#6b5b45]"
                        : "border-[#d2bf96] bg-[#fffaf0] text-[#3b2f23]"
                }`}
                title={isFestival ? "Festival day!" : undefined}
              >
                {d}
                {isFestival && <span className="absolute bottom-0.5 text-[8px]">🎉</span>}
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex items-center gap-3 text-[10px] font-semibold text-[#6b5b45]">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded bg-[#e7b94e]" /> Today
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded bg-[#fbe4df]" /> Festival
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded bg-[#efe6d2]" /> Past
          </span>
        </div>
      </div>

      {/* Quests */}
      <div className="rounded-xl border-2 border-[#d2bf96] bg-[#fffaf0] p-3">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-[#8a6238]">
          <Target className="h-4 w-4" /> Quest Board
          <span className="ml-auto text-[10px] font-bold text-[#6b5b45]">
            {Object.keys(completed).filter((k) => completed[k]).length}/{QUESTS.length} done
          </span>
        </h3>
        <div className="space-y-2">
          {QUESTS.map((q) => {
            const done = q.check();
            const claimed = !!completed[q.id];
            const prog = q.progress();
            const pct = Math.round((prog.current / prog.target) * 100);
            const isActive = !claimed && q.id === activeId;
            return (
              <div
                key={q.id}
                className={`rounded-lg border-2 p-2.5 ${
                  claimed
                    ? "border-[#4e7d3a] bg-[#e7f4e0]"
                    : isActive
                      ? "border-[#e7b94e] bg-[#fff7e2]"
                    : done
                      ? "border-[#e7b94e] bg-[#fff7e2]"
                      : "border-[#d2bf96] bg-[#fffaf0]"
                }`}
              >
                <div className="flex items-start gap-2">
                  {claimed ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#4e7d3a]" />
                  ) : done ? (
                    <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-[#e7b94e]" />
                  ) : (
                    <Circle className="mt-0.5 h-4 w-4 shrink-0 text-[#6b5b45]" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-extrabold text-[#3b2f23]">
                      {q.title}
                      {isActive ? (
                        <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-[#8a6238]">
                          Đang làm
                        </span>
                      ) : null}
                    </p>
                    <p className="text-[11px] font-medium text-[#5a4a36]">{q.desc}</p>
                    {/* Progress bar */}
                    {!claimed && (
                      <div className="mt-1.5">
                        <div className="flex items-center justify-between text-[10px] font-bold text-[#6b5b45]">
                          <span>
                            {prog.current} / {prog.target}
                          </span>
                          <span>{pct}%</span>
                        </div>
                        <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full border border-[#6b4a2b] bg-[#d8c69e]">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#7cc36b] to-[#4e7d3a] transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )}
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-[#e7b94e]">
                      <Coins className="h-3 w-3" /> Phần thưởng {q.reward}g
                    </p>
                  </div>
                  <Button
                    size="sm"
                    disabled={claimed || !done}
                    onClick={() => claim(q.id)}
                    className="h-7 gap-1 border-2 border-[#4a3119] bg-[#4e7d3a] px-2 text-[11px] text-[#fbf7ec] hover:bg-[#5a8e44] disabled:opacity-50"
                  >
                    {claimed ? "Xong" : "Nhận"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        {shippedGold > 0 && (
          <p className="mt-2 rounded-lg bg-[#efe6d2] p-2 text-center text-[11px] font-bold text-[#5a4a36]">
            <Package className="mr-1 inline h-3.5 w-3.5" />Tổng đã bán: {shippedGold}g
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border-2 border-[#d2bf96] bg-[#fffaf0] px-2 py-1.5 text-center">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-[#8a6238]">{label}</div>
      <div className="text-sm font-extrabold text-[#3b2f23]">{value}</div>
    </div>
  );
}
