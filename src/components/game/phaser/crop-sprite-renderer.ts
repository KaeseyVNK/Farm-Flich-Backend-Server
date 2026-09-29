// CropSpriteRenderer — render crops trên Phaser path (farm-scene).
// Dùng màu shape tạm (color + stage-based size) — sheet all-crops.png (crop.atlas) được
// manifest stamp "approved" NHƯNG chưa có frame/pivot metadata verified (asset-types:
// dimensions/frame/pivot trống). Per handoff contract §Asset contract, frame/pivot phải là
// metadata chính xác chứ không phải magic number → KHÔNG được guess source-rect; giữ
// geometric fallback này (shape rõ, cây lớn theo stage, dead→nâu) cho tới khi contact-sheet
// approval cung cấp grid rect đúng. Idempotent — destroy() trước rebuild.
import Phaser from "phaser";
import { SCALE, TILE_SIZE, MAP_COLS } from "@/lib/game/constants";
import { CROPS } from "@/lib/game/data";
import { ensureFrame, textureHas } from "@/lib/game/phaser/texture-frames";

export interface CropEntry {
  cropId: string;
  stage: number;
  dead: boolean;
  /** Watered today — visual cue only (slightly darker fill before harvest). */
  watered?: boolean;
}

// Watered overlay: tưới hôm nay → đậm màu hơn (như đất ướt). Dùng với stage < last vì
// cây ready vẫn hiện màu harvest. Không phải là dữ liệu authority — chỉ presentation.
const WATERED_DARKEN = 0.85;

function shadeHex(hex: number, factor: number): number {
  const r = Math.round(((hex >> 16) & 0xff) * factor) << 16;
  const g = Math.round(((hex >> 8) & 0xff) * factor) << 8;
  const b = Math.round((hex & 0xff) * factor);
  return r | g | b;
}

// Chỉ dùng fruitColor — nhận kiểu hẹp để khớp stampFallback ({ stages, fruitColor })
// lẫn def đầy đủ trong CROPS ({ color, fruitColor, ... }).
function cropHex(def: { fruitColor: string }): number {
  return parseInt(def.fruitColor.replace("#", ""), 16);
}

export class CropSpriteRenderer {
  private crops: Phaser.GameObjects.GameObject[] = [];

  /** Render crops từ farm.crops. Idempotent — destroy trước rebuild. */
  render(scene: Phaser.Scene, crops: Record<number, CropEntry>): void {
    this.destroy();
    for (const key of Object.keys(crops)) {
      const idx = Number(key);
      const c = crops[idx];
      const def = CROPS[c.cropId];
      if (!def) continue;
      const tx = idx % MAP_COLS;
      const ty = Math.floor(idx / MAP_COLS);
      const px = tx * TILE_SIZE + TILE_SIZE / 2;
      const py = ty * TILE_SIZE + TILE_SIZE / 2;
      const sheet = `crop.${c.cropId}`;
      if (textureHas(scene, sheet) && typeof scene.add.image === "function") {
        this.stampSheet(scene, sheet, c, px, py, ty);
        continue;
      }
      this.stampFallback(scene, def, c, px, py, ty);
    }
  }

  private stampSheet(
    scene: Phaser.Scene,
    sheet: string,
    c: CropEntry,
    px: number,
    py: number,
    ty: number,
  ): void {
    const src = scene.textures.get(sheet).getSourceImage() as { width?: number };
    const cols = Math.max(1, Math.floor((src.width ?? 16) / 16));
    const frameIdx = c.dead ? 0 : Math.min(c.stage + 1, cols - 1);
    const frame = `s${frameIdx}`;
    if (!ensureFrame(scene, sheet, frame, frameIdx * 16, 0, 16, 16)) return;
    const plant = scene.add.image(px, py + TILE_SIZE / 2, sheet, frame);
    plant.setOrigin(0.5, 1);
    plant.setScale(SCALE);
    if (c.dead) plant.setTint(0x8a6238);
    else if (c.watered) plant.setTint(0xd0d0d0);
    plant.setDepth(ty * TILE_SIZE + TILE_SIZE);
    this.crops.push(plant);
  }

  private stampFallback(
    scene: Phaser.Scene,
    def: { stages: number; fruitColor: string },
    c: CropEntry,
    px: number,
    py: number,
    ty: number,
  ): void {
    const ratio = 0.25 + Math.min(1, c.stage / Math.max(1, def.stages - 1)) * 0.45;
    const size = TILE_SIZE * ratio;
    let fill = c.dead ? 0x8a6238 : cropHex(def);
    const isReady = c.stage >= def.stages - 1;
    if (!c.dead && c.watered && !isReady) {
      fill = shadeHex(fill, WATERED_DARKEN);
    }
    const plant = scene.add.graphics();
    plant.setPosition(px, py);
    const stem = Math.max(3, Math.round(size * 0.16));
    const height = Math.round(size * 1.15);
    const leaf = Math.max(4, Math.round(size * 0.28));
    const darkLeaf = shadeHex(fill, c.dead ? 0.78 : 0.62);
    plant.fillStyle(0x3a3028, 0.22).fillRect(-leaf, 3, leaf * 2, 3);
    plant.fillStyle(c.dead ? 0x6f5136 : 0x2f6b3d).fillRect(-Math.ceil(stem / 2), -height / 2, stem, height / 2 + 5);
    plant.fillStyle(darkLeaf).fillRect(-leaf, -height / 2 + leaf, leaf, leaf);
    plant.fillStyle(darkLeaf).fillRect(1, -height / 2 + leaf * 1.6, leaf, leaf);
    plant.fillStyle(fill).fillRect(-Math.round(leaf / 3), -height / 2, leaf, leaf);
    if (isReady && !c.dead) {
      plant.fillStyle(0xf8e5a6).fillRect(0, -height / 2 + Math.round(leaf / 2), Math.max(2, Math.round(leaf / 2)), Math.max(2, Math.round(leaf / 2)));
    }
    plant.setDepth(ty * TILE_SIZE + TILE_SIZE);
    this.crops.push(plant);
  }

  destroy(): void {
    for (const c of this.crops) c.destroy();
    this.crops = [];
  }

  get count(): number {
    return this.crops.length;
  }
}
