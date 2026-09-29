// Ambient particles theo mùa (bướm / lá rụng / tuyết) — visual-only.
// reduced-motion → hoàn toàn không spawn (baseline e2e đi qua
// enableReducedMotion nên capture phải unchanged).
import Phaser from "phaser";
import type { Season } from "@/lib/game/constants";

export interface AmbientConfig {
  zone: string;
  season: Season;
  reducedMotion: boolean;
  /** Kích thước thế giới (px) — caller truyền zoneCols/Rows * TILE_SIZE. */
  worldWidth: number;
  worldHeight: number;
}

export type AmbientKind = "butterflies" | "leaves" | "snow" | "none";

/** Loại ambient cho zone+mùa — thuần để unit-test. */
export function ambientKindFor(cfg: Pick<AmbientConfig, "zone" | "season">): AmbientKind {
  if (cfg.zone !== "farm" && cfg.zone !== "village" && cfg.zone !== "beach") return "none";
  if (cfg.season === "Fall") return "leaves";
  if (cfg.season === "Winter") return "snow";
  return "butterflies";
}

const AMBIENT_COLOR: Record<Exclude<AmbientKind, "none">, number> = {
  butterflies: 0xf2e3b3,
  leaves: 0xd9772f,
  snow: 0xf4f8ff,
};

/**
 * Random real [min,max). Dưới E2E (NEXT_PUBLIC_E2E=1) dùng seeded
 * RandomDataGenerator (seed cố định) để vị trí hạt deterministic —
 * visual capture phải ổn định qua các lần chạy.
 */
function makeRng(): (min: number, max: number) => number {
  if (process.env.NEXT_PUBLIC_E2E === "1") {
    const rng = new Phaser.Math.RandomDataGenerator(["e2e-ambient-7"]);
    return (min, max) => rng.realInRange(min, max);
  }
  return (min, max) => min + Math.random() * (max - min);
}

export function spawnAmbient(
  scene: Phaser.Scene,
  cfg: AmbientConfig,
): { destroy(): void } {
  const kind = cfg.reducedMotion ? "none" : ambientKindFor(cfg);
  if (kind === "none") return { destroy() {} };

  // Texture 4px (pattern footstep-fx.ts: make.graphics + generateTexture,
  // không remove key — TextureManager sống theo game, không theo scene).
  const key = `fx-ambient-${kind}`;
  if (!scene.textures.exists(key)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(AMBIENT_COLOR[kind], 0.9).fillRect(0, 0, 4, 4);
    g.generateTexture(key, 4, 4);
    g.destroy();
  }

  const rand = makeRng();
  const count = kind === "snow" ? 24 : 8;
  const images: Phaser.GameObjects.Image[] = [];

  for (let i = 0; i < count; i++) {
    const ax = rand(0, cfg.worldWidth);
    const ay = rand(0, cfg.worldHeight);
    const img = scene.add.image(ax, ay, key).setDepth(5000);
    images.push(img);

    if (kind === "snow") {
      // Tuyết rơi: y += 300-700 trong 6-12s, repeat reset về vị trí khởi đầu
      // (tween from/to restart mỗi repeat), x lắc nhẹ.
      scene.tweens.add({
        targets: img,
        y: { from: ay, to: ay + rand(300, 700) },
        duration: rand(6000, 12000),
        repeat: -1,
        ease: "Linear",
      });
      scene.tweens.add({
        targets: img,
        x: { from: ax - rand(8, 20), to: ax + rand(8, 20) },
        duration: rand(1500, 3000),
        yoyo: true,
        repeat: -1,
        ease: "Sine.inOut",
      });
    } else {
      // Bướm / lá trôi: yoyo ±60x ±24y quanh anchor.
      scene.tweens.add({
        targets: img,
        x: { from: ax - rand(30, 60), to: ax + rand(30, 60) },
        y: { from: ay - rand(12, 24), to: ay + rand(12, 24) },
        duration: rand(2500, 5000),
        yoyo: true,
        repeat: -1,
        ease: "Sine.inOut",
        delay: rand(0, 1200),
      });
    }
  }

  let destroyed = false;
  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      // Tweens KHÔNG tự chết theo target trong Phaser 4 — kill tường minh
      // rồi mới destroy image (pattern cleanup ADR-002).
      for (const img of images) {
        scene.tweens.killTweensOf(img);
        img.destroy();
      }
    },
  };
}
