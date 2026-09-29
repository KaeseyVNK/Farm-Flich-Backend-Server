"use client";

import type { ReplayEventDto } from "@/app/actions/replay";

/**
 * ReplayTimeline (concept §12). Render event log tick-based.
 * MVP: danh sách + label. Roadmap: full re-sim canvas.
 */
const TYPE_LABEL: Record<string, string> = {
  move: "Di chuyển",
  chestOpen: "Mở rương",
  puzzleFail: "Trả lời sai",
  puzzleSolve: "Giải đố",
  bite: "Chó cắn",
  alert: "Cảnh báo",
  lockdown: "Chủ về",
  exit: "Thoát",
  caught: "Bị bắt",
  timeout: "Hết giờ",
  tick: "",
};

export function ReplayTimeline({ events, reason }: { events: ReplayEventDto[]; reason: string | null }) {
  const meaningful = events.filter((e) => e.type !== "tick");
  return (
    <div className="f-body mx-auto max-w-2xl p-4 text-[var(--night)]">
      <h1 className="f-display mb-2 text-2xl text-[var(--mystic)]">Timeline raid</h1>
      <p className="mb-4 text-sm opacity-70">
        Kết thúc: <span className="font-bold">{reason ? TYPE_LABEL[reason] ?? reason : "—"}</span> ·{" "}
        {meaningful.length} hành động
      </p>
      <ol className="space-y-1 text-sm">
        {meaningful.map((e) => (
          <li key={`${e.tick}-${e.seq}`} className="flex gap-3 border-b border-black/10 pb-1">
            <span className="f-num w-16 shrink-0 text-[var(--mystic)]">t{e.tick}</span>
            <span className="flex-1">{TYPE_LABEL[e.type] ?? e.type}</span>
          </li>
        ))}
        {meaningful.length === 0 && <li className="opacity-50">Không có dữ liệu.</li>}
      </ol>
    </div>
  );
}
