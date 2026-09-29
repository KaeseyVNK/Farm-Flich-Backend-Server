import { db } from "@/lib/db";

export interface LeaderboardEntry {
  userId: string;
  name: string;
  value: number;
  extra?: number;
}

export type LeaderboardKind = "level" | "gold";

const MAX_ENTRIES = 100;

/**
 * Level leaderboard: UserProgression.level DESC, totalXp DESC, gold DESC.
 * Only players with a progression row (i.e. who have gained XP).
 */
export async function topByLevel(limit: number = 20): Promise<LeaderboardEntry[]> {
  const n = clamp(limit);
  const rows = await db.$queryRaw<
    { userId: string; name: string; level: number; totalXp: number }[]
  >`
    SELECT p."userId" AS "userId",
           COALESCE(u."displayName", p."userId") AS "name",
           p.level,
           p."totalXp" AS "totalXp"
    FROM "UserProgression" p
    JOIN "User" u ON u.id = p."userId"
    ORDER BY p.level DESC, p."totalXp" DESC, u.gold DESC
    LIMIT ${n}`;
  return rows.map((r) => ({
    userId: r.userId,
    name: r.name,
    value: r.level,
    extra: r.totalXp,
  }));
}

/**
 * Gold leaderboard: User.gold DESC. Server-authoritative User.gold sink.
 */
export async function topByGold(limit: number = 20): Promise<LeaderboardEntry[]> {
  const n = clamp(limit);
  const rows = await db.$queryRaw<{ userId: string; name: string; gold: number }[]>`
    SELECT u.id AS "userId",
           COALESCE(u."displayName", u.id) AS "name",
           u.gold
    FROM "User" u
    ORDER BY u.gold DESC
    LIMIT ${n}`;
  return rows.map((r) => ({ userId: r.userId, name: r.name, value: r.gold }));
}

export async function getLeaderboard(kind: LeaderboardKind, limit?: number): Promise<LeaderboardEntry[]> {
  return kind === "gold" ? topByGold(limit) : topByLevel(limit);
}

function clamp(limit?: number): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) return 20;
  return Math.max(1, Math.min(MAX_ENTRIES, Math.floor(limit)));
}