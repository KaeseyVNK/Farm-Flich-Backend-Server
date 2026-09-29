// Phaser 4 game config. ADR-001 (render config — spike-confirmed keys).
// pixelArt: true, Scale.RESIZE (canvas = parent, HUD là HTML), CENTER_BOTH, antialias off.
// Spike NOTES: v4 adds smoothPixelArt (WebGL smooth-upscale) — keep off cho crisp pixel.
// TILE_SIZE 48 = 16 native × 3 scale.
// v4 renderer: `type` MUST be a numeric CONST (AUTO=0/CANVAS=1/WEBGL=2/HEADLESS=3),
// NOT the v3 string "WebGL" — string throws "Unknown value for renderer type".
import { GAME_VIEW_WIDTH, GAME_VIEW_HEIGHT } from "../constants";

/** Phaser.CONST.WEBGL — numeric renderer type (v4 requires number, not string). */
const WEBGL = 2;

export function buildGameConfig(parent: HTMLElement): Record<string, unknown> {
  return {
    type: WEBGL, // Phaser.CONST.WEBGL (numeric; string "WebGL" invalid in v4)
    parent,
    pixelArt: true,
    antialias: false,
    roundPixels: true,
    // Match grass fill (atlas 144,32) so FIT/RESIZE letterbox không phải vệt lime.
    backgroundColor: 0x79bf56,
    transparent: false,
    // Internal resolution = game viewport (a window into the world), NOT the
    // world size. Using MAP_COLS*TILE_SIZE here shrinks the whole 2880×2880
    // world into the viewport → character invisible (tiny dot) + letterboxed.
    width: GAME_VIEW_WIDTH,
    height: GAME_VIEW_HEIGHT,
    scale: {
      // RESIZE: canvas = parent. FIT để lại vệt cỏ giả dưới HUD trên viewport cao.
      // HUD là HTML overlay — không phụ thuộc internal 960×704.
      mode: 5, // Phaser.Scale.RESIZE
      autoCenter: 2, // Phaser.Scale.CENTER_BOTH
    },
    scene: [], // scenes add khi boot (FarmScene/BootScene) — tránh import cycle ở config
    fps: { target: 60, min: 30 }, // FPS gate 60 desktop+mobile (user decision)
    audio: { disableWebAudio: false }, // context share Tone.js phase 8 (spike VERIFIED)
    // ponytail: RenderNodes/Lighting/Filter default; TilemapGPULayer eval phase 3.
  };
}
