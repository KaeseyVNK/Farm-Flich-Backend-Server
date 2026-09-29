import { NextResponse } from "next/server";
import { getLeaderboard, type LeaderboardKind } from "@/lib/game/leaderboard-service";

/**
 * Unity bridge — public leaderboards (level + gold).
 * Mirrors other /api/unity/* routes: token-auth (x-bridge-token).
 *
 * GET /api/unity/leaderboard?kind=level|gold&limit=N
 *   → { ok, kind, entries: [{ userId, name, value, extra? }] }
 */
function unauthorized() {
  return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
}

export async function GET(req: Request) {
  const token = req.headers.get("x-bridge-token");
  if (!token || token !== process.env.BRIDGE_TOKEN) return unauthorized();

  const url = new URL(req.url);
  const kind = (url.searchParams.get("kind") ?? "level").trim().toLowerCase();
  const limitRaw = url.searchParams.get("limit");

  if (kind !== "level" && kind !== "gold") {
    return NextResponse.json(
      { ok: false, error: "kind must be 'level' or 'gold'" },
      { status: 400 },
    );
  }

  const limit = limitRaw ? Number(limitRaw) : 20;
  if (!Number.isInteger(limit) || limit <= 0 || limit > 100) {
    return NextResponse.json(
      { ok: false, error: "limit must be an integer 1..100" },
      { status: 400 },
    );
  }

  try {
    const entries = await getLeaderboard(kind as LeaderboardKind, limit);
    return NextResponse.json({ ok: true, kind, entries });
  } catch (err) {
    console.error("[unity-leaderboard] failed:", err);
    return NextResponse.json({ ok: false, error: "leaderboard failed" }, { status: 500 });
  }
}