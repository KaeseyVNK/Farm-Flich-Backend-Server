"use client";

import { useState } from "react";
import { PuzzleModal } from "@/components/raid/PuzzleModal";
import { puzzleScore, PUZZLE_SCORE_PER_SOLVE } from "@/lib/game/festival/festival-scoring";

/**
 * W8 — Puzzle booth giải trí (§14): memory puzzle client-gen (không anti-cheat —
 * không loot thật). Mỗi lượt giải đúng = PUZZLE_SCORE_PER_SOLVE điểm hoạt động
 * (review W8: 2đ → 10đ/lượt — gold 200 đạt được trong ~20 lượt thay vì 100).
 */
export function FestivalPuzzleBooth({
  solved,
  onSolved,
}: {
  solved: number;
  onSolved: () => void;
}) {
  const [puzzleOpen, setPuzzleOpen] = useState(false);
  const [seq, setSeq] = useState<number[]>([]);

  const open = () => {
    setSeq(Array.from({ length: 4 }, () => Math.floor(Math.random() * 4)));
    setPuzzleOpen(true);
  };

  return (
    <div className="relative">
      <div className="flex items-center justify-between rounded border-2 border-[#c9b68c] bg-[#fff7e2] p-2">
        <div>
          <p className="text-sm font-bold">🧩 Gian giải đố</p>
          <p className="text-[11px] text-[#6b5b45]">
            Giải đúng 1 câu nhớ thứ tự = {PUZZLE_SCORE_PER_SOLVE} điểm/lượt (đã giải {solved} lượt —{" "}
            {puzzleScore(solved)} điểm)
          </p>
        </div>
        <button
          onClick={open}
          data-testid="booth-open"
          className="shrink-0 rounded border-2 border-[#4a3119] bg-[#e7b94e] px-2 py-1 text-xs font-bold text-[#3b2f23] hover:bg-[#f0c964]"
        >
          Giải 1 câu
        </button>
      </div>
      {puzzleOpen && (
        <PuzzleModal
          kind="memory"
          seq={seq}
          deadlineMs={Date.now() + 20000}
          onSubmit={(attempt) => {
            setPuzzleOpen(false);
            if (attempt.length === seq.length && attempt.every((n, i) => n === seq[i])) {
              onSolved();
            }
          }}
          onCancel={() => setPuzzleOpen(false)}
        />
      )}
    </div>
  );
}
