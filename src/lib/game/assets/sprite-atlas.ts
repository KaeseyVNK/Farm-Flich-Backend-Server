// SpriteAtlas — draw helpers cho cached HTMLImageElement. scale 3x, nearest-neighbor.
// ponytail: 0 prod caller — Phaser scene blit sprite qua TextureBridge thay canvas drawSprite.
// Wire khi non-Phaser canvas (RaidCanvas/Replay) cần sprite blit helper.
import { getAsset } from "./asset-loader";
import { ASSET_TILE, SCALE } from "../constants";

/** Draw whole sprite at dest with TILE_SIZE scale. */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  key: string,
  dx: number,
  dy: number,
): void {
  const img = getAsset(key);
  if (!img) return;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, dx, dy, ASSET_TILE * SCALE, ASSET_TILE * SCALE);
}

/**
 * Draw a single frame from a horizontal sprite sheet.
 * Source rect: frameIndex * ASSET_TILE (native px), full tile height.
 * Dest: scaled by SCALE.
 */
export function drawSpriteFrame(
  ctx: CanvasRenderingContext2D,
  key: string,
  frameIndex: number,
  dx: number,
  dy: number,
  frameW = ASSET_TILE,
  frameH = ASSET_TILE,
): void {
  const img = getAsset(key);
  if (!img) return;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    img,
    frameIndex * frameW,
    0,
    frameW,
    frameH,
    dx,
    dy,
    frameW * SCALE,
    frameH * SCALE,
  );
}

/** Pure: compute source rect (test-friendly, no canvas). */
export function frameSourceRect(frameIndex: number, frameW = ASSET_TILE): { sx: number; sy: number } {
  return { sx: frameIndex * frameW, sy: 0 };
}
