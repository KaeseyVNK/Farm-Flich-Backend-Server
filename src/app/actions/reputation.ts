"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * W7d-P1: Reputation server actions (§14).
 * Write chỉ qua RPC (bump_reputation / bump_farmer_reputation — security definer,
 * RLS không cho client ghi trực tiếp). Thief/guard bump xảy ra server-side trong
 * finalize_raid; farmer bump hook ở client action ship/order.
 */

export interface ReputationData {
  farmer: number;
  thief: number;
  guard: number;
}

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthorized: chưa đăng nhập");
  return user.id;
}

/** Đọc reputation của user hiện tại (chưa có row → 0/0/0). */
export async function getReputationAction(): Promise<ReputationData> {
  const uid = await requireUserId();
  const supabase = await createClient();
  const { data } = await supabase
    .from("Reputation")
    .select("farmer, thief, guard")
    .eq("userId", uid)
    .maybeSingle();
  const row = data as { farmer?: number; thief?: number; guard?: number } | null;
  return {
    farmer: row?.farmer ?? 0,
    thief: row?.thief ?? 0,
    guard: row?.guard ?? 0,
  };
}

/**
 * Farmer +delta (ship +1 / order +2 — caller quyết). RPC clamp 1-5 + GREATEST 0.
 * Fire-and-forget: fail im lặng (offline ≠ chặn gameplay local-first).
 */
export async function bumpFarmerAction(delta: number): Promise<void> {
  try {
    const uid = await requireUserId();
    const supabase = await createClient();
    await supabase.rpc("bump_farmer_reputation", { p_user: uid, p_delta: delta });
  } catch {
    // offline / chưa auth — bỏ qua (rep là bonus server-side, không chặn chơi)
  }
}
