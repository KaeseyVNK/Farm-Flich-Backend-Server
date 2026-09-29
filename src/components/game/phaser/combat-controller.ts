// Wave 5 P3 — CombatController: enemy entities + pickups cho deepforest.
// Scene-local state (KHÔNG persist — respawn mỗi lần vào zone, plan chấp nhận).
// Pure logic nằm combat-sm; controller bọc Phaser render + tick + bridge hooks.
import Phaser from "phaser";
import {
  ENEMIES,
  COMBAT_TUNE,
  enemyById,
} from "@/lib/game/combat/enemy-catalog";
import {
  makeEnemy,
  nextEnemy,
  swingHit,
  damageEnemy,
  touchPlayer,
  type EnemyState,
  type Facing,
} from "@/lib/game/combat/combat-sm";
import { DEEPFOREST_SPAWNS } from "@/lib/game/zones/deepforest";
import { getItem } from "@/lib/game/data";
import { resolveIcon } from "@/lib/game/assets/icon-manifest";
import { useGameStore } from "@/store/gameStore";
import { useInventoryStore } from "@/store/inventoryStore";
import { useUiStore } from "@/store/uiStore";
import { useTutorialStore } from "@/store/tutorialStore";
import { playSfx } from "@/lib/game/sfx";

const TILE = 48;

interface Pickup {
  itemId: string;
  qty: number;
  x: number;
  y: number;
  visual: Phaser.GameObjects.Image | Phaser.GameObjects.Text;
}

/** rng combat — mulberry32 seed từ Date (không cần deterministic cross-session). */
function combatRng(): () => number {
  let s = Math.floor(Math.random() * 2 ** 31);
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface CombatAdapter {
  /** Solid theo PX (controller tự không biết tile). */
  solidAtPx: (x: number, y: number) => boolean;
  getPlayer: () => { x: number; y: number } | null;
  /** Chỉ số hướng player đang nhìn. */
  getFacing: () => Facing;
  /** XP kill (đã nhân buff bên scene). */
  onKillXp: (amount: number) => void;
  /** Energy <= 0 sau khi bị chạm — scene xử collapse về nhà. */
  onFaint: () => void;
}

export class CombatController {
  private enemies: EnemyState[] = [];
  private sprites = new Map<string, Phaser.GameObjects.Sprite>();
  private pickups: Pickup[] = [];
  private rng = combatRng();
  private zoneId = "farm";
  private invulnUntil = 0;
  private e2eSeq = 0;
  private destroyed = false;

  constructor(
    private scene: Phaser.Scene,
    private adapter: CombatAdapter,
  ) {}

  /** Đổi zone: deepforest spawn theo layout; zone khác dọn sạch (cozy §4). */
  syncZone(zone: string): void {
    this.zoneId = zone;
    this.clearVisuals();
    this.enemies = [];
    this.pickups = [];
    if (zone !== "deepforest") return;
    for (const s of DEEPFOREST_SPAWNS) {
      const e = makeEnemy(s.id, s.defId, s.x, s.y, TILE);
      if (e) this.enemies.push(e);
    }
    for (const e of this.enemies) this.spawnSprite(e);
  }

  private clearVisuals(): void {
    for (const s of this.sprites.values()) s.destroy();
    this.sprites.clear();
    // Tween repeat:-1 KHÔNG tự chết theo target — phải kill thủ công (leak CPU).
    for (const p of this.pickups) {
      this.scene.tweens?.killTweensOf(p.visual);
      p.visual.destroy();
    }
    this.pickups = [];
  }

  private spawnSprite(e: EnemyState): void {
    const def = enemyById(e.defId);
    if (!def) return;
    // Frame slice 32×32 hàng 0 (PIL probe) — frames đánh dấu theo enemy id.
    const spr = this.scene.add.sprite(e.x, e.y, def.sheetKey);
    spr.setDepth(e.y + 8);
    spr.setScale(TILE / 32); // sheet 32px → tile 48px
    const animKey = `enemy-anim-${e.defId}`;
    if (this.scene.anims && !this.scene.anims.exists(animKey)) {
      this.scene.anims.create({
        key: animKey,
        frames: Array.from({ length: def.animFrames }, (_, i) => ({ key: def.sheetKey, frame: i })),
        frameRate: 6,
        repeat: -1,
      });
    }
    if (this.scene.anims?.exists(animKey)) spr.play(animKey);
    this.sprites.set(e.id, spr);
  }

  /** Tick mỗi frame (chỉ gọi khi zone deepforest + gameplay không blocked). */
  update(now: number, dtMs: number): void {
    if (this.zoneId !== "deepforest" || this.destroyed) return;
    const player = this.adapter.getPlayer();
    if (!player) return;

    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      const next = nextEnemy(e, player, now, dtMs, this.rng, this.adapter.solidAtPx, TILE);
      if (next !== e) {
        const spr = this.sprites.get(e.id);
        if (spr) {
          spr.setPosition(next.x, next.y);
          spr.setDepth(next.y + 8);
          if (next.fsm === "dead" && e.fsm !== "dead") {
            spr.setAlpha(0.25); // xác mờ đến respawn
          } else if (next.fsm !== "dead" && e.fsm === "dead") {
            spr.setAlpha(1); // hồi sinh
          }
        }
        // Chạm player (chỉ khi sống + hết invuln).
        const touch = touchPlayer(next, player, this.invulnUntil, now, TILE);
        if (touch) {
          this.invulnUntil = now + touch.invulnMs;
          const ui = useUiStore.getState();
          useGameStore.getState().addEnergy(-touch.energyLoss);
          ui.notify(`Quái chạm −${touch.energyLoss} năng lượng!`, "warn");
          playSfx("error");
          // Impulse đẩy player (px) — scene đọc lastKnockback rồi áp vào kinetics.
          this.lastKnockback = {
            x: touch.knockbackVec.x * touch.knockbackPx,
            y: touch.knockbackVec.y * touch.knockbackPx,
          };
          if (useGameStore.getState().energy <= 0) {
            this.adapter.onFaint();
            // onFaint → enterZone(farm) → syncZone đã dọn enemies — DỪNG ngay,
            // map tiếp sẽ ghi đè array rỗng bằng state cũ (stale-farm bug).
            return;
          }
        }
      }
      this.enemies[i] = next;
    }

    this.updatePickups(player);
  }

  /** Impulse knockback (px) lần chạm gần nhất — scene đọc rồi reset. */
  lastKnockback: { x: number; y: number } | null = null;

  /** Vung kiếm: hit mọi enemy trong arc; trả số kill + items nhặt được sau này. */
  swing(): { hits: number; kills: number } {
    if (this.zoneId !== "deepforest") return { hits: 0, kills: 0 };
    const player = this.adapter.getPlayer();
    if (!player) return { hits: 0, kills: 0 };
    const now = performance.now();
    const hit = swingHit(player, this.adapter.getFacing(), this.enemies, TILE);
    let kills = 0;
    for (const target of hit) {
      const r = damageEnemy(target, COMBAT_TUNE.swordDamage, now, this.rng);
      const idx = this.enemies.indexOf(target);
      if (idx >= 0) this.enemies[idx] = r.enemy;
      // flash damage (alpha blink — tint API Phaser4 đổi, alpha an toàn mọi bản).
      // Chết: xác mờ + đứng hình ngay tại đây — nextEnemy không thấy transition
      // alive→dead nên setAlpha(0.25) trong update không bao giờ chạy.
      const spr = this.sprites.get(target.id);
      if (spr && r.enemy.fsm === "dead") {
        spr.anims?.stop();
        spr.setAlpha(0.25);
      } else if (spr) {
        this.scene.tweens?.add({
          targets: spr,
          alpha: { from: 1, to: 0.2 },
          duration: 90,
          yoyo: true,
        });
      }
      if (r.enemy.fsm === "dead") {
        kills++;
        this.adapter.onKillXp(r.xp);
        // W9P5 fix: t_deep_forest probe — combat kill (deepforest) phải tick
        // monstersDefeated (trước đây chỉ cave defeatSlime tick → step 12 kẹt).
        useTutorialStore.getState().tickMonsterDefeat();
        for (const d of r.drops) this.dropPickup(d.itemId, d.qty, r.enemy.x, r.enemy.y);
      }
    }
    if (hit.length > 0) playSfx("chop");
    return { hits: hit.length, kills };
  }

  private dropPickup(itemId: string, qty: number, x: number, y: number): void {
    const art = resolveIcon(itemId, "resource");
    let visual: Phaser.GameObjects.Image | Phaser.GameObjects.Text;
    if (art.status === "approved" && this.scene.textures.exists(art.key)) {
      // Pack icons are 32×16 (idle | selected); crop the idle 16×16 cell.
      const img = this.scene.add.image(x, y, art.key);
      img.setOrigin(0.5);
      img.setCrop(0, 0, 16, 16);
      img.setDisplaySize(22, 22);
      img.setDepth(y + 100);
      visual = img;
    } else {
      visual = this.scene.add
        .text(x, y, getItem(itemId)?.name?.slice(0, 1) ?? "?", {
          fontSize: "14px",
          color: "#3b2f23",
        })
        .setOrigin(0.5)
        .setDepth(y + 100);
    }
    this.scene.tweens?.add({
      targets: visual,
      y: y - 6,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    this.pickups.push({ itemId, qty, x, y, visual });
  }

  private updatePickups(player: { x: number; y: number }): void {
    const inv = useInventoryStore.getState();
    const ui = useUiStore.getState();
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      if (Math.hypot(player.x - p.x, player.y - p.y) > TILE * 0.6) continue;
      const left = inv.addItem(p.itemId, p.qty);
      const got = p.qty - left;
      if (got > 0) {
        ui.notify(`Nhặt ${getItem(p.itemId)?.name ?? p.itemId} ×${got}`, "success");
        playSfx("coin");
      }
      if (left > 0) {
        // túi đầy — pickup ở lại, thử sau
        p.qty = left;
        continue;
      }
      this.scene.tweens?.killTweensOf(p.visual);
      p.visual.destroy();
      this.pickups.splice(i, 1);
    }
  }

  /** Bridge/e2e: spawn thêm enemy tại tile (dev/test only). */
  spawnAt(defId: string, tx: number, ty: number): boolean {
    if (this.zoneId !== "deepforest") return false; // doc: chỉ deepforest
    if (!enemyById(defId)) return false;
    // Counter riêng — enemies.length trùng số layout spawns (8) → id nhảy.
    const id = `e2e-${this.e2eSeq++}`;
    const e = makeEnemy(id, defId, tx, ty, TILE);
    if (!e) return false;
    this.enemies.push(e);
    this.spawnSprite(e);
    return true;
  }

  /** Bridge/e2e: snapshot đọc state. */
  snapshot(): {
    enemies: { id: string; defId: string; x: number; y: number; hp: number; fsm: string }[];
    pickups: { itemId: string; qty: number; x: number; y: number }[];
  } {
    return {
      enemies: this.enemies.map((e) => ({ id: e.id, defId: e.defId, x: e.x, y: e.y, hp: e.hp, fsm: e.fsm })),
      pickups: this.pickups.map((p) => ({ itemId: p.itemId, qty: p.qty, x: p.x, y: p.y })),
    };
  }

  destroy(): void {
    this.destroyed = true;
    this.clearVisuals();
  }
}

/** Danh sách def id có spawn (test farm-safe dùng). */
export const COMBAT_ENEMY_IDS = ENEMIES.map((e) => e.id);
