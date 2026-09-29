// BootScene — preload assets vào Phaser TextureManager. ADR-002 scene graph entry.
// AssetLoader (phase 1) preload HTMLImageElement; ở đây bridge sang Phaser texture keys.
// Scene lifecycle: state reset tại init() (không constructor). Bridge unsub tại shutdown.
//
// Race fix (audit UI bug "canvas phẳng"): GameCanvas mount vô điều kiện cùng lúc
// StartScreen mới bắt đầu loadAll() async → preload() chạy TRƯỚC khi cache có asset
// → 0 texture đăng ký → FarmScene fallback rectangle placeholder (canvas phẳng vĩnh viễn).
// create() always awaits loadAll() (full manifest, not "any key cached") then
// registers textures and starts FarmScene. preload() is the fast path when
// StartScreen already filled the cache — loadAll() is then a no-op.
import Phaser from "phaser";
import { ASSET_MANIFEST } from "@/lib/game/assets/asset-manifest";
import { getAsset, loadAll } from "@/lib/game/assets/asset-loader";
import { FARM_BACKDROP_KEY, FARM_BACKDROP_URL } from "@/lib/game/phaser/farm-backdrop";

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
    // Phaser 4.2.1: Systems constructor KHÔNG propagate config.key vào
    // sys.settings.key → SceneManager đăng ký mọi scene với key 'default'.
    // Set thủ công để getScene('BootScene') hoạt động. Guard sys?.settings
    // cho unit test (mock phaser không có sys).
    if (this.sys?.settings) this.sys.settings.key = "BootScene";
  }

  init(): void {
    // ADR-002: state reset tại init (New Game+ reuse scene instance).
  }

  /** Register cached images vào Phaser TextureManager (idempotent per key). */
  private registerCachedImages(): void {
    for (const entry of ASSET_MANIFEST) {
      const img = getAsset(entry.key);
      if (img && img.src && img.complete !== false && !this.textures.exists(entry.key)) {
        try {
          this.textures.addImage(entry.key, img);
        } catch (err) {
          console.warn(`[boot] texture add failed: ${entry.key}`, err);
        }
      }
    }
  }

  private booted = false;

  preload(): void {
    // Fast path: StartScreen đã loadAll xong trước khi BootScene chạy → register ngay.
    this.registerCachedImages();
    this.load.image(FARM_BACKDROP_KEY, FARM_BACKDROP_URL);
  }

  async create(): Promise<void> {
    if (this.booted) return; // guard re-run (scene.restart cùng instance)
    this.booted = true;
    // Always await the full manifest. `anyLoaded` was the wrong gate: one small
    // PNG in cache made FarmScene start while cottage/tree sheets were still
    // in-flight, so scenery locked to graphics placeholders for the session.
    await loadAll();
    this.registerCachedImages();
    this.scene.start("FarmScene");
  }
}
