import { Clapperboard } from "lucide-react";
import { loadReplayAction } from "@/app/actions/replay";
import { ReplayTimeline } from "@/components/raid/ReplayTimeline";
import { ReplayCanvasPlayer } from "@/components/replay/replay-canvas-player";

/**
 * Replay page (audit M9 owner-only). Server Component — authz trong action.
 * Phase 9: owner → thêm canvas player (full re-sim snapshots).
 */
export default async function ReplayPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const result = await loadReplayAction(sessionId);
  if ("error" in result) {
    return (
      <div className="f-body p-8 text-center text-[var(--alarm)]">
        Không xem được replay: {result.error}
      </div>
    );
  }
  return (
    <main className="f-body min-h-screen bg-[#1a1410] p-4 text-[#fffaf0]">
      <h1 className="f-display mb-3 flex items-center gap-2 text-xl text-[var(--mystic)]">
        <Clapperboard aria-hidden className="h-5 w-5" /> Replay Raid
      </h1>
      {result.snaps && result.snaps.length > 0 && (
        <div className="mb-6">
          <ReplayCanvasPlayer snaps={result.snaps} />
        </div>
      )}
      <ReplayTimeline events={result.events} reason={result.reason} />
    </main>
  );
}
