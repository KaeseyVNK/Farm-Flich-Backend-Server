import { decorScore } from "@/lib/game/festival/festival-scoring";
import type { PlacedDecor } from "@/lib/game/decor/decor-placement";

export interface FestivalFriendRow {
  userId: string;
  displayName: string | null;
  likes: number;
  score: number;
}

export interface FestivalContestRpcRow {
  userId?: unknown;
  displayName?: unknown;
  likes?: unknown;
  placedDecor?: unknown;
}

function asFarmPlaced(raw: unknown): PlacedDecor[] {
  if (!Array.isArray(raw)) return [];
  const out: PlacedDecor[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const d = row as { defId?: unknown; zone?: unknown };
    if (typeof d.defId !== "string" || d.zone !== "farm") continue;
    out.push({
      uid: "",
      defId: d.defId,
      zone: "farm",
      tx: 0,
      ty: 0,
      rot: 0,
      flip: false,
    });
  }
  return out;
}

/** Map RPC rows → ranked board. Scoring stays client-side (decorScore). */
export function scoreFriendContestRows(rows: FestivalContestRpcRow[]): FestivalFriendRow[] {
  return rows
    .filter((r): r is FestivalContestRpcRow & { userId: string } => typeof r.userId === "string")
    .map((r) => {
      const likes = typeof r.likes === "number" && Number.isFinite(r.likes) ? r.likes : 0;
      return {
        userId: r.userId,
        displayName: typeof r.displayName === "string" ? r.displayName : null,
        likes,
        score: decorScore(asFarmPlaced(r.placedDecor), likes),
      };
    })
    .sort((a, b) => b.score - a.score || a.userId.localeCompare(b.userId));
}
