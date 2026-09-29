"use server";

import { createClient } from "@/lib/supabase/server";
import { safeRpcError } from "@/lib/social/safe-errors";
import { isGiftable } from "@/lib/social/gift-allowlist";
import { visitFriendService } from "@/lib/social/visit-service";
import {
  likeFarmService,
  sendStickerService,
  writeGuestbookService,
  getVisitSocialService,
  listVisitorsService,
} from "@/lib/social/social-service";

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthorized: chưa đăng nhập");
  return user.id;
}

/** Canonical A<B. Trả [a, b] sorted. */
function sortPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/** Gửi lời mời kết bạn. Idempotent (ON CONFLICT DO NOTHING). Không regress accepted (audit H6). */
export async function sendRequestAction(toId: string): Promise<{ ok: boolean; error?: string }> {
  const uid = await requireUserId();
  if (uid === toId) return { ok: false, error: "không kết bạn chính mình" };
  const supabase = await createClient();
  const [a, b] = sortPair(uid, toId);
  // Pre-check: đã accepted → KHÔNG regress về pending (audit H6).
  const { data: existing } = await supabase
    .from("Friendship")
    .select("status")
    .eq("userAId", a)
    .eq("userBId", b)
    .maybeSingle();
  if ((existing as { status?: string } | null)?.status === "accepted") {
    return { ok: false, error: "đã là bạn" };
  }
  const { error } = await supabase.from("Friendship").upsert(
    { userAId: a, userBId: b, status: "pending", initiatorId: uid },
    // W4 review: PostgREST on_conflict là column list comma-separated, không phải
    // index name ("userAId_userBId" → 400 "Could not find the column").
    { onConflict: "userAId,userBId" },
  );
  if (error) return { ok: false, error: safeRpcError(error) ?? "Không thực hiện được" };
  return { ok: true };
}

/** Chấp nhận lời mời. Review 3a/3b: surface lỗi + chặn initiator tự accept. */
export async function acceptRequestAction(friendId: string): Promise<{ ok: boolean; error?: string }> {
  const uid = await requireUserId();
  const supabase = await createClient();
  const [a, b] = sortPair(uid, friendId);
  const { data, error } = await supabase
    .from("Friendship")
    .update({ status: "accepted", acceptedAt: new Date().toISOString() })
    .eq("userAId", a)
    .eq("userBId", b)
    .eq("status", "pending")
    // Initiator không tự accept request của chính mình (chỉ receiver được accept).
    .neq("initiatorId", uid)
    .select("id");
  if (error) return { ok: false, error: safeRpcError(error) ?? "Không thực hiện được" };
  if (!data || data.length === 0) return { ok: false, error: "không có lời mời đang chờ" };
  return { ok: true };
}

/** Từ chối/xóa. */
export async function declineRequestAction(friendId: string): Promise<{ ok: boolean; error?: string }> {
  const uid = await requireUserId();
  const supabase = await createClient();
  const [a, b] = sortPair(uid, friendId);
  const { error } = await supabase.from("Friendship").delete().eq("userAId", a).eq("userBId", b);
  if (error) return { ok: false, error: safeRpcError(error) ?? "Không thực hiện được" };
  return { ok: true };
}

/** List bạn bè đã accepted. */
export async function listFriendsAction(): Promise<{ id: string; displayName: string | null }[]> {
  const uid = await requireUserId();
  const supabase = await createClient();
  const { data } = await supabase
    .from("Friendship")
    .select("userAId, userBId")
    .eq("status", "accepted")
    .or(`userAId.eq.${uid},userBId.eq.${uid}`);
  const rows = (data ?? []) as { userAId: string; userBId: string }[];
  const friendIds = rows.map((r) => (r.userAId === uid ? r.userBId : r.userAId));
  if (friendIds.length === 0) return [];
  const { data: users } = await supabase
    .from("user_public")
    .select("id, displayName")
    .in("id", friendIds);
  return (users ?? []) as { id: string; displayName: string | null }[];
}

/** Gift item (phase 5). RPC atomic gift_item. */
export async function giftItemAction(
  toId: string,
  itemId: string,
  qty: number,
): Promise<{ ok: boolean; error?: string }> {
  if (!isGiftable(itemId)) return { ok: false, error: "item không gift được" };
  if (!Number.isInteger(qty) || qty <= 0) return { ok: false, error: "qty sai" };
  const uid = await requireUserId();
  const supabase = await createClient();
  const { error } = await supabase.rpc("gift_item", {
    p_from: uid,
    p_to: toId,
    p_item: itemId,
    p_qty: qty,
  });
  if (error) return { ok: false, error: safeRpcError(error) ?? "Không thực hiện được" };
  return { ok: true };
}

/** Visit friend — read-only farm safe keys (no Inventory/gold/energy) + rate-limit 10/min (F5.7). */
export async function visitFriendAction(
  friendId: string,
): Promise<{ ok: boolean; farm?: { terrain: unknown; crops: unknown; objects: unknown; placedDecor?: unknown; pondFish?: unknown }; error?: string }> {
  return visitFriendService(friendId);
}

// ── W4 farm-visit social (concept §14: like / sticker / guestbook) ──────────

/** Like farm bạn (1/user/farm/ngày — unique index; idempotent). */
export async function likeFarmAction(farmOwnerId: string) {
  return likeFarmService(farmOwnerId);
}

/** Gửi sticker (12 whitelist ids). */
export async function sendStickerAction(farmOwnerId: string, stickerId: string) {
  return sendStickerService(farmOwnerId, stickerId);
}

/** Viết guestbook (sanitize ≤200 ký tự, rate 3/phút). */
export async function writeGuestbookAction(farmOwnerId: string, message: string) {
  return writeGuestbookService(farmOwnerId, message);
}

/** Visitor đọc social farm đang thăm (likes/likedByMe/guestbook 10). */
export async function getVisitSocialAction(farmOwnerId: string) {
  return getVisitSocialService(farmOwnerId);
}

/** Chủ farm đọc tổng quan Khách thăm (polling 30s). */
export async function listVisitorsAction() {
  return listVisitorsService();
}
