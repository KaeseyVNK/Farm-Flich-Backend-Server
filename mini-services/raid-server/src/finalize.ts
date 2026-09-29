import { supabase } from "./supabase.js";
import { PER_RAID_CAP_PCT, PER_DAY_CAP_PCT } from "./loss-cap.js";
import { isKetItem } from "./loot-tables.js";
import { computeShieldUntil } from "./shield.js";
import { computeDefenseXp, DEFENSE_XP_CAP_PER_DAY } from "./defense-xp.js";
import { DAILY_RAID_CAP, ALERT_ALARM } from "./constants.js";
import type { RaidEventRow } from "./replay-types.js";

export interface FinalizeInput {
  sessionId: string;
  farmId: string;
  ownerId: string;
  thiefId: string;
  reason: "exit" | "caught" | "timeout";
  lootTemp: { itemId: string; qty: number }[];
  replayEvents: RaidEventRow[];
  lootCapBonus?: number; // bandit mask +10% (phase 4)
  /** Loot loop đã chạy xong lần trước → KHÔNG re-run (chặn item dup khi retry).
   *  finalize_raid RPC idempotent (WHERE status='active' guard) nhưng loot loop
   *  ngoài RPC KHÔNG idempotent → retry re-run = double add_inventory. */
  lootAlreadyApplied?: boolean;
}

export interface FinalizeResult {
  keptLoot: { itemId: string; qty: number }[];
  lostLoot: { itemId: string; qty: number }[];
  shieldUntil: string;
  defenseXpGranted: boolean;
}

// Re-export từ module riêng (không kéo supabase side-effect khi test import class).
// Import thêm cho scope nội bộ — `export {X} from` KHÔNG đưa X vào scope (pre-existing TS error).
import { FinalizePhase1Error } from "./finalize-errors.js";
export { FinalizePhase1Error };

/**
 * Finalize raid (concept §12/§13, red-team #1/#8).
 * 2 phase: (a) pure logic tính stealable/defenseXp client-side (đã test),
 * (b) 1 RPC atomic `finalize_raid` áp dụng tất cả thay đổi DB trong 1 transaction.
 *
 * RPC thực hiện: set shield, bump daily count, mask durability, defense XP, RaidSession resolved.
 * Loot per-item: tuần tự (mỗi item deduct victim atomic + add thief) — loss-cap check client trước.
 */
export async function finalizeRaid(input: FinalizeInput): Promise<FinalizeResult> {
  const { sessionId, farmId, ownerId, thiefId, reason, lootTemp, replayEvents } = input;
  const perRaidPct = PER_RAID_CAP_PCT + (input.lootCapBonus ?? 0);
  const keptLoot: { itemId: string; qty: number }[] = [];
  const lostLoot: { itemId: string; qty: number }[] = [];

  // BƯỚC 1 — Atomic resolve session TRƯỚC (shield + daily count + mask + XP).
  // Toàn bộ pre-RPC (mask fetch + compute + RPC call) bọc try/catch: mọi throw
  // trước BƯỚC 2 (loot loop) = phase 1 → FinalizePhase1Error → caller KHÔNG set
  // lootApplied → retry loot bình thường. Trước đây chỉ wrap RPC return-error;
  // throw từ mask fetch / compute / network-level throw của supabase.rpc = generic
  // Error → misclassify phase 2 → lootApplied=true → thief mất toàn bộ loot silent
  // dù session resolved OK + exit hợp lệ. Đảo thứ tự resolve-trước-loot-sau: nếu
  // loot fail mid-loop chỉ mất partial loot (recoverable), không stuck farm (partial
  // unique index RaidSession_single_active_per_farm sẽ chặn nếu session vẫn active).
  const shieldUntil = computeShieldUntil("afterRaid").toISOString();
  const tickScores = replayEvents
    .filter((e) => e.type === "tick")
    .map((e) => (e.payload as { score?: number }).score ?? 0);
  const peakScore = tickScores.length ? Math.max(...tickScores) : 0;
  const lootValue = lootTemp.reduce((s, l) => s + l.qty, 0);
  const defenseXpAmount = computeDefenseXp(replayEvents, ownerId, {
    reachedAlarm: peakScore >= ALERT_ALARM,
    caught: reason === "caught",
    lootValue,
  });

  try {
    // F4.6 anti-spoof: maskId SERVER-RESOLVED từ Mask equipped (KHÔNG từ client input).
    const { data: maskRow } = await supabase
      .from("Mask")
      .select("maskId")
      .eq("userId", thiefId)
      .eq("equipped", true)
      .maybeSingle();
    const maskId = (maskRow as { maskId?: string } | null)?.maskId ?? "rogue";

    const { error: resolveErr } = await supabase.rpc("finalize_raid", {
      p_session: sessionId,
      p_farm: farmId,
      p_owner: ownerId,
      p_thief: thiefId,
      p_mask: maskId,
      p_shield_until: shieldUntil,
      p_defense_xp: defenseXpAmount,
      p_reason: reason,
      p_result: { reason, keptLoot: [], winner: reason === "exit" ? "thief" : "owner" },
      p_daily_cap: DAILY_RAID_CAP,
      p_defense_xp_daily_cap: DEFENSE_XP_CAP_PER_DAY,
    });
    if (resolveErr) throw resolveErr; // RPC return-error — phase 1, loot chưa chạy.
  } catch (e) {
    // Mọi throw trước BƯỚC 2 (mask fetch, compute, RPC network/return) = phase 1.
    // KHÔNG nuốt — caller (index.ts) phân biệt instanceof → KHÔNG set lootApplied
    // → retry loot bình thường. Nuốt = farm stuck active vĩnh viễn + loot lost.
    if (e instanceof FinalizePhase1Error) throw e;
    throw new FinalizePhase1Error(e);
  }

  // BƯỚC 2 — Loot per-item SAU khi session đã resolved (chỉ exit giữ loot).
  // Atomic steal_with_loss_cap RPC: FOR UPDATE lock trên RaidLossDaily serialize
  // concurrent raids cùng victim+ngày → cap 25% không bypass.
  // Skip khi lootAlreadyApplied: retry finalize_raid (RPC idempotent) nhưng loot
  // loop ngoài RPC KHÔNG idempotent → re-run = double add_inventory (item dup).
  if (reason === "exit" && !input.lootAlreadyApplied) {
    for (const item of lootTemp) {
      // Ket items = 0% steal (concept §7, kept in safe chest — exclude khỏi steal pool).
      if (isKetItem(item.itemId)) continue;
      const { data: vRow } = await supabase
        .from("Inventory")
        .select("qty")
        .eq("userId", ownerId)
        .eq("itemId", item.itemId)
        .maybeSingle();
      const pool = (vRow as { qty?: number } | null)?.qty ?? 0;

      const { data: stealable, error: stealErr } = await supabase.rpc("steal_with_loss_cap", {
        p_owner: ownerId,
        p_item: item.itemId,
        p_requested: item.qty,
        p_pool: pool,
        p_per_raid_pct: perRaidPct,
        p_per_day_pct: PER_DAY_CAP_PCT,
      });
      if (stealErr || stealable == null || stealable <= 0) continue;
      // Thêm loot cho thief — atomic increment (KHÔNG overwrite — audit C3).
      const { error: addErr } = await supabase.rpc("add_inventory", {
        p_user: thiefId,
        p_item: item.itemId,
        p_delta: stealable,
      });
      if (addErr) {
        // steal_with_loss_cap đã deduct victim + bump RaidLossDaily NHƯNG add_inventory
        // fail (network/5xx) → item evaporate khỏi economy (victim mất, thief không có).
        // Log vào lostLoot để admin reconcile thủ công — KHÔNG silent. Throw vẫn giữ
        // lootApplied=true ở caller (dup nghiêm trọng hơn lost, đã document trade-off).
        lostLoot.push({ itemId: item.itemId, qty: stealable });
        // Review #8: flush partial resultJson NGAY trước throw — crash/retry sau
        // đó không mất audit trail của các item đã transfer thành công.
        await supabase
          .from("RaidSession")
          .update({ resultJson: { reason, keptLoot, lostLoot, winner: "thief" } })
          .eq("id", sessionId);
        throw addErr;
      }
      keptLoot.push({ itemId: item.itemId, qty: stealable });
      // Review #8: persist incremental mỗi item — crash giữa loop giữ những item
      // đã transfer trong resultJson (trước đây chỉ ghi 1 lần cuối → crash = []).
      await supabase
        .from("RaidSession")
        .update({ resultJson: { reason, keptLoot, lostLoot, winner: "thief" } })
        .eq("id", sessionId);
    }
  }

  return { keptLoot, lostLoot, shieldUntil, defenseXpGranted: defenseXpAmount > 0 };
}
