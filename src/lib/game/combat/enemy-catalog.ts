// Wave 5 P1 — catalog quái (deep forest). Pure: không import store/Phaser.
// Frame sheets 32×32 (PIL pixel-probe W5): slime 4×4=16f, myconid 6×4=24f —
// anim dùng HÀNG 0 (idle/walk loop); damage = tint flash, dead = alpha fade
// (scene lo, catalog chỉ khai grid).
import type { GameIconId } from "@/components/game-ui/game-icon-id";

export interface EnemyLootEntry {
  itemId: string;
  chance: number; // 0..1
  qty?: [number, number];
}

export interface EnemyDef {
  id: string;
  name: string;
  /** Manifest key — phải có trong asset-manifest (test sync). */
  sheetKey: string;
  /** Số frame anim hàng 0 (loop idle/walk). */
  animFrames: number;
  /** px/s — player walk 120, chạy ~180 (kinetics). Quái chậm hơn người. */
  speed: number;
  hp: number;
  /** Bán kính aggro (tile, Chebyshev) — ngoài khoảng này wander quanh spawn. */
  aggroTiles: number;
  damageEnergy: number;
  /** Độ dài knockback (px) khi quái chạm player. */
  knockback: number;
  loot: EnemyLootEntry[];
  xp: number;
  respawnMs: number;
  icon: GameIconId;
}

/** Tune gom một chỗ — human gate cảm giác combat (plan P4). */
export const COMBAT_TUNE = {
  /** Đòn kiếm: reach tile từ tâm player theo hướng facing. */
  swingReachTiles: 1.5,
  /** Vùng cung đánh (độ) — 100° ôm ~3 tile trước mặt. */
  swingArcDeg: 100,
  /** Damage kiếm/đòn (không có chỉ số damage vũ khí — 1 hit 1 hp quái). */
  swordDamage: 1,
  /** Thời gian bất tử sau khi bị chạm (ms). */
  invulnMs: 1200,
  /** Quái mất dấu chase > leashTiles → về spawn. */
  leashTiles: 8,
  /** Wand: mỗi đổi hướng nghỉ 0.8–2.2s. */
  wanderPauseMs: [800, 2200] as [number, number],
} as const;

export const ENEMIES: readonly EnemyDef[] = [
  {
    id: "sprout_slime",
    name: "Slime Mầm Cây",
    sheetKey: "enemy.slime.pink",
    animFrames: 4,
    speed: 60,
    hp: 2,
    aggroTiles: 4,
    damageEnergy: 8,
    knockback: 40,
    loot: [
      { itemId: "sprout_leaf", chance: 0.8, qty: [1, 2] },
      { itemId: "slime_jelly", chance: 0.3, qty: [1, 1] },
    ],
    xp: 10,
    respawnMs: 45_000,
    icon: "category-resource",
  },
  {
    id: "slime_green",
    name: "Slime Xanh Non",
    sheetKey: "enemy.slime.green",
    animFrames: 4,
    speed: 70,
    hp: 3,
    aggroTiles: 5,
    damageEnergy: 8,
    knockback: 44,
    loot: [
      { itemId: "slime_jelly", chance: 0.6, qty: [1, 2] },
      { itemId: "glow_mushroom", chance: 0.25, qty: [1, 1] },
    ],
    xp: 14,
    respawnMs: 50_000,
    icon: "category-resource",
  },
  {
    id: "slime_blue",
    name: "Slime Xanh Biển",
    sheetKey: "enemy.slime.blue",
    animFrames: 4,
    speed: 75,
    hp: 4,
    aggroTiles: 5,
    damageEnergy: 10,
    knockback: 48,
    loot: [
      { itemId: "slime_jelly", chance: 0.5, qty: [1, 2] },
      { itemId: "glow_mushroom", chance: 0.5, qty: [1, 2] },
    ],
    xp: 18,
    respawnMs: 55_000,
    icon: "category-resource",
  },
  {
    id: "myconid_purple",
    name: "Nấm Nhân Tím",
    sheetKey: "enemy.myconid",
    animFrames: 6,
    speed: 55,
    hp: 5,
    aggroTiles: 6,
    damageEnergy: 12,
    knockback: 52,
    loot: [
      { itemId: "glow_mushroom", chance: 0.7, qty: [1, 2] },
      { itemId: "forest_herb", chance: 0.35, qty: [1, 1] },
    ],
    xp: 24,
    respawnMs: 70_000,
    icon: "category-resource",
  },
];

export function enemyById(id: string): EnemyDef | undefined {
  return ENEMIES.find((e) => e.id === id);
}

/** Zone có quái — farm/house/village/beach/cave KHÔNG bao giờ spawn (test chốt). */
export const ENEMY_ZONES: readonly string[] = ["deepforest"];
