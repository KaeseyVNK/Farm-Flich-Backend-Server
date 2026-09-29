"use server";

import { createClient } from "@/lib/supabase/server";
import { safeRpcError } from "@/lib/social/safe-errors";
import {
  isValidListingPrice,
  MAX_ACTIVE_LISTINGS,
  LISTING_TTL_DAYS,
} from "@/lib/game/npc-shop-prices";
import { getItem } from "@/lib/game/data";

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthorized: chưa đăng nhập");
  return user.id;
}

/** List item: deduct inventory + insert Listing atomic (RPC create_listing — audit C2). */
export async function listItemAction(
  itemId: string,
  qty: number,
  priceUnit: number,
): Promise<{ ok: boolean; error?: string }> {
  if (!Number.isInteger(qty) || qty <= 0) return { ok: false, error: "qty sai" };
  // Validate itemId tồn tại trong ITEMS — npc-shop-prices list một số item mask
  // (iron/cloth/gem/gold_ore) không có trong inventory system. Không validate →
  // tạo listing cho item không tồn tại (phantom economy entry).
  if (!getItem(itemId)) return { ok: false, error: "item không hợp lệ" };
  if (!isValidListingPrice(itemId, priceUnit)) {
    return { ok: false, error: `price ngoài band ±60% NPC` };
  }
  const uid = await requireUserId();
  const supabase = await createClient();
  // Fast-path pre-check cap (save 1 RPC round-trip khi đã đạt cap). RPC
  // create_listing re-enforce atomic (User FOR UPDATE + count) — đây chỉ early
  // reject, không phải enforcement duy nhất (anti-TOCTOU: 5 tab concurrent).
  const { count } = await supabase
    .from("Listing")
    .select("id", { count: "exact", head: true })
    .eq("sellerId", uid)
    .eq("status", "active");
  if ((count ?? 0) >= MAX_ACTIVE_LISTINGS) {
    return { ok: false, error: `cap ${MAX_ACTIVE_LISTINGS} listing` };
  }
  const expires = new Date(Date.now() + LISTING_TTL_DAYS * 86400_000).toISOString();
  const { error } = await supabase.rpc("create_listing", {
    p_seller: uid,
    p_item: itemId,
    p_qty: qty,
    p_price: priceUnit,
    p_expires: expires,
  });
  if (error) return { ok: false, error: safeRpcError(error) ?? "Không thực hiện được" };
  return { ok: true };
}

/** Buy listing (partial qty OK). RPC atomic. */
export async function buyAction(
  listingId: string,
  qty: number,
): Promise<{ ok: boolean; error?: string }> {
  const uid = await requireUserId();
  const supabase = await createClient();
  const { error } = await supabase.rpc("marketplace_buy", {
    p_buyer: uid,
    p_listing: listingId,
    p_qty: qty,
  });
  if (error) return { ok: false, error: safeRpcError(error) ?? "Không thực hiện được" };
  return { ok: true };
}

/** Cancel listing — refund + status cancelled atomic (RPC cancel_listing — audit C2). */
export async function cancelListingAction(listingId: string): Promise<{ ok: boolean; error?: string }> {
  const uid = await requireUserId();
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_listing", {
    p_listing: listingId,
    p_user: uid,
  });
  if (error) return { ok: false, error: safeRpcError(error) ?? "Không thực hiện được" };
  return { ok: true };
}

/** Browse active listings (filter + sort price asc). */
export async function browseAction(itemId?: string): Promise<
  { id: string; sellerId: string; itemId: string; qty: number; priceUnit: number }[]
> {
  const supabase = await createClient();
  let q = supabase
    .from("Listing")
    .select("id, sellerId, itemId, qty, priceUnit")
    .eq("status", "active")
    .gt("expiresAt", new Date().toISOString())
    .order("priceUnit", { ascending: true });
  if (itemId) q = q.eq("itemId", itemId);
  const { data } = await q;
  return (data ?? []) as { id: string; sellerId: string; itemId: string; qty: number; priceUnit: number }[];
}

/** My listings (active + expired/cancelled/sold) — trang /market/my (phase 6 F6.6). */
export async function myListingsAction(): Promise<
  {
    id: string;
    itemId: string;
    qty: number;
    priceUnit: number;
    status: string;
    expiresAt: string;
  }[]
> {
  const uid = await requireUserId();
  const supabase = await createClient();
  const { data } = await supabase
    .from("Listing")
    .select("id, itemId, qty, priceUnit, status, expiresAt")
    .eq("sellerId", uid)
    .order("createdAt", { ascending: false })
    .limit(50);
  return (data ?? []) as {
    id: string;
    itemId: string;
    qty: number;
    priceUnit: number;
    status: string;
    expiresAt: string;
  }[];
}
