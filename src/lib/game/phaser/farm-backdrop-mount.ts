import Phaser from "phaser";
import {
  FARM_BACKDROP_KEY,
  type BackdropRect,
} from "./farm-backdrop";

/** Fit the painting into the locked camera view and return its world rect. */
export function mountFarmBackdrop(
  scene: Phaser.Scene,
  cx: number,
  cy: number,
  viewW: number,
  viewH: number,
): BackdropRect | undefined {
  if (!scene.textures.exists(FARM_BACKDROP_KEY)) return undefined;
  const src = scene.textures.get(FARM_BACKDROP_KEY).getSourceImage() as { width: number; height: number };
  const nw = src.width || 1;
  const nh = src.height || 1;
  const scale = Math.min(viewW / nw, viewH / nh);
  const dw = nw * scale;
  const dh = nh * scale;
  scene.add.rectangle(cx, cy, viewW, viewH, 0x79bf56).setDepth(-60);
  const img = scene.add.image(cx, cy, FARM_BACKDROP_KEY);
  img.setDepth(-40);
  img.setDisplaySize(dw, dh);
  return { x: cx - dw / 2, y: cy - dh / 2, w: dw, h: dh };
}
