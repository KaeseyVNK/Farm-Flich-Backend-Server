// ZoneSceneryRenderer — generic data-driven sprite renderer for any zone.
// Mirrors FarmSceneryRenderer's lifecycle: render() destroys the previous
// pass first (idempotent), destroy() kills sway tweens BEFORE sprites
// (Phaser 4 tweens do NOT die with their targets).
// The scene is the structural SceneryScene so unit tests need no Phaser
// import; at runtime the real Phaser.Scene is passed and cast only for
// the shared helpers (addFootSprite / textureHas / attachSway).
import type Phaser from "phaser";
import { SCALE, TILE_SIZE, type Season } from "@/lib/game/constants";
import { getZoneScenery } from "@/lib/game/scenery";
import type {
  SceneryGraphics,
  SceneryImage,
  SceneryScene,
  SpritePlacement,
} from "@/lib/game/scenery/types";
import { addFootSprite, textureHas, textureNativeSize } from "@/lib/game/phaser/texture-frames";
import { attachSway } from "./foliage-sway";

export class ZoneSceneryRenderer {
  private layers: Array<SceneryImage | SceneryGraphics> = [];
  /** Scene của render() gần nhất — cần cho killTweensOf trong destroy(). */
  private sceneCtx: SceneryScene | undefined;
  /** Sprites đang có tween sway — kill tween tường minh khi destroy. */
  private swayImgs: SceneryImage[] = [];
  private season: Season = "Spring";
  private swayEnabled = false;

  render(
    scene: SceneryScene,
    zoneId: string,
    season: Season = "Spring",
    opts: { reducedMotion?: boolean } = {},
  ): void {
    this.destroy();
    this.sceneCtx = scene;
    this.season = season;
    // reduced-motion: không sway (e2e capture đi qua đây).
    this.swayEnabled = !opts.reducedMotion;
    const scenery = getZoneScenery(zoneId);
    if (!scenery) return;
    for (const placement of scenery.placements) {
      this.drawPlacement(scene, placement);
    }
  }

  private drawPlacement(scene: SceneryScene, placement: SpritePlacement): void {
    const depth = (placement.ty + placement.rows) * TILE_SIZE + (placement.depthOffset ?? 0);
    const footX = (placement.tx + placement.cols / 2) * TILE_SIZE;
    const footY = (placement.ty + placement.rows) * TILE_SIZE;
    if (textureHas(scene as unknown as Phaser.Scene, placement.key)) {
      // Houses are single-sprite PNGs — crop-to-footprint sliced the roof off.
      // Other keys stay footprint-native so walk-cycle sheets keep a first cell.
      let sw = Math.max(1, Math.round((placement.cols * TILE_SIZE) / SCALE));
      let sh = Math.max(1, Math.round((placement.rows * TILE_SIZE) / SCALE));
      if (placement.key.startsWith("obj.house")) {
        const native = textureNativeSize(scene as unknown as Phaser.Scene, placement.key);
        if (native) {
          sw = native.w;
          sh = native.h;
        }
      }
      const img = addFootSprite(
        scene as unknown as Phaser.Scene,
        placement.key, 0, 0, sw, sh,
        footX, footY, depth,
      );
      if (img) {
        if (placement.sway && this.swayEnabled) {
          attachSway(scene as unknown as Phaser.Scene, img, placement.tx * 31 + placement.ty);
          this.swayImgs.push(img);
        }
        this.layers.push(img);
        return;
      }
    }
    // Fallback: rect màu phẳng phủ footprint, cùng depth với sprite tương ứng.
    const g = scene.add.graphics();
    g.setDepth(depth)
      .fillStyle(placement.fallbackColor)
      .fillRect(
        placement.tx * TILE_SIZE,
        placement.ty * TILE_SIZE,
        placement.cols * TILE_SIZE,
        placement.rows * TILE_SIZE,
      );
    this.layers.push(g);
  }

  destroy(): void {
    // Tween KHÔNG tự chết theo target trong Phaser 4 → kill trước khi destroy
    // sprite, nếu không tween repeat -1 chạy mãi trên object đã chết.
    if (this.sceneCtx?.tweens) {
      for (const img of this.swayImgs) this.sceneCtx.tweens.killTweensOf(img);
    }
    this.swayImgs = [];
    for (const layer of this.layers) layer.destroy();
    this.layers = [];
    this.sceneCtx = undefined;
  }
}
