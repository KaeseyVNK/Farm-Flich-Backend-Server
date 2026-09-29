// Footstep cadence + dust burst. Cadence thuần để unit-test; FX phần Phaser.
// ANIMATION_UPDATE (Phaser 4.2.1) phát từ sprite với payload
// (anim, frame, gameObject, frameKey) — frame là AnimationFrame có `index`
// 1-based trong chuỗi anim → nạp thẳng vào shouldStep (index % 2 === 1).
import Phaser from "phaser";

/** true nếu frame hiện tại rơi vào nhịp bước (mỗi `stride` frame của walk/run). */
export function shouldStep(animKey: string, frameIndex: number, stride = 2): boolean {
  if (!animKey.startsWith("farmer-walk-") && !animKey.startsWith("farmer-run-")) return false;
  return frameIndex % stride === 1;
}

export function createFootstepFx(
  scene: Phaser.Scene,
  avatar: Phaser.GameObjects.Container,
  opts: { reducedMotion: boolean; onStep: () => void },
): { destroy(): void } {
  // Texture bụi 6px (trắng mờ) — dùng chung qua scene restart, không remove key
  // (TextureManager sống theo game, không theo scene).
  if (!scene.textures.exists("fx-dust")) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xd9cbb2, 0.85).fillCircle(3, 3, 3);
    g.generateTexture("fx-dust", 6, 6);
    g.destroy();
  }
  const emitter = scene.add
    .particles(avatar.x, avatar.y + 6, "fx-dust", {
      lifespan: 380,
      speed: { min: 8, max: 26 },
      angle: { min: 200, max: 340 },
      scale: { start: 0.9, end: 0 },
      alpha: { start: 0.5, end: 0 },
      quantity: 3,
      emitting: false,
    });

  // Farmer sprite nằm trong avatar container (fallback graphics path thì bỏ qua
  // — không anim, không bước).
  const sprite = avatar.list.find((c) => c.type === "Sprite") as
    | Phaser.GameObjects.Sprite
    | undefined;

  const onAnimUpdate = (
    anim: Phaser.Animations.Animation,
    frame: Phaser.Animations.AnimationFrame,
  ) => {
    if (!shouldStep(anim.key, frame.index)) return;
    // Dust là visual → tắt hẳn khi reduced-motion; SFX (audio) vẫn chạy.
    // Phaser 4 emitter không có startFollow → emit tại toạ độ avatar hiện tại
    // (emitParticleAt nhận world coords, vị trí emitter không liên quan).
    // Depth đọc NGAY LÚC emit: avatar depth được FarmScene gán lại mỗi frame
    // di chuyển (y + 8) và tại lúc tạo fx avatar.depth vẫn là default 0 →
    // set depth lúc tạo sẽ giữ giá trị stale, dust bị crop/scenery (depth ≥32)
    // che mất.
    if (!opts.reducedMotion) {
      emitter.setDepth(avatar.depth - 1);
      emitter.emitParticleAt(avatar.x, avatar.y + 6);
    }
    opts.onStep();
  };
  sprite?.on(Phaser.Animations.Events.ANIMATION_UPDATE, onAnimUpdate);

  let destroyed = false;
  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      // Listener gắn trên sprite con — off thủ công (sprite bị avatar.destroy()
      // cuốn theo nhưng off tường minh cho chắc, pattern cleanup ADR-002).
      sprite?.off(Phaser.Animations.Events.ANIMATION_UPDATE, onAnimUpdate);
      emitter.destroy();
    },
  };
}
