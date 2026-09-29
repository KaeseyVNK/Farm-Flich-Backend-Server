// Perks config (phase 6). 3 skill trees × 10 rank. Mỗi perk có effect hook.
// ADR-017: perks apply modifiers (KHÔNG inline hook action logic).
export type TreeId = "farming" | "combat" | "social";

export interface Perk {
  id: string;
  tree: TreeId;
  rank: number; // 1-10
  name: string;
  desc: string;
  /** Modifier key StatModel push khi unlock. */
  modifier?: string;
  /** Effect hook target (integration-wired, audit purposes). */
  effectHook: string;
}

/**
 * Perk đã wire effect thực tế vào gameplay END-TO-END (verify qua grep
 * perk-effects call sites + server enforcement). Còn lại là MVP roadmap —
 * player vẫn allocate nhưng effect chưa kick in. UI dùng set này để badge
 * "chưa kích hoạt" tránh player tốn điểm vô ích rồi thất vọng.
 * ponytail: wire từng perk khi implement feature tương ứng.
 *
 * Wired end-to-end: farm-2 (energyCost), farm-4 (doubleHarvest), farm-6 (seedSaver),
 * farm-9 + soc-5 (sellPrice), soc-1 (friendship), soc-4 (questXp).
 * Client-only (server chưa enforce → badge, không wire đầy đủ): cmb-4 (raidCap —
 * server DAILY_RAID_CAP hardcoded 3, perk chỉ mở UI, server reject lượt 4).
 * Stub-but-wired (effect function tồn tại, chưa có consumer đầy đủ): cmb-3 (damage), cmb-8 (trap).
 */
export const WIRED_PERKS = new Set<string>([
  "farm-2", "farm-4", "farm-6", "farm-9",
  "soc-1", "soc-4", "soc-5",
]);

/** Perk có effect thực tế chưa? UI badge + gate allocate (optional). */
export function isPerkWired(perkId: string): boolean {
  return WIRED_PERKS.has(perkId);
}

export const PERKS: Record<TreeId, Perk[]> = {
  farming: [
    { id: "farm-1", tree: "farming", rank: 1, name: "Green Thumb", desc: "Cây lớn nhanh 10%", modifier: "growth-speed", effectHook: "actions.ts:growthTick" },
    { id: "farm-2", tree: "farming", rank: 2, name: "Sturdy Tools", desc: "Giảm 15% thể lực tiêu tốn", modifier: "energy-cost", effectHook: "actions.ts:energyCost" },
    { id: "farm-3", tree: "farming", rank: 3, name: "Auto-Water", desc: "Tưới tự động gần giếng", effectHook: "actions.ts:autoWater" },
    { id: "farm-4", tree: "farming", rank: 4, name: "Double Harvest", desc: "20% cơ hội thu hoạch đôi", modifier: "harvest-multiplier", effectHook: "actions.ts:harvest" },
    { id: "farm-5", tree: "farming", rank: 5, name: "Fertile Soil", desc: "Quality crop +1", modifier: "crop-quality", effectHook: "actions.ts:quality" },
    { id: "farm-6", tree: "farming", rank: 6, name: "Seed Saver", desc: "25% giữ hạt khi trồng", modifier: "seed-save", effectHook: "actions.ts:plant" },
    { id: "farm-7", tree: "farming", rank: 7, name: "Seasonal Adapt", desc: "Cây sống qua season change", effectHook: "actions.ts:seasonTransition" },
    { id: "farm-8", tree: "farming", rank: 8, name: "Master Tiller", desc: "Cày 3 ô cùng lúc", modifier: "till-aoe", effectHook: "actions.ts:till" },
    { id: "farm-9", tree: "farming", rank: 9, name: "Golden Yield", desc: "Giá bán crop +30%", modifier: "sell-price", effectHook: "economy.ts:sellPrice" },
    { id: "farm-10", tree: "farming", rank: 10, name: "Harvest Goddess", desc: "Auto-regrow sau thu hoạch", effectHook: "actions.ts:regrow" },
  ],
  combat: [
    { id: "cmb-1", tree: "combat", rank: 1, name: "Sharp Blade", desc: "+10% sát thương", modifier: "damage", effectHook: "combat:hit" },
    { id: "cmb-2", tree: "combat", rank: 2, name: "Quick Reflex", desc: "+15% tốc độ raid", modifier: "raid-speed", effectHook: "raid:move" },
    { id: "cmb-3", tree: "combat", rank: 3, name: "Extra Trap Slot", desc: "+1 bẫy đặt được", modifier: "trap-slots", effectHook: "raid-config:trapCap" },
    { id: "cmb-4", tree: "combat", rank: 4, name: "Raid Cap +1", desc: "Đi raid thêm 1 lần/ngày", modifier: "raid-cap", effectHook: "raid-cap:dailyLimit" },
    { id: "cmb-5", tree: "combat", rank: 5, name: "Iron Skin", desc: "-20% sát thương nhận", modifier: "damage-reduction", effectHook: "combat:defense" },
    { id: "cmb-6", tree: "combat", rank: 6, name: "Mask Durability", desc: "+50% độ bền mask", modifier: "mask-durability", effectHook: "raid:mask" },
    { id: "cmb-7", tree: "combat", rank: 7, name: "Loot Luck", desc: "+25% tỉ lệ loot hiếm", modifier: "loot-luck", effectHook: "raid:lootTable" },
    { id: "cmb-8", tree: "combat", rank: 8, name: "Counter Strike", desc: "20% phản đòn", modifier: "counter", effectHook: "combat:defense" },
    { id: "cmb-9", tree: "combat", rank: 9, name: "Bloodlust", desc: "Hồi thể lực khi hạ enemy", modifier: "lifesteal-energy", effectHook: "combat:kill" },
    { id: "cmb-10", tree: "combat", rank: 10, name: "Death Bringer", desc: "+50% sát thương blood-moon", modifier: "bloodmoon-damage", effectHook: "combat:bloodmoon" },
  ],
  social: [
    { id: "soc-1", tree: "social", rank: 1, name: "Friendly Smile", desc: "+10% friendship khi gift", modifier: "friendship-gain", effectHook: "social:gift" },
    { id: "soc-2", tree: "social", rank: 2, name: "Haggler", desc: "-10% giá mua", modifier: "buy-price", effectHook: "shop:buy" },
    { id: "soc-3", tree: "social", rank: 3, name: "Extra Gift", desc: "+1 gift/ngày/NPC", modifier: "gift-cap", effectHook: "social:giftCap" },
    { id: "soc-4", tree: "social", rank: 4, name: "Quest XP+", desc: "+25% XP quest", modifier: "quest-xp", effectHook: "quest:reward" },
    { id: "soc-5", tree: "social", rank: 5, name: "Silver Tongue", desc: "+15% giá bán", modifier: "sell-price", effectHook: "economy:sellPrice" },
    { id: "soc-6", tree: "social", rank: 6, name: "Reputation", desc: "Mở khóa NPC quest ẩn", effectHook: "social:unlockQuest" },
    { id: "soc-7", tree: "social", rank: 7, name: "Gift Value", desc: "+20% giá trị gift", modifier: "gift-value", effectHook: "social:giftValue" },
    { id: "soc-8", tree: "social", rank: 8, name: "Heart Bond", desc: "Friendship không giảm", effectHook: "social:decay" },
    { id: "soc-9", tree: "social", rank: 9, name: "Charisma", desc: "NPC tặng quà ngược", effectHook: "social:reverseGift" },
    { id: "soc-10", tree: "social", rank: 10, name: "Beloved", desc: "Mở khóa ending Social", effectHook: "story:endingUnlock" },
  ],
};

/** Perk theo tree + rank. */
export function perkAt(tree: TreeId, rank: number): Perk | undefined {
  return PERKS[tree].find((p) => p.rank === rank);
}

/** Prerequisite: rank N cần rank N-1 đã unlock. */
export function meetsPrerequisite(
  allocations: Record<TreeId, number>,
  tree: TreeId,
  rank: number,
): boolean {
  if (rank === 1) return true;
  return (allocations[tree] ?? 0) >= rank - 1;
}
