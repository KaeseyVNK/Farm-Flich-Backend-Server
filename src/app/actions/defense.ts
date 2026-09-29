"use server";

import { createClient } from "@/lib/supabase/server";
import { safeRpcError } from "@/lib/social/safe-errors";
import {
  upsertTrap,
  deleteTrap,
  validateTrapPayload,
  upsertDog,
  loadDog,
  validateDogPayload,
  type TrapPayload,
} from "@/lib/raid/defense-config-service";
import { MAP_SIZE } from "@/lib/raid/constants";
import { DEFENSE_MAX_LEVEL, type DefenseTarget } from "@/lib/game/defense-xp-config";

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthorized: chưa đăng nhập");
  return user.id;
}

/** Owner upsert trap (phase 1). Validate payload + slot + cap. */
export async function upsertTrapAction(
  slot: number,
  payload: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const uid = await requireUserId();
  // Review Low: slot range — trước đây raw pass, RPC chỉ guard auth/cap.
  if (!Number.isInteger(slot) || slot < 0 || slot > 5) {
    return { ok: false, error: "slot trap 0-5" };
  }
  if (!validateTrapPayload(payload, MAP_SIZE)) {
    return { ok: false, error: "trap payload không hợp lệ" };
  }
  return upsertTrap(uid, slot, payload as TrapPayload);
}

export async function deleteTrapAction(slot: number): Promise<{ ok: boolean; error?: string }> {
  const uid = await requireUserId();
  if (!Number.isInteger(slot) || slot < 0 || slot > 5) {
    return { ok: false, error: "slot trap 0-5" };
  }
  await deleteTrap(uid, slot);
  return { ok: true };
}

/** Owner load existing traps (ponytail L2 — persist view across reload). */
export async function listTrapsAction(): Promise<
  { slot: number; kind: string; tile: number; durability: number; level: number }[]
> {
  const uid = await requireUserId();
  const supabase = await createClient();
  const { data } = await supabase
    .from("DefenseConfig")
    .select("slot, payload")
    .eq("userId", uid)
    .eq("type", "trap");
  return ((data ?? []) as { slot: number; payload: Record<string, number> }[]).map((r) => ({
    slot: r.slot,
    kind: String(r.payload?.kind ?? "spike"),
    tile: Number(r.payload?.tile ?? 0),
    durability: Number(r.payload?.durability ?? 1),
    level: Number(r.payload?.level ?? 1),
  }));
}

/** Owner upgrade DefenseConfig level (phase 3). Atomic RPC spend_defense_xp. */
export async function spendDefenseXpAction(
  target: DefenseTarget,
  slot: number,
  level: number,
): Promise<{ ok: boolean; error?: string }> {
  if (!["dog", "fence", "trap"].includes(target)) return { ok: false, error: "target sai" };
  if (!Number.isInteger(level) || level < 1 || level > DEFENSE_MAX_LEVEL) {
    return { ok: false, error: `level 1-${DEFENSE_MAX_LEVEL}` };
  }
  const uid = await requireUserId();
  const supabase = await createClient();
  const { error } = await supabase.rpc("spend_defense_xp", {
    p_user: uid,
    p_target: target,
    p_slot: slot,
    p_level: level,
  });
  if (error) return { ok: false, error: safeRpcError(error) ?? "Không thực hiện được" };
  return { ok: true };
}


/** W7b: owner lưu dog config (giống + waypoint). Validate + upsert slot 10. */
export async function saveDogAction(payload: unknown): Promise<{ ok: boolean; error?: string }> {
  const uid = await requireUserId();
  if (!validateDogPayload(payload, MAP_SIZE)) {
    return { ok: false, error: "dog payload không hợp lệ (breed/tile/patrol 2-6)" };
  }
  return upsertDog(uid, payload as { breed: string; tile: number; level: number; patrol?: { x: number; y: number }[] });
}

/** W7b: load dog config owner. */
export async function loadDogAction(): Promise<{ breed: string; tile: number; level: number; patrol?: { x: number; y: number }[] } | null> {
  const uid = await requireUserId();
  return loadDog(uid);
}
