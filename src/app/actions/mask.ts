"use server";

import { createClient } from "@/lib/supabase/server";
import { safeRpcError } from "@/lib/social/safe-errors";
import { findRecipe } from "@/lib/game/mask-catalog";
import { REPUTATION_EFFECTS } from "@/lib/raid/constants";

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthorized: chưa đăng nhập");
  return user.id;
}

/**
 * Craft mask (phase 4). Deduct ingredients (loop updateInventory atomic) + craft_mask RPC (gold + INSERT Mask).
 * ON CONFLICT DO NOTHING — đã sở hữu → gold không trừ (idempotent guard).
 */
export async function craftMaskAction(maskId: string): Promise<{ ok: boolean; error?: string }> {
  const recipe = findRecipe(maskId);
  if (!recipe) return { ok: false, error: "recipe không tồn tại" };
  const uid = await requireUserId();
  const supabase = await createClient();

  // RPC craft_mask atomic: deduct gold + ingredients + INSERT Mask (audit C2).
  const { error } = await supabase.rpc("craft_mask", {
    p_user: uid,
    p_mask: maskId,
    p_gold_cost: recipe.goldCost,
    p_durability_cap: recipe.durabilityCap,
    p_ingredients: recipe.ingredients,
  });
  if (error) return { ok: false, error: safeRpcError(error) ?? "Không thực hiện được" };
  return { ok: true };
}

/** Equip mask — đúng 1 active. RPC atomic 1 tx (auth guard + set all cùng lúc). */
export async function equipMaskAction(maskId: string): Promise<{ ok: boolean; error?: string }> {
  const uid = await requireUserId();
  // Review Low: maskId phải thuộc sở hữu — equip_mask với id lạ set equipped=false
  // cho mọi row mà không báo lỗi (mất equipped silently).
  const supabase = await createClient();
  const { data: owned } = await supabase
    .from("Mask")
    .select("maskId")
    .eq("userId", uid)
    .eq("maskId", maskId)
    .maybeSingle();
  if (!owned) return { ok: false, error: "mask không tồn tại" };
  // RPC equip_mask atomic: set equipped=("maskId"=p_mask) cho mọi row user trong
  // 1 tx. Trước đây 2 statement riêng — statement 2 fail = mất hết equipped mask
  // → finalize_raid resolve maskId="rogue" mặc định sai.
  const { error } = await supabase.rpc("equip_mask", { p_user: uid, p_mask: maskId });
  if (error) return { ok: false, error: safeRpcError(error) ?? "Không thực hiện được" };
  return { ok: true };
}

/** Load masks owned + equipped. */
export async function loadMasksAction(): Promise<
  { maskId: string; durability: number; equipped: boolean }[]
> {
  const uid = await requireUserId();
  const supabase = await createClient();
  const { data } = await supabase
    .from("Mask")
    .select("maskId, durability, equipped")
    .eq("userId", uid);
  return (data ?? []) as { maskId: string; durability: number; equipped: boolean }[];
}

/**
 * W7d-P2 — mua mask tier 2 chợ đen (§14): gate thief rep ≥ 50 (server-check,
 * client không tự khai) + RPC craft_mask (ingredients {} → chỉ trừ gold).
 */
export async function buyBlackMaskAction(maskId: string): Promise<{ ok: boolean; error?: string }> {
  const recipe = findRecipe(maskId);
  if (!recipe || recipe.tier !== 2) return { ok: false, error: "mặt nạ chợ đen không tồn tại" };
  const uid = await requireUserId();
  const supabase = await createClient();

  // Thief rep gate — server-authoritative (RLS read public).
  const { data: repRow } = await supabase
    .from("Reputation")
    .select("thief")
    .eq("userId", uid)
    .maybeSingle();
  const thief = (repRow as { thief?: number } | null)?.thief ?? 0;
  if (thief < REPUTATION_EFFECTS.THIEF_MASK_TIER2_AT) {
    return { ok: false, error: "Cần 50 danh tiếng Trộm (thoát raid thành công nhiều hơn nhé)" };
  }

  const { error } = await supabase.rpc("craft_mask", {
    p_user: uid,
    p_mask: maskId,
    p_gold_cost: recipe.goldCost,
    p_durability_cap: recipe.durabilityCap,
    p_ingredients: {},
  });
  if (error) return { ok: false, error: safeRpcError(error) ?? "Không thực hiện được" };
  return { ok: true };
}
