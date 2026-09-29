// TextureBridge — chuyển composed canvas (CharacterComposer phase 1) / atlas → Phaser texture key.
// Spike NOTES: DynamicTexture draw-blit + render() flush. Phase 4 wire pivot anchor check.
import { variantKey, type CharacterSelection } from "../assets/character-composer";

/** Compose key deterministically từ selection — same selection → same texture key. */
export function characterTextureKey(sel: CharacterSelection): string {
  // ':' không hợp lệ trong Phaser texture key → dùng '|'.
  return `char-${variantKey(sel)}`.replace(/[^a-zA-Z0-9|-]/g, "-");
}

/**
 * Register composed canvas sheet vào Phaser texture manager.
 * Spike NOTES: DynamicTexture draw-blit; phase 4 dùng CaptureFrame=no (full-screen only).
 * Returns true nếu register thành công, false nếu texture đã tồn tại hoặc canvas invalid.
 */
export function registerComposedTexture(
  scene: Phaser.Scene,
  key: string,
  canvas: HTMLCanvasElement,
): boolean {
  if (scene.textures.exists(key)) return true; // idempotent
  if (!canvas || canvas.width === 0 || canvas.height === 0) return false;
  try {
    scene.textures.addCanvas(key, canvas);
    return true;
  } catch {
    return false;
  }
}

/** Compute atlas frame source rect (test-friendly pure). */
export function atlasFrameRect(
  sheetW: number,
  frameCount: number,
  frameIndex: number,
): { sx: number; sw: number } {
  const sw = sheetW / frameCount;
  return { sx: frameIndex * sw, sw };
}
