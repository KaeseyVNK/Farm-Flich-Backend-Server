// Đung đưa foliage quanh chân (origin 0.5,1 từ addFootSprite) — tween sine ±1°.
// reduced-motion: CALLER (FarmSceneryRenderer) không attach — giữ signature.
import type Phaser from "phaser";

/** Gắn tween sway cho 1 sprite cây/hoa; `seed` quyết định pha & biên độ. */
export function attachSway(
  scene: Phaser.Scene,
  img: Phaser.GameObjects.Image,
  seed: number,
): void {
  if (!scene.tweens || img.getData("sway")) return;
  img.setData("sway", true);
  const amp = 0.8 + (seed % 5) * 0.15; // 0.8°–1.4°
  scene.tweens.add({
    targets: img,
    angle: { from: -amp, to: amp },
    duration: 1500 + (seed % 7) * 260,
    yoyo: true,
    repeat: -1,
    ease: "Sine.inOut",
    delay: (seed % 11) * 90,
  });
}
