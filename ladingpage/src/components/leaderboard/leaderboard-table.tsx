import type { LeaderboardEntry, LeaderboardKind } from "@/lib/leaderboard-api";

/** Màu huy hiệu hạng theo top 3 — đồng bộ token harvest/soil trong DESIGN.md. */
const TOP_RANK_BADGE: Record<number, string> = {
  1: "bg-[#f7c948] text-[#231b18]",
  2: "bg-[#e8e0cc] text-[#231b18]",
  3: "bg-[#d97b2a] text-[#fff7de]",
};

function formatValue(value: number): string {
  return Number.isInteger(value) ? value.toLocaleString("en-US") : String(value);
}

function RankBadge({ rank }: { rank: number }) {
  const tone = TOP_RANK_BADGE[rank] ?? "bg-[#f2e1b7] text-[#231b18]";
  return (
    <span
      className={`inline-flex size-8 items-center justify-center border-2 border-[#231b18] font-display text-sm font-extrabold shadow-[2px_2px_0_#231b18] ${tone}`}
    >
      {rank}
    </span>
  );
}

/**
 * Bảng top 10 phong cách pixel: nền card sáng, header #181b31/#f7c948,
 * hàng top-3 highlight vàng harvest (đúng grammar pixel-border của globals.css).
 */
export function LeaderboardTable({
  kind,
  entries,
}: {
  kind: LeaderboardKind;
  entries: LeaderboardEntry[];
}) {
  return (
    <div className="overflow-x-auto pixel-border bg-[#fffcf0]">
      <table className="w-full min-w-[26rem] border-collapse text-left">
        <caption className="sr-only">
          Top 10 players by {kind === "gold" ? "Gold" : "Level"}
        </caption>
        <thead>
          <tr className="bg-[#181b31] text-[#f7c948]">
            <th scope="col" className="px-4 py-3 font-display text-sm font-extrabold uppercase tracking-[0.14em]">
              Rank
            </th>
            <th scope="col" className="px-4 py-3 font-display text-sm font-extrabold uppercase tracking-[0.14em]">
              Player
            </th>
            <th scope="col" className="px-4 py-3 text-right font-display text-sm font-extrabold uppercase tracking-[0.14em]">
              {kind === "gold" ? "Gold" : "Level"}
            </th>
          </tr>
        </thead>
        <tbody className="text-[#231b18]">
          {entries.map((entry, index) => (
            <tr
              key={`${entry.rank}-${entry.userId || entry.name}`}
              className={`border-t-[3px] border-[#231b18]/15 ${index < 3 ? "bg-[#f7c948]/20" : ""}`}
            >
              <td className="px-4 py-2.5">
                <RankBadge rank={entry.rank} />
              </td>
              <td className="max-w-[16rem] truncate px-4 py-2.5 text-sm font-bold" title={entry.name}>
                {entry.name}
              </td>
              <td className="px-4 py-2.5 text-right font-display text-base font-extrabold tabular-nums">
                {formatValue(entry.value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Skeleton loading — 5 hàng khối xám pulse, giữ đúng khung bảng. */
export function LeaderboardSkeleton() {
  return (
    <div className="pixel-border bg-[#fffcf0]" aria-hidden="true">
      <div className="h-11 bg-[#181b31]" />
      <div className="flex flex-col gap-3 px-4 py-4">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="flex items-center gap-4">
            <div className="size-8 shrink-0 animate-pulse bg-[#231b18]/10" />
            <div className="h-5 grow animate-pulse bg-[#231b18]/10" />
            <div className="h-5 w-20 animate-pulse bg-[#231b18]/10" />
          </div>
        ))}
      </div>
      <p className="sr-only" aria-live="polite">
        Loading leaderboard…
      </p>
    </div>
  );
}
