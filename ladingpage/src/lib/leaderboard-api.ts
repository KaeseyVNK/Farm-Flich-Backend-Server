import { GAME_API_BASE_URL } from "./game-api";
export type LeaderboardKind = "gold" | "level";
export type LeaderboardEntry = { rank: number; userId: string; name: string; value: number };
export type LeaderboardData = { kind: LeaderboardKind; entries: LeaderboardEntry[]; myRank: number | null; totalUsers: number | null };
export type LeaderboardResult = { ok: true; data: LeaderboardData } | { ok: false; error: string };

export async function fetchLeaderboard(kind: LeaderboardKind, limit = 10, token?: string): Promise<LeaderboardResult> {
  try {
    const url = new URL(`${GAME_API_BASE_URL}/leaderboard`);
    url.searchParams.set("kind", kind); url.searchParams.set("limit", String(limit));
    const response = await fetch(url, { headers: { Accept: "application/json", "X-Client-Version": "4", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, cache: "no-store", signal: AbortSignal.timeout(15000) });
    const body = await response.json();
    if (!response.ok || body?.ok !== true || !Array.isArray(body.entries)) return { ok: false, error: "The leaderboard is temporarily unavailable. Please try again." };
    const entries = body.entries.filter((entry: Record<string, unknown>) => typeof entry.userId === "string" && typeof entry.name === "string" && typeof entry.value === "number" && Number.isFinite(entry.value)).map((entry: LeaderboardEntry, index: number) => ({ ...entry, rank: index + 1 }));
    return { ok: true, data: { kind, entries, myRank: Number.isSafeInteger(body.myRank) && body.myRank > 0 ? body.myRank : null, totalUsers: Number.isSafeInteger(body.totalUsers) && body.totalUsers >= 0 ? body.totalUsers : null } };
  } catch { return { ok: false, error: "Could not reach the game server. Please try again." }; }
}
