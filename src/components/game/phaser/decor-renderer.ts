// W3P3 — DecorRenderer: vẽ placedDecor (farm + house) lên scene. Mỗi placement
// slice frame crop từ manifest sheet qua addFootSprite (frame name unique uid),
// xoay quanh chân theo rot, flip theo flag. Fallback: rect màu phẳ tier.
// Re-render theo farmStore.version bump (placeDecor/removeDecor đều bump).
import type Phaser from "phaser";
import { TILE_SIZE } from "@/lib/game/constants";
import { useFarmStore } from "@/store/farmStore";
import { decorById } from "@/lib/game/decor/decor-catalog";
import { footprintOf } from "@/lib/game/decor/decor-placement";
import { addFootSprite } from "@/lib/game/phaser/texture-frames";

/** Fallback rect màu theo tier (khi texture chưa load — cold start). */
const TIER_COLOR: Record<string, number> = {
  basic: 0x9c7b4d,
  nice: 0x6fa8dc,
  fancy: 0xc99be0,
};

export class DecorRenderer {
  private layers: Array<Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle | Phaser.GameObjects.Graphics> = [];

  render(scene: Phaser.Scene, zoneId: string): void {
    this.destroy();
    const placed = useFarmStore.getState().placedDecor;
    for (const d of placed) {
      if (d.zone !== zoneId) continue;
      const def = decorById(d.defId);
      if (!def) continue;
      const fp = footprintOf(def, d.rot);
      const depth = (d.ty + fp.h) * TILE_SIZE;
      const footX = (d.tx + fp.w / 2) * TILE_SIZE;
      const footY = (d.ty + fp.h) * TILE_SIZE;
      const img = addFootSprite(
        scene,
        def.manifestKey,
        def.frame.x,
        def.frame.y,
        def.frame.w,
        def.frame.h,
        footX,
        footY,
        depth,
        `decor-${d.uid}`,
      );
      if (img) {
        // Xoay quanh chân (origin 0.5,1): footprint rot 90/270 khớp visually.
        if (d.rot) img.setAngle(d.rot);
        if (d.flip) img.setFlipX(true);
        this.layers.push(img);
        continue;
      }
      const g = scene.add.graphics();
      g.setDepth(depth).fillStyle(TIER_COLOR[def.tier] ?? 0x888888).fillRect(
        d.tx * TILE_SIZE,
        d.ty * TILE_SIZE,
        fp.w * TILE_SIZE,
        fp.h * TILE_SIZE,
      );
      this.layers.push(g);
    }
  }

  destroy(): void {
    for (const layer of this.layers) layer.destroy();
    this.layers = [];
  }
}
