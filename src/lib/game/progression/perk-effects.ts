// Perk effect readers (phase 6 wire). Đọc perk allocation từ store để áp modifier
// vào action logic. Khác StatModel module-level stack: state này persist qua save
// (progressionStore.perkAllocations) → không drift khi reload.
// ADR-017: perks apply modifiers — helper này là single source để đọc level.
import { useProgressionStore, type PerkAllocations } from "@/store/progressionStore";
import { PERKS } from "@/lib/game/progression/perks";
import { useReputationStore } from "@/store/reputationStore";
import { REPUTATION_EFFECTS } from "@/lib/raid/constants";

/** Perk level trong một tree (0 = chưa allocate). */
export function perkLevel(tree: keyof PerkAllocations): number {
  return useProgressionStore.getState().perkAllocations[tree] ?? 0;
}

/** Có perk cụ thể (theo rank) hay không. */
export function hasPerk(tree: keyof PerkAllocations, rank: number): boolean {
  return perkLevel(tree) >= rank;
}

/** Perk detail ở rank hiện tại (unlock tiến tiếp). Null nếu chưa có perk. */
export function currentPerk(tree: keyof PerkAllocations): {
  rank: number;
  next?: (typeof PERKS)[keyof PerkAllocations][number];
} | null {
  const level = perkLevel(tree);
  if (level <= 0) return null;
  const next = PERKS[tree].find((p) => p.rank === level + 1);
  return { rank: level, next };
}

/**
 * Farming perk: năng lượng giảm 15% (Sturdy Tools). Return energy cost đã tính.
 * Dùng FLOOR (không round) để perk có hiệu lực trên cost nhỏ:
 *   cost 2 (hoe/water) → floor(1.7) = 1 (giảm thật); round(1.7) = 2 = NO-OP.
 * cost 1 (scythe/plant) → floor(0.85) = 0 → clamp về 1 (không tool miễn phí).
 * Perk "Giảm 15%" mà không có tác dụng trên tool dùng nhiều nhất là UX fail.
 */
export function energyCostWithPerks(base: number): number {
  if (!hasPerk("farming", 2)) return base;
  return Math.max(1, Math.floor(base * 0.85));
}

/** Farming perk: 20% cơ hội double harvest (Double Harvest). */
export function doubleHarvestChance(): number {
  return hasPerk("farming", 4) ? 0.2 : 0;
}

/** Farming perk: 25% giữ hạt khi trồng (Seed Saver). */
export function seedSaverChance(): number {
  return hasPerk("farming", 6) ? 0.25 : 0;
}

/** Social perk: +10% friendship gain khi gift (Friendly Smile). */
export function friendshipGainMultiplier(): number {
  return hasPerk("social", 1) ? 1.1 : 1;
}

/** Social perk: quest XP +25% (Quest XP+). */
export function questXpMultiplier(): number {
  return hasPerk("social", 4) ? 1.25 : 1;
}

/**
 * Combat perk: +10% sát thương (Sharp Blade).
 * ponytail: chưa consumer — combat (blood-moon/enemy) system chưa ship. Wire vào
 * damage calc khi combat hook tồn tại. Giữ vì perk tree rank sequence cần slot.
 */
export function damageMultiplier(): number {
  return hasPerk("combat", 1) ? 1.1 : 1;
}

/**
 * Combat perk: +1 trap slot (Extra Trap Slot).
 * ponytail: chưa consumer — raid-server trap config dùng hardcoded slot count.
 * Wire vào DefenseConfig slot cap khi sync perk allocations sang raid-server.
 */
export function trapSlotBonus(): number {
  return hasPerk("combat", 3) ? 1 : 0;
}

/** Combat perk: raid cap +1/ngày (Raid Cap +1). */
export function raidCapBonus(): number {
  return hasPerk("combat", 4) ? 1 : 0;
}

/** Economy perk: giá bán crop +30% (Golden Yield farming) hoặc +15% (Silver Tongue social). */
export function sellPriceMultiplier(): number {
  let m = 1;
  if (hasPerk("farming", 9)) m += 0.3;
  if (hasPerk("social", 5)) m += 0.15;
  // W7d-P1: farmer rep ≥ 50 → +5% giá bán (§14). Reputation cache server-side.
  const rep = useReputationStore.getState();
  if (rep.farmer >= REPUTATION_EFFECTS.FARMER_SELL_AT) m += REPUTATION_EFFECTS.FARMER_SELL_BONUS;
  return m;
}
