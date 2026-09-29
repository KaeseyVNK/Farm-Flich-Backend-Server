// W4 — farm-visit social service (like/sticker/guestbook/visitors).
// KHÔNG "use server" — module gọi từ server action (pattern visit-service).
// Rules pure nằm social-rules (unit-test); layer này bọc Supabase + auth + RLS.
// Rate-limit DB-backed (review F6) qua db-rate-limit.
import { createClient } from "@/lib/supabase/server";
import { checkRateLimitDb } from "@/lib/social/db-rate-limit";
import { safeRpcError } from "@/lib/social/safe-errors";
import {
  isStickerId,
  sanitizeGuestbookMessage,
  dayKey,
  type VisitLogKind,
} from "@/lib/social/social-rules";

function sortPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

type Client = Awaited<ReturnType<typeof createClient>>;

async function currentUser(client: Client) {
  const { data } = await client.auth.getUser();
  return data.user;
}

/** Bạn đã accepted? (concept §4 — chỉ bạn được ghé thăm/like/nhắn). */
async function isFriend(client: Client, uid: string, otherId: string): Promise<boolean> {
  if (uid === otherId) return false; // không tự like farm mình
  const [a, b] = sortPair(uid, otherId);
  const { data } = await client
    .from("Friendship")
    .select("id")
    .eq("userAId", a)
    .eq("userBId", b)
    .eq("status", "accepted")
    .maybeSingle();
  return !!data;
}

async function logVisit(
  client: Client,
  farmOwnerId: string,
  visitorId: string,
  kind: VisitLogKind,
  extra: { stickerId?: string; message?: string } = {},
): Promise<boolean> {
  // Review W4: phải surface lỗi insert (trước đây im lặng — UI báo "Đã nhắn!"
  // trong khi DB reject). Visit-log (kind visit) vẫn fail-im lặng ở caller.
  const { error } = await client.from("VisitLog").insert({
    farmOwnerId,
    visitorId,
    kind,
    stickerId: extra.stickerId ?? null,
    message: extra.message ?? null,
    day: dayKey(),
  });
  return !error;
}

/** Log lượt ghé (gọi sau visitFriendService thành công — fail không chặn visit). */
export async function logVisitService(farmOwnerId: string): Promise<void> {
  const client = await createClient();
  const user = await currentUser(client);
  if (!user) return;
  void (await logVisit(client, farmOwnerId, user.id, "visit"));
}

export interface LikeResult {
  ok: boolean;
  liked?: boolean; // true = like MỚI ghi; false = đã like hôm nay (idempotent)
  totalLikes?: number;
  error?: string;
}

/** Like farm bạn — 1/user/farm/ngày (unique index chặn; upsert idempotent). */
export async function likeFarmService(farmOwnerId: string): Promise<LikeResult> {
  const client = await createClient();
  const user = await currentUser(client);
  if (!user) return { ok: false, error: "unauthorized" };
  if (!(await isFriend(client, user.id, farmOwnerId))) {
    return { ok: false, error: "forbidden: không phải bạn" };
  }
  const day = dayKey();
  // Pre-check đã like hôm nay → idempotent KHÔNG ghi thêm VisitLog (spam log nếu
  // client retry / double-click).
  const { data: mine } = await client
    .from("FarmLike")
    .select("id")
    .eq("farmOwnerId", farmOwnerId)
    .eq("visitorId", user.id)
    .eq("day", day)
    .maybeSingle();
  if (mine) {
    const { count } = await client
      .from("FarmLike")
      .select("id", { count: "exact", head: true })
      .eq("farmOwnerId", farmOwnerId);
    return { ok: true, liked: false, totalLikes: count ?? 0 };
  }
  const { error } = await client.from("FarmLike").upsert(
    { farmOwnerId, visitorId: user.id, day },
    // PostgREST on_conflict: comma-separated COLUMN LIST — không phải index name.
    { onConflict: "farmOwnerId,visitorId,day", ignoreDuplicates: true },
  );
  if (error) return { ok: false, error: safeRpcError(error, "likeFarm") ?? "Không like được" };
  const { count } = await client
    .from("FarmLike")
    .select("id", { count: "exact", head: true })
    .eq("farmOwnerId", farmOwnerId);
  void (await logVisit(client, farmOwnerId, user.id, "like"));
  return { ok: true, liked: true, totalLikes: count ?? 0 };
}

/** Gửi sticker (12 id whitelist — social-rules). Rate-limit chung visit 10/min. */
export async function sendStickerService(
  farmOwnerId: string,
  stickerId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!isStickerId(stickerId)) return { ok: false, error: "sticker lạ" };
  const client = await createClient();
  const user = await currentUser(client);
  if (!user) return { ok: false, error: "unauthorized" };
  if (!(await checkRateLimitDb(user.id, "sticker").catch(() => false))) {
    return { ok: false, error: "rate-limited" };
  }
  if (!(await isFriend(client, user.id, farmOwnerId))) {
    return { ok: false, error: "forbidden: không phải bạn" };
  }
  const ok = await logVisit(client, farmOwnerId, user.id, "sticker", { stickerId });
  return ok ? { ok: true } : { ok: false, error: "không ghi được sticker" };
}

export interface GuestbookEntry {
  id: string;
  visitorId: string;
  message: string;
  createdAt: string;
}

/** Viết guestbook — sanitize 200 ký tự, rate 3/phút, friend-only. */
export async function writeGuestbookService(
  farmOwnerId: string,
  rawMessage: string,
): Promise<{ ok: boolean; error?: string }> {
  const message = sanitizeGuestbookMessage(rawMessage);
  if (!message) return { ok: false, error: "lời nhắn trống" };
  const client = await createClient();
  const user = await currentUser(client);
  if (!user) return { ok: false, error: "unauthorized" };
  if (!(await checkRateLimitDb(user.id, "guestbook").catch(() => false))) {
    return { ok: false, error: "rate-limited: 3 tin/phút" };
  }
  if (!(await isFriend(client, user.id, farmOwnerId))) {
    return { ok: false, error: "forbidden: không phải bạn" };
  }
  const ok = await logVisit(client, farmOwnerId, user.id, "guestbook", { message });
  return ok ? { ok: true } : { ok: false, error: "không ghi được lời nhắn" };
}

export interface VisitSocialView {
  likes: number;
  likedByMe: boolean; // hôm nay
  guestbook: GuestbookEntry[];
}

/** Visitor đọc social của farm đang thăm (RLS: friend SELECT được). */
export async function getVisitSocialService(farmOwnerId: string): Promise<VisitSocialView | { ok: false; error: string }> {
  const client = await createClient();
  const user = await currentUser(client);
  if (!user) return { ok: false, error: "unauthorized" };
  const day = dayKey();
  const [likeCountRes, mineRes, gbRes] = await Promise.all([
    client.from("FarmLike").select("id", { count: "exact", head: true }).eq("farmOwnerId", farmOwnerId),
    client.from("FarmLike").select("id").eq("farmOwnerId", farmOwnerId).eq("visitorId", user.id).eq("day", day).maybeSingle(),
    client
      .from("VisitLog")
      .select("id, visitorId, message, createdAt")
      .eq("farmOwnerId", farmOwnerId)
      .eq("kind", "guestbook")
      .order("createdAt", { ascending: false })
      .limit(10),
  ]);
  const gb = (gbRes.data ?? []) as { id: string; visitorId: string; message: string | null; createdAt: string }[];
  return {
    likes: likeCountRes.count ?? 0,
    likedByMe: !!mineRes.data,
    guestbook: gb.filter((g) => g.message).map((g) => ({ id: g.id, visitorId: g.visitorId, message: g.message as string, createdAt: g.createdAt })),
  };
}

export interface VisitorSummary {
  likesTotal: number;
  likesToday: number;
  visitsTotal: number;
  stickerTally: { stickerId: string; count: number }[];
  guestbook: (GuestbookEntry & { visitorName?: string | null })[];
  visitorNames: Record<string, string | null>;
}

/** Chủ farm đọc tổng quan (panel Khách thăm). Polling 30s — KHÔNG realtime. */
export async function listVisitorsService(): Promise<VisitorSummary | { ok: false; error: string }> {
  const client = await createClient();
  const user = await currentUser(client);
  if (!user) return { ok: false, error: "unauthorized" };
  const uid = user.id;
  const [likesAll, likesToday, visits, stickers, gb] = await Promise.all([
    client.from("FarmLike").select("id", { count: "exact", head: true }).eq("farmOwnerId", uid),
    client.from("FarmLike").select("id", { count: "exact", head: true }).eq("farmOwnerId", uid).eq("day", dayKey()),
    client.from("VisitLog").select("id", { count: "exact", head: true }).eq("farmOwnerId", uid).eq("kind", "visit"),
    client.from("VisitLog").select("stickerId").eq("farmOwnerId", uid).eq("kind", "sticker"),
    client
      .from("VisitLog")
      .select("id, visitorId, message, createdAt")
      .eq("farmOwnerId", uid)
      .eq("kind", "guestbook")
      .order("createdAt", { ascending: false })
      .limit(50),
  ]);
  const tally = new Map<string, number>();
  for (const row of (stickers.data ?? []) as { stickerId: string | null }[]) {
    if (row.stickerId) tally.set(row.stickerId, (tally.get(row.stickerId) ?? 0) + 1);
  }
  const gbRows = (gb.data ?? []) as { id: string; visitorId: string; message: string | null; createdAt: string }[];
  const ids = [...new Set(gbRows.map((g) => g.visitorId))];
  const nameMap: Record<string, string | null> = {};
  if (ids.length > 0) {
    const { data: users } = await client.from("user_public").select("id, displayName").in("id", ids);
    for (const u of (users ?? []) as { id: string; displayName: string | null }[]) nameMap[u.id] = u.displayName;
  }
  return {
    likesTotal: likesAll.count ?? 0,
    likesToday: likesToday.count ?? 0,
    visitsTotal: visits.count ?? 0,
    stickerTally: [...tally.entries()].map(([stickerId, count]) => ({ stickerId, count })).sort((a, b) => b.count - a.count),
    guestbook: gbRows
      .filter((g) => g.message)
      .map((g) => ({ id: g.id, visitorId: g.visitorId, message: g.message as string, createdAt: g.createdAt, visitorName: nameMap[g.visitorId] })),
    visitorNames: nameMap,
  };
}
