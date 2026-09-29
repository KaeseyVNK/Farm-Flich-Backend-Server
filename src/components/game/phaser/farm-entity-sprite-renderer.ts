// FarmEntitySpriteRenderer — display-only pixel villagers for the Phaser farm view.
// It consumes existing NPC data only; interaction authority remains in FarmScene.
import Phaser from "phaser";
import { SCALE, TILE_SIZE } from "@/lib/game/constants";
import { ensureFrame, textureHas } from "@/lib/game/phaser/texture-frames";

export interface EntityRenderInput {
  id: string;
  tx: number;
  ty: number;
  /** CSS hex, e.g. "#7a5230". */
  color: string;
  /** Retained for callers and accessibility metadata; not printed in the world. */
  glyph: string;
}

function hexToPhaser(hex: string): number {
  return parseInt(hex.replace("#", ""), 16);
}

// NPC sheet frame grids (pixel-probed, alpha channel):
// - char.elyria.idle 128×32 = 1×4 frames of 32×32 → slice (0,0).
// - char.pirate.idle 128×128 = 4×4 grid of 32×32 frames (4 directions × 4
//   idle frames); grid row 0 is front-facing (head-region skin tone ~
//   rgb(100,84,54) vs the darker back-view bandana row) → slice (0,0) 32×32.
const NPC_SHEET: Record<string, string> = {
  alaric: "char.alaric.idle",
  gaston: "char.gaston.idle",
  elyria: "char.elyria.idle",
  jack: "char.pirate.idle",
};

export class FarmEntitySpriteRenderer {
  private avatars: Phaser.GameObjects.Container[] = [];

  /** Render composed pixel villagers. Idempotent — destroy() before rebuild. */
  render(scene: Phaser.Scene, npcs: readonly EntityRenderInput[]): boolean {
    this.destroy();
    for (const npc of npcs) {
      const cx = npc.tx * TILE_SIZE + TILE_SIZE / 2;
      const cy = npc.ty * TILE_SIZE + TILE_SIZE / 2;
      const avatar = scene.add.container(cx, cy);
      const sheet = NPC_SHEET[npc.id];
      if (sheet && textureHas(scene, sheet) && typeof scene.add.image === "function") {
        if (ensureFrame(scene, sheet, "idle-down", 0, 0, 32, 32)) {
          const spr = scene.add.image(0, 10, sheet, "idle-down");
          spr.setOrigin(0.5, 1);
          spr.setScale(SCALE);
          avatar.add(spr);
        }
      } else {
        const sprite = scene.add.graphics();
        const outfit = hexToPhaser(npc.color);
        sprite.fillStyle(0x342821, 0.24).fillEllipse(-12, 13, 24, 6);
        sprite.fillStyle(0x35271f).fillRect(-7, 6, 5, 8).fillRect(2, 6, 5, 8);
        sprite.fillStyle(outfit).fillRect(-9, -5, 18, 13);
        sprite.fillStyle(0xdcb58d).fillRect(-6, -15, 12, 10);
        sprite.fillStyle(0x513424).fillRect(-7, -17, 14, 4).fillRect(-8, -14, 3, 6);
        sprite.fillStyle(0xf0d47f).fillRect(-9, -4, 18, 2);
        avatar.add(sprite);
      }
      avatar.setDepth(cy + 4);
      if (typeof scene.add.text === "function" && npc.glyph) {
        const tag = scene.add
          .text(0, -28, npc.glyph, {
            fontFamily: "monospace",
            fontSize: "9px",
            color: "#fffaf0",
            backgroundColor: "#3b2f23",
            padding: { x: 3, y: 1 },
          })
          .setOrigin(0.5, 1);
        avatar.add(tag);
      }
      this.avatars.push(avatar);
    }
    return true;
  }

  destroy(): void {
    for (const avatar of this.avatars) avatar.destroy();
    this.avatars = [];
  }

  get count(): number {
    return this.avatars.length;
  }
}
