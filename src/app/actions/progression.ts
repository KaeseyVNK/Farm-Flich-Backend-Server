"use server";

import { createClient } from "@/lib/supabase/server";
import { pullProgression, pushProgression } from "@/lib/game/progression-service";

/**
 * Cloud-synced RPG progression (level/xp/skillPoints/perks) — web client.
 * Session-authed (Supabase), unlike the Unity bridge (token-auth). Both call the
 * same progression-service (LWW on version). Used by ProgressionCloudSync.
 */

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthorized: chưa đăng nhập");
  return user.id;
}

export interface ProgressionSyncResult {
  progression?: {
    level: number;
    xp: number;
    totalXp: number;
    skillPoints: number;
    perkAllocations: { farming: number; combat: number; social: number };
    version: number;
  };
  stale?: boolean;
  error?: string;
}

/** Pull the logged-in user's progression. */
export async function pullProgressionAction(): Promise<ProgressionSyncResult> {
  const uid = await requireUserId();
  try {
    const r = await pullProgression(uid);
    if (!r.ok) return { error: r.error };
    return { progression: r.progression };
  } catch (err) {
    console.error("[progression-action] pull failed:", err);
    return { error: err instanceof Error ? err.message : "pull failed" };
  }
}

/** Push the logged-in user's progression (LWW on version). */
export async function pushProgressionAction(data: {
  level: number;
  xp: number;
  totalXp: number;
  skillPoints: number;
  perkAllocations: { farming: number; combat: number; social: number };
  version: number;
}): Promise<ProgressionSyncResult> {
  const uid = await requireUserId();
  try {
    const r = await pushProgression(uid, data, data.version);
    return { progression: r.progression, stale: r.stale };
  } catch (err) {
    console.error("[progression-action] push failed:", err);
    return { error: err instanceof Error ? err.message : "push failed" };
  }
}