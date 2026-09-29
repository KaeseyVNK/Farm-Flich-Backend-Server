// Named atlas frames for Maeve pack sheets. Phaser addImage registers the
// whole PNG; gameplay then slices 16×16 tiles / character cells from it.
import type Phaser from "phaser";
import { SCALE, TILE_SIZE } from "@/lib/game/constants";

export function textureHas(scene: Phaser.Scene, key: string): boolean {
  return Boolean(scene.textures?.exists?.(key));
}

/** Native PNG size for a packed texture (undefined on structural test mocks). */
export function textureNativeSize(
  scene: Phaser.Scene,
  key: string,
): { w: number; h: number } | undefined {
  if (!textureHas(scene, key)) return undefined;
  const tex = scene.textures.get(key) as {
    getSourceImage?: () => { width: number; height: number };
    source?: Array<{ width: number; height: number }>;
  };
  const img = tex.getSourceImage?.();
  if (img && img.width > 0 && img.height > 0) return { w: img.width, h: img.height };
  const src = tex.source?.[0];
  if (src && src.width > 0 && src.height > 0) return { w: src.width, h: src.height };
  return undefined;
}

export function ensureFrame(
  scene: Phaser.Scene,
  key: string,
  frame: string,
  x: number,
  y: number,
  w: number,
  h: number,
): boolean {
  if (!textureHas(scene, key)) return false;
  const tex = scene.textures.get(key);
  if (!tex.has(frame)) tex.add(frame, 0, x, y, w, h);
  return tex.has(frame);
}

export function tileFrameName(sx: number, sy: number): string {
  return `t${sx}_${sy}`;
}

/** Stamp a 16px atlas cell as one 48px world tile. */
export function addTileImage(
  scene: Phaser.Scene,
  col: number,
  row: number,
  key: string,
  sx: number,
  sy: number,
  depth: number,
): Phaser.GameObjects.Image | undefined {
  const frame = tileFrameName(sx, sy);
  if (!ensureFrame(scene, key, frame, sx, sy, 16, 16)) return undefined;
  const img = scene.add.image(
    col * TILE_SIZE + TILE_SIZE / 2,
    row * TILE_SIZE + TILE_SIZE / 2,
    key,
    frame,
  );
  img.setDisplaySize(TILE_SIZE, TILE_SIZE);
  img.setDepth(depth);
  return img;
}

/** Place a packed prop/character cell with foot-origin, integer 3× scale. */
export function addFootSprite(
  scene: Phaser.Scene,
  key: string,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  footX: number,
  footY: number,
  depth: number,
  frame = "prop",
): Phaser.GameObjects.Image | undefined {
  if (!ensureFrame(scene, key, frame, sx, sy, sw, sh)) return undefined;
  const img = scene.add.image(footX, footY, key, frame);
  img.setOrigin(0.5, 1);
  img.setScale(SCALE);
  img.setDepth(depth);
  return img;
}
