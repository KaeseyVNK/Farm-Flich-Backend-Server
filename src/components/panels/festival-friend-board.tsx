"use client";

import type { FestivalFriendRow } from "@/lib/game/festival/festival-friend-contest";

export function FestivalFriendBoard({ board }: { board: FestivalFriendRow[] | null }) {
  return (
    <div className="mt-2 border-t border-[#c9b68c] pt-2" data-testid="fest-leaderboard">
      {board === null ? (
        <p className="text-[11px] text-[#6b5b45]">Đang tải bảng bạn bè…</p>
      ) : board.length === 0 ? (
        <p className="text-[11px] text-[#6b5b45]">
          Chưa có dữ liệu bảng điểm. Ngưỡng: đồng 30 / bạc 100 / vàng 200.
        </p>
      ) : (
        <ul className="space-y-0.5 text-[11px] text-[#3b2f23]">
          {board.map((r, i) => (
            <li key={r.userId}>
              #{i + 1} {r.displayName?.trim() || r.userId.slice(0, 8)} — {r.score} điểm ({r.likes}{" "}
              like)
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
