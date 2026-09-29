// KHÔNG "use server" directive — module này chỉ được gọi từ server action
// (friends.ts), export const VISIT_SAFE_KEYS (non-function) → nếu có directive
// Next.js báo "use server file can only export async functions, found object"
// (crash server-action compile). Server actions thường import service module.
import { createClient } from "@/lib/supabase/server";
import { checkRateLimitDb } from "@/lib/social/db-rate-limit";
import { logVisitService } from "@/lib/social/social-service";

/**
 * Visit friend (phase 5 F5.5/F5.7). Read-only farm safe keys — KHÔNG leak
 * Inventory/gold/gameMeta.energy. Rate-limit 10/min per visitor.
 * W4: + placedDecor (decor đã sanitize — VISIT render) + ghi VisitLog "visit".
 */

/** Safe keys projection — tuyệt đối không trả Inventory/gold/energy. */
// W4 audit-fix: + pondFish (vô hại — chỉ fishId/daysGrown, plan W4 ghi "pondFish vô hại, thêm được").
export const VISIT_SAFE_KEYS = ["terrain", "crops", "objects", "forage", "placedDecor", "pondFish"] as const;

function sortPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/**
 * visitFriend(friendId) — verify friendship accepted, rồi trả Farm safe keys.
 * Return farm nếu ok, else { ok:false, error }.
 */
export async function visitFriendService(
  friendId: string,
): Promise<{ ok: boolean; farm?: { terrain: unknown; crops: unknown; objects: unknown }; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthorized" };
  if (!(await checkRateLimitDb(user.id, "visit").catch(() => false))) {
    return { ok: false, error: "rate-limited: quá 10 lần/phút" };
  }

  const [a, b] = sortPair(user.id, friendId);
  const { data: friend } = await supabase
    .from("Friendship")
    .select("id")
    .eq("userAId", a)
    .eq("userBId", b)
    .eq("status", "accepted")
    .maybeSingle();
  if (!friend) return { ok: false, error: "forbidden: không phải bạn" };

  const { data: farm, error: farmErr } = await supabase.rpc("visit_friend_farm", {
    p_owner: friendId,
  });
  if (farmErr) return { ok: false, error: farmErr.message };
  if (!farm) return { ok: false, error: "farm không tồn tại" };
  // W4: ghi VisitLog "visit" — fail im lặng (log không chặn visit experience).
  await logVisitService(friendId);
  return { ok: true, farm: farm as unknown as { terrain: unknown; crops: unknown; objects: unknown; placedDecor?: unknown; pondFish?: unknown } };
}
