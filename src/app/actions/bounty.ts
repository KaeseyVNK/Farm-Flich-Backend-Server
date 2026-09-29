"use server";

import { createClient } from "@/lib/supabase/server";
import { safeRpcError } from "@/lib/social/safe-errors";

/**
 * W7d-P3: Bảng truy nã (§14). Bounty — gold cloud trừ NGAY khi đặt / hoàn khi hủy
 * (RPC atomic, KHÔNG escrow). Top thief 7 ngày qua RaidSession resolved winner=thief
 * (RPC security definer — RaidSession RLS owner/thief-only).
 * Quest trả đũa MVP display-only: đọc RaidSession mình bị trộm (RLS cho phép).
 */

export interface TopThief {
  thiefId: string;
  name: string;
  escapes: number;
  bountyGold: number;
}

export interface BountyRow {
  id: string;
  ownerId: string;
  thiefId: string;
  gold: number;
  status: string;
  createdAt: string;
}

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthorized: chưa đăng nhập");
  return user.id;
}

/** Top thief thoát thành công 7 ngày qua + tổng bounty active (board công khai). */
export async function topThievesAction(): Promise<TopThief[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("top_thieves_7d");
  if (error) return [];
  return (data ?? []) as TopThief[];
}

/** Bounty active (board) — public RLS. */
export async function loadBountiesAction(): Promise<BountyRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("Bounty")
    .select("id, ownerId, thiefId, gold, status, createdAt")
    .eq("status", "active")
    .order("gold", { ascending: false })
    .limit(50);
  return (data ?? []) as BountyRow[];
}

/** Treo thưởng — RPC atomic trừ gold cloud ngay (50-5000, chặn trùng active). */
export async function placeBountyAction(thiefId: string, gold: number): Promise<{ ok: boolean; error?: string }> {
  if (!Number.isInteger(gold) || gold < 50 || gold > 5000) {
    return { ok: false, error: "Số vàng treo thưởng 50-5000" };
  }
  const uid = await requireUserId();
  const supabase = await createClient();
  const { error } = await supabase.rpc("place_bounty", {
    p_owner: uid,
    p_thief: thiefId,
    p_gold: gold,
  });
  if (error) return { ok: false, error: safeRpcError(error) ?? "Không thực hiện được" };
  return { ok: true };
}

/** Hủy thưởng — RPC hoàn đủ gold. */
export async function cancelBountyAction(bountyId: string): Promise<{ ok: boolean; error?: string }> {
  const uid = await requireUserId();
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_bounty", {
    p_owner: uid,
    p_bounty_id: bountyId,
  });
  if (error) return { ok: false, error: safeRpcError(error) ?? "Không thực hiện được" };
  return { ok: true };
}

/**
 * Quest trả đũa (MVP display-only, §14): thief đã trộm MÌNH + thoát thành công
 * trong 7 ngày — hiển thị "Truy lại {thief}". RaidSession RLS cho owner select.
 */
export interface RevengeTarget {
  thiefId: string;
  lastAt: string;
  times: number;
}

export async function revengeTargetsAction(): Promise<RevengeTarget[]> {
  const uid = await requireUserId();
  const supabase = await createClient();
  const { data } = await supabase
    .from("RaidSession")
    .select("thiefId, endedAt")
    .eq("ownerId", uid)
    .eq("status", "resolved")
    .gt("endedAt", new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString())
    .contains("resultJson", { winner: "thief" });
  const rows = (data ?? []) as { thiefId: string; endedAt: string }[];
  const byThief = new Map<string, { lastAt: string; times: number }>();
  for (const r of rows) {
    const cur = byThief.get(r.thiefId);
    byThief.set(r.thiefId, {
      lastAt: cur && cur.lastAt > r.endedAt ? cur.lastAt : r.endedAt,
      times: (cur?.times ?? 0) + 1,
    });
  }
  return [...byThief.entries()].map(([thiefId, v]) => ({ thiefId, ...v }));
}
