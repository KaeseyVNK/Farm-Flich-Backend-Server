"use server";

import { createClient } from "@/lib/supabase/server";
import {
  saveFarm,
  loadFarm,
  type FarmSaveData,
} from "@/lib/game/farm-service";
import { migrateLocalToCloud, type LocalSave } from "@/lib/game/sync";

/**
 * Server Actions — farm save/load + migrate local→cloud.
 * Auth: userId từ session. Logic đã test trong farm-service + sync (docker).
 */

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthorized: chưa đăng nhập");
  return user.id;
}

/** Save farm JSONB (phi-gold). Reject khi raid active (lock-check). */
export async function saveFarmAction(data: FarmSaveData): Promise<{ version: number }> {
  const uid = await requireUserId();
  const version = await saveFarm(uid, data);
  return { version };
}

export async function loadFarmAction() {
  const uid = await requireUserId();
  return loadFarm(uid);
}

/** Migrate local save → cloud 1 lần (idempotent). */
export async function migrateFarmAction(local: LocalSave | null): Promise<boolean> {
  const uid = await requireUserId();
  return migrateLocalToCloud(uid, local);
}
