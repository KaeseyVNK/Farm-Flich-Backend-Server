"use client";

import { AlertTriangle, RefreshCw, Trophy } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { bootAuthFromStorage, useAuthSnapshot } from "@/components/auth/session";
import {
  fetchLeaderboard,
  type LeaderboardKind,
  type LeaderboardResult,
} from "@/lib/leaderboard-api";
import { LeaderboardSkeleton, LeaderboardTable } from "./leaderboard-table";
import { MyRankBar } from "./my-rank-bar";

const TOP_LIMIT = 10;

const TABS: readonly { kind: LeaderboardKind; label: string }[] = [
  { kind: "gold", label: "Gold Rank" },
  { kind: "level", label: "Level Rank" },
];

const cardClass =
  "pixel-border-sm flex flex-col items-center gap-3 bg-[#fffcf0] px-6 py-10 text-center";

const retryButtonClass =
  "pixel-shadow-hover inline-flex min-h-11 items-center gap-2 border-[3px] border-[#231b18] bg-[#f7c948] px-4 font-display text-sm font-extrabold text-[#231b18] shadow-[3px_3px_0_#231b18] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f7c948]";

type CachedLeaderboard = { result: LeaderboardResult; tick: number };

/**
 * Bảng xếp hạng 2 tab (Gold/Level): top 10 + dòng "Hạng của tôi / Tổng số người chơi".
 * Username đọc từ localStorage (key `mf_username`) — chưa có thì ẩn phần my-rank.
 * Loading là trạng thái suy diễn (tick của request mới hơn tick của kết quả đã có),
 * không cần setState trong effect.
 */
export function LeaderboardView() {
  const [kind, setKind] = useState<LeaderboardKind>("gold");
  const [ticks, setTicks] = useState<Record<LeaderboardKind, number>>({ gold: 0, level: 0 });
  const [results, setResults] = useState<Partial<Record<LeaderboardKind, CachedLeaderboard>>>({});
  const auth = useAuthSnapshot();
  const username = auth.username;
  useEffect(() => { bootAuthFromStorage(); }, []);

  // Fetch mỗi khi đổi tab, refresh (tăng tick), hoặc mới mount.
  useEffect(() => {
    let cancelled = false;
    fetchLeaderboard(kind, TOP_LIMIT, auth.token ?? undefined).then((result) => {
      if (cancelled) return;
      setResults((prev) => ({ ...prev, [kind]: { result, tick: ticks[kind] } }));
    });
    return () => {
      cancelled = true;
    };
  }, [kind, ticks, auth.token]);

  const active = results[kind];
  // Request hiện tại chưa có kết quả tương ứng → đang loading (kể cả khi đang giữ dữ liệu cũ).
  const isLoading = !active || active.tick !== ticks[kind];

  const refresh = useCallback(() => {
    setTicks((prev) => ({ ...prev, [kind]: prev[kind] + 1 }));
  }, [kind]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Leaderboard type"
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              event.preventDefault();
              setKind((current) => (current === "gold" ? "level" : "gold"));
            }
          }}
          className="pixel-border-sm inline-flex gap-1 bg-[#181b31] p-1 shadow-[3px_3px_0_#231b18]"
        >
          {TABS.map((tab) => {
            const isActive = kind === tab.kind;
            return (
              <button
                key={tab.kind}
                type="button"
                role="tab"
                id={`leaderboard-tab-${tab.kind}`}
                aria-selected={isActive}
                aria-controls="leaderboard-panel"
                tabIndex={isActive ? 0 : -1}
                onClick={() => setKind(tab.kind)}
                className={`inline-flex min-h-11 items-center rounded-sm px-4 font-display text-sm font-extrabold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7c948] md:text-base ${
                  isActive
                    ? "bg-[#f7c948] text-[#231b18] shadow-[2px_2px_0_#0d1020]"
                    : "text-[#f7edcf]/75 hover:bg-[#f7edcf]/10 hover:text-[#f7edcf]"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={refresh}
          className="pixel-shadow-hover inline-flex min-h-11 items-center gap-2 border-[3px] border-[#231b18] bg-[#fffcf0] px-4 font-display text-sm font-extrabold text-[#231b18] shadow-[3px_3px_0_#231b18] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f7c948]"
        >
          <RefreshCw className={`size-4 ${isLoading ? "animate-spin motion-reduce:animate-none" : ""}`} aria-hidden="true" />
          Refresh
        </button>
      </div>

      <div
        id="leaderboard-panel"
        role="tabpanel"
        aria-labelledby={`leaderboard-tab-${kind}`}
        aria-busy={isLoading}
        className="mt-6"
      >
        {isLoading ? (
          <LeaderboardSkeleton />
        ) : !active ? null : !active.result.ok ? (
          <div className={cardClass} aria-live="polite">
            <AlertTriangle className="size-9 text-[#b93d35]" aria-hidden="true" />
            <p className="max-w-md text-base font-bold text-[#231b18]">{active.result.error}</p>
            <button type="button" onClick={refresh} className={retryButtonClass}>
              Try again
            </button>
          </div>
        ) : active.result.data.entries.length === 0 ? (
          <div className={cardClass}>
            <Trophy className="size-9 text-[#c98219]" aria-hidden="true" />
            <p className="max-w-md text-base font-bold text-[#231b18]">
              No leaderboard data yet for this board. Check back once the game server has players!
            </p>
          </div>
        ) : (
          <>
            <LeaderboardTable kind={kind} entries={active.result.data.entries} />
            {username && (
              <MyRankBar myRank={active.result.data.myRank} totalUsers={active.result.data.totalUsers} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
