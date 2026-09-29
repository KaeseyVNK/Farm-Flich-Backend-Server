import { db } from "@/lib/db";

export interface ProgressionPayload {
  level: number;
  xp: number;
  totalXp: number;
  skillPoints: number;
  perkAllocations: { farming: number; combat: number; social: number };
  version: number;
}

export interface PullResult {
  ok: boolean;
  error?: string;
  progression?: ProgressionPayload;
}

/**
 * Pull a user's cloud progression (level/xp/skillPoints/perks) by userId.
 * Returns { ok:false, error:"NOT_FOUND" } when the user has no row yet.
 */
export async function pullProgression(userId: string): Promise<PullResult> {
  const row = await db.userProgression.findUnique({ where: { userId } });
  if (!row) return { ok: false, error: "NOT_FOUND" };
  return {
    ok: true,
    progression: {
      level: row.level,
      xp: row.xp,
      totalXp: row.totalXp,
      skillPoints: row.skillPoints,
      perkAllocations: (row.perkAllocations as { farming: number; combat: number; social: number }) ?? {
        farming: 0,
        combat: 0,
        social: 0,
      },
      version: row.version,
    },
  };
}

/**
 * Push a user's progression. LWW (last-write-wins on `version`):
 *   - no row → create with the incoming version (or 0 if absent).
 *   - row exists and incoming version < stored → REJECT (stale client; server wins).
 *   - row exists and incoming version >= stored → accept and increment version.
 * Returns the accepted { version, progression } so the client can reconcile.
 */
export async function pushProgression(
  userId: string,
  incoming: Omit<ProgressionPayload, "version">,
  incomingVersion: number,
): Promise<{ ok: boolean; error?: string; progression?: ProgressionPayload; stale?: boolean }> {
  const cl = (n: unknown, fb: number) =>
    typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : fb;
  const pa = incoming.perkAllocations ?? {};
  const perkAllocations = {
    farming: cl(pa.farming, 0),
    combat: cl(pa.combat, 0),
    social: cl(pa.social, 0),
  };

  // Ensure the owning User row exists (FK) — same pattern as auth/farm bridge.
  await db.user.upsert({
    where: { id: userId },
    create: { id: userId, displayName: userId },
    update: {},
  });

  const existing = await db.userProgression.findUnique({ where: { userId } });
  const incomingV = typeof incomingVersion === "number" ? Math.max(0, Math.floor(incomingVersion)) : 0;

  if (!existing) {
    const created = await db.userProgression.create({
      data: {
        userId,
        level: Math.min(10, cl(incoming.level, 1) || 1),
        xp: cl(incoming.xp, 0),
        totalXp: cl(incoming.totalXp, 0),
        skillPoints: cl(incoming.skillPoints, 0),
        perkAllocations,
        version: incomingV,
      },
    });
    return {
      ok: true,
      progression: {
        level: created.level,
        xp: created.xp,
        totalXp: created.totalXp,
        skillPoints: created.skillPoints,
        perkAllocations: perkAllocations,
        version: created.version,
      },
    };
  }

  // LWW: stale client (lower version) loses; server keeps its version.
  if (incomingV < existing.version) {
    return {
      ok: true,
      stale: true,
      progression: {
        level: existing.level,
        xp: existing.xp,
        totalXp: existing.totalXp,
        skillPoints: existing.skillPoints,
        perkAllocations: (existing.perkAllocations as { farming: number; combat: number; social: number }) ?? {
          farming: 0,
          combat: 0,
          social: 0,
        },
        version: existing.version,
      },
    };
  }

  const updated = await db.userProgression.update({
    where: { id: existing.id },
    data: {
      level: Math.min(10, cl(incoming.level, 1) || 1),
      xp: cl(incoming.xp, 0),
      totalXp: cl(incoming.totalXp, 0),
      skillPoints: cl(incoming.skillPoints, 0),
      perkAllocations,
      version: { increment: 1 },
    },
  });

  return {
    ok: true,
    progression: {
      level: updated.level,
      xp: updated.xp,
      totalXp: updated.totalXp,
      skillPoints: updated.skillPoints,
      perkAllocations,
      version: updated.version,
    },
  };
}