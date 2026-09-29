import { createClient } from "@/lib/supabase/server";
import { TRAP_DEFAULT_DURABILITY, MAP_SIZE, MAP_COLS as RAID_MAP_COLS, MAP_ROWS as RAID_MAP_ROWS } from "@/lib/raid/constants";
import { DOG_BREEDS } from "@/lib/raid/dog-catalog";

/**
 * Defense config service (phase 1 trap). Owner upsert/delete DefenseConfig.
 * Server-authoritative: validate payload + cap 6/farm.
 * Trap payload: { kind: bear|spike|alarm, tile, durability, level }.
 */

export type TrapKind = "bear" | "spike" | "alarm";
export interface TrapPayload {
  kind: TrapKind;
  tile: number;
  durability: number;
  level: 1 | 2 | 3;
}

/** Validate trap payload (kind enum + tile range + durability 1-5 + level 1-3). */
export function validateTrapPayload(p: unknown, mapSize: number): p is TrapPayload {
  if (!p || typeof p !== "object") return false;
  const o = p as Record<string, unknown>;
  if (!["bear", "spike", "alarm"].includes(o.kind as string)) return false;
  const tile = Number(o.tile);
  if (!Number.isInteger(tile) || tile < 0 || tile >= mapSize) return false;
  const dur = Number(o.durability ?? TRAP_DEFAULT_DURABILITY);
  if (!Number.isInteger(dur) || dur < 1 || dur > 5) return false;
  // level ∈ {1,2,3} — audit H3 (chặn unbounded super-trap).
  const level = Number(o.level ?? 1);
  if (![1, 2, 3].includes(level)) return false;
  return true;
}

/**
 * Upsert trap qua RPC atomic `upsert_trap`.
 * Trước đây count (read) → upsert (write) RMW race: 2 upsert khác slot cùng đọc
 * count=5 < 6 → cả hai pass → 8 trap. RPC gói count + FOR UPDATE User row +
 * INSERT...ON CONFLICT trong 1 tx → serialize per-user, cap enforce server-side.
 */
export async function upsertTrap(
  userId: string,
  slot: number,
  payload: TrapPayload,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("upsert_trap", {
    p_user: userId,
    p_slot: slot,
    p_payload: payload,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Xóa trap theo slot. */
export async function deleteTrap(userId: string, slot: number): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("DefenseConfig")
    .delete()
    .eq("userId", userId)
    .eq("slot", slot)
    .eq("type", "trap");
}

// ── W7b: dog config (giống + waypoint chủ) — §10.1 ──

export interface DogPayload {
  breed: string;
  /** Tile spawn (index 0..MAP_SIZE-1) — cũng vị trí đứng đầu patrol. */
  tile: number;
  level: number; // 1-3 (tầm nhìn/hearing — spend_defense_xp như cũ)
  /** Waypoint chủ đặt 2-6 điểm (server gen AI nếu thiếu/không hợp lệ). */
  patrol?: { x: number; y: number }[];
}

/** Validate dog payload: breed enum + tile range + patrol 2-6 điểm trong 30×22. */
export function validateDogPayload(p: unknown, mapSize: number): p is DogPayload {
  if (!p || typeof p !== "object") return false;
  const o = p as Record<string, unknown>;
  if (!DOG_BREEDS.some((b) => b.id === o.breed)) return false;
  const tile = Number(o.tile);
  if (!Number.isInteger(tile) || tile < 0 || tile >= mapSize) return false;
  const level = Number(o.level ?? 1);
  if (![1, 2, 3].includes(level)) return false;
  if (o.patrol !== undefined) {
    if (!Array.isArray(o.patrol) || o.patrol.length < 2 || o.patrol.length > 6) return false;
    for (const pt of o.patrol as { x: unknown; y: unknown }[]) {
      const x = Number(pt?.x);
      const y = Number(pt?.y);
      if (!Number.isInteger(x) || x < 0 || x >= RAID_MAP_COLS) return false;
      if (!Number.isInteger(y) || y < 0 || y >= RAID_MAP_ROWS) return false;
    }
  }
  return true;
}

/** Upsert dog config (slot cố định 10 — tách dải slot trap 0-5). */
export async function upsertDog(
  userId: string,
  payload: DogPayload,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("DefenseConfig")
    .upsert(
      { userId, slot: 10, type: "dog", payload: payload as unknown as Record<string, unknown> },
      { onConflict: "userId,slot,type" },
    );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Load dog config hiện tại (null nếu chưa có — room dùng MVP dog giữa). */
export async function loadDog(
  userId: string,
): Promise<DogPayload | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("DefenseConfig")
    .select("payload")
    .eq("userId", userId)
    .eq("type", "dog")
    .maybeSingle();
  const payload = (data as { payload?: Record<string, unknown> } | null)?.payload;
  if (!payload) return null;
  return validateDogPayload(payload, MAP_SIZE) ? (payload as unknown as DogPayload) : null;
}
