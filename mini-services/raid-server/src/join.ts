import { supabase } from "./supabase.js";
import { checkOwnerPresenceOnce } from "./lockdown-presence.js";
import { checkJoinRateLimit } from "./rate-limit.js";
import { canRaidFarm } from "./daily-raid-cap.js";
import { isBloodMoon, currentUtcDayKey } from "./blood-moon.js";
import { isFarmNewbieProtected } from "./newbie-immunity.js";
import { GUARD_REP_VISION_BONUS_AT } from "./constants.js";

export { resetJoinRateLimit, checkJoinRateLimit } from "./rate-limit.js";

export interface JoinInput {
  farmId: string;
  thiefId: string;
  maskId: string;
  mapId?: string;
}

export interface JoinResult {
  ok: boolean;
  sessionId?: string;
  ownerId?: string;
  maskId?: string; // SERVER-RESOLVED từ Mask equipped (F4.5 anti-spoof)
  /** Phase 7 blood-moon raid — server-read (không client flag). */
  bloodMoon?: boolean;
  /** W7d-P1: owner guard-rep ≥ 50 → dog vision +1 tile (persist session cho replay). */
  guardBonus?: boolean;
  reason?: string;
}

/**
 * Atomic join (red-team #2/#16, audit H6).
 * Gate (DB-authoritative, KHÔNG presence):
 * 1. Rate-limit join per user (audit M10)
 * 2. Farm có tồn tại + shield hết hạn + daily raid-cap chưa đạt
 * 3. Owner farmStatus ∈ {away, offline} (audit M5)
 * 4. Thief có mask durability > 0 (concept §6)
 * 5. Atomic INSERT RaidSession status='active' — partial unique index (audit M1) chặn 2 raider.
 *
 * Test runtime cần Supabase project. Logic ở đây.
 */
export async function tryJoin({ farmId, thiefId, mapId }: JoinInput): Promise<JoinResult> {
  // 0. Rate-limit join (audit M10) — tránh scan farm hàng loạt.
  if (!checkJoinRateLimit(thiefId)) return { ok: false, reason: "rate_limited" };

  // 1. Load farm + check shield/daily-cap. (gameMeta không còn dùng — blood-moon
  //    theo UTC date, review H3b.)
  const { data: farm, error: fErr } = await supabase
    .from("Farm")
    .select("id, ownerId, shieldUntil, dailyRaidCount, dailyRaidResetAt, createdAt")
    .eq("id", farmId)
    .maybeSingle();
  if (fErr || !farm) return { ok: false, reason: "farm_not_found" };
  // Review H1: chặn tự raid farm mình — không có gate này owner mở /raid?farmId=<own>
  // tự farm rep thief (+3/exit), defense XP, trap trigger. Lobby đã exclude
  // (list_raidable_farms ownerId <> auth.uid) nhưng direct WS bypass được.
  if (farm.ownerId === thiefId) return { ok: false, reason: "own_farm" };
  const now = Date.now();
  if (farm.shieldUntil && new Date(farm.shieldUntil).getTime() > now)
    return { ok: false, reason: "shield_active" };
  // Daily raid cap với reset window 24h (giống finalize RPC). Trước đây chỉ so
  // raw `dailyRaidCount >= cap` — reset chỉ xảy ra khi có raid mới finalize, nên
  // farm đủ cap 1 ngày rồi không bị raid lại → reject farm mãi (stuck unraidable)
  // dù đã qua 24h. Helper chia sẻ logic với RPC.
  if (!canRaidFarm(farm.dailyRaidCount, farm.dailyRaidResetAt, now))
    return { ok: false, reason: "daily_cap" };
  // §13 newbie immunity — Farm.createdAt trong 3 ngày (server clock). Thiếu timestamp → protect.
  if (isFarmNewbieProtected((farm as { createdAt?: string | null }).createdAt))
    return { ok: false, reason: "farm_newbie" };

  // 2. Owner away/offline (audit M5) — check Realtime presence hint.
  //    Presence = HINT (gate chính vẫn là RaidSession partial index DB).
  //    Owner `playing` (GameCanvas mounted) → reject join.
  const ownerPresence = await checkOwnerPresenceOnce(supabase, farm.ownerId);
  if (ownerPresence === "playing") return { ok: false, reason: "owner_playing" };

  // 3. Mask — SERVER-RESOLVED maskId từ Mask equipped=true (F4.5 anti-spoof).
  // Ignore client maskId param. Query equipped mask + durability check.
  const { data: mask } = await supabase
    .from("Mask")
    .select("maskId, durability")
    .eq("userId", thiefId)
    .eq("equipped", true)
    .maybeSingle();
  if (!mask || mask.durability <= 0) return { ok: false, reason: "no_mask" };
  const serverMaskId = (mask as { maskId: string }).maskId;

  // 3b. Blood-moon (phase 7): server-authoritative. Review H3b: day = UTC
  // calendar date (server clock) — KHÔNG Farm.gameMeta.day nữa. gameMeta.day do
  // owner save ghi → owner ép day khớp collision → blood-moon vĩnh viễn (loot ×2).
  // UTC date không client-controllable. Persist bloodMoon trên RaidSession cho replay.
  const bloodMoon = isBloodMoon(currentUtcDayKey(now), farm.ownerId);

  // 4. Atomic INSERT RaidSession — partial unique index chặn dup active.
  //    Persist mapId + thiefMaskId cho replay re-sim (audit C6).
  //    Cung cấp id (Prisma cuid là client-side — REST không tự sinh).
  // W7d-P1: owner guard-rep ≥ 50 → dog vision +1 tile. Không có row = chưa có rep.
  const { data: repRow } = await supabase
    .from("Reputation")
    .select("guard")
    .eq("userId", farm.ownerId)
    .maybeSingle();
  const guardBonus = ((repRow as { guard?: number } | null)?.guard ?? 0) >= GUARD_REP_VISION_BONUS_AT;

  const { data: session, error: insErr } = await supabase
    .from("RaidSession")
    .insert({
      id: crypto.randomUUID(),
      farmId,
      ownerId: farm.ownerId,
      thiefId,
      status: "active",
      mapId: mapId ?? "farm",
      thiefMaskId: serverMaskId,
      bloodMoon,
      guardBonus,
      startedAt: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();
  if (insErr || !session) return { ok: false, reason: "raid_busy_or_error" };
  return { ok: true, sessionId: session.id, ownerId: farm.ownerId, maskId: serverMaskId, bloodMoon, guardBonus };
}
