// TerrainSpriteRenderer — Maeve pack tiles, 16px cells scaled 3×.
// Falls back to the hand-drawn meadow if sheets are not in TextureManager yet.
import Phaser from "phaser";
import { T, TILE_SIZE, type Season, type TileType } from "@/lib/game/constants";
import { FARM_EMPTY_FIELD } from "@/lib/game/farm-scenery-layout";
import { tileSourceRect, WATER_ANIM_FRAMES, WATER_SHORE_CELLS } from "@/lib/game/assets/tileset-mapper";
import { addTileImage, ensureFrame, textureHas } from "@/lib/game/phaser/texture-frames";
import { SEASON_GRASS_FALLBACK, WINTER_WATER_TINT } from "@/lib/game/season-look";
import { waterShoreDecomp } from "@/lib/game/assets/auto-tile";

/** Màu cát viền bờ (khớp beach sand 255/206/154 của Maeve pack). */
const SAND_RIM_COLOR = 0xffce9a;

const PX = 3;

function seed(col: number, row: number): number {
  return Math.abs((col * 92821 + row * 68917 + 37) % 997);
}

/** Solid water body color per season — covers the grass below the semi-transparent
 * anim tile so the pond/lake/river read as solid water with a dirt rim. */
const WATER_BODY_COLOR: Record<Season, number> = {
  Spring: 0x4d9bd6,
  Summer: 0x2f86c9,
  Fall: 0x4e9fd9,
  Winter: 0xb9d4e8,
};

export class TerrainSpriteRenderer {
  private tiles: Phaser.GameObjects.GameObject[] = [];

  render(
    scene: Phaser.Scene,
    terrain: number[][],
    season: Season,
    zone: string = "farm",
  ): boolean {
    this.destroy();
    const sample = tileSourceRect(T.GRASS, season, zone);
    if (textureHas(scene, sample.sheet) || zone !== "farm") {
      const ok = this.renderSprites(scene, terrain, season, zone);
      if (ok) return true;
    }
    return this.renderFallback(scene, terrain, zone, season);
  }

  private renderSprites(
    scene: Phaser.Scene,
    terrain: number[][],
    season: Season,
    zone: string,
  ): boolean {
    // Nước animation — slice 4 frame + anim dùng chung (idempotent, 1 lần/pass).
    const waterAnim = textureHas(scene, "tile.water.anim");
    if (waterAnim) {
      WATER_ANIM_FRAMES.forEach((f, i) =>
        ensureFrame(scene, "tile.water.anim", `water-anim-${i}`, f.sx, f.sy, 16, 16),
      );
      if (!scene.anims.exists("tile-water-loop")) {
        scene.anims.create({
          key: "tile-water-loop",
          frames: [0, 1, 2, 3].map((i) => ({ key: "tile.water.anim", frame: `water-anim-${i}` })),
          frameRate: 3,
          repeat: -1,
        });
      }
    }
// Pass 1: solid water bodies + sand rim. Water fill từng ô; viền cát mảnh
// thay texture đường gạch cho PATH kề nước. Độ cong bờ do shore cells + patch.
    const waterG = scene.add.graphics().setDepth(-19);
    const sandG = scene.add.graphics().setDepth(-19.5);
    if (zone === "farm") {
      for (let row = 0; row < terrain.length; row++) {
        for (let col = 0; col < terrain[row].length; col++) {
          const type = terrain[row][col];
          const x = col * TILE_SIZE;
          const y = row * TILE_SIZE;
          if (type === T.PATH) {
            // Sand rim: PATH kề nước → tô phẳng màu cát thay texture gạch đường.
            const nearWater =
              terrain[row - 1]?.[col] === T.WATER ||
              terrain[row + 1]?.[col] === T.WATER ||
              terrain[row]?.[col - 1] === T.WATER ||
              terrain[row]?.[col + 1] === T.WATER;
            if (nearWater) {
              sandG.fillStyle(SAND_RIM_COLOR, 1);
              sandG.fillRect(x, y, TILE_SIZE, TILE_SIZE);
            }
            continue;
          }
          if (type !== T.WATER) continue;
          waterG.fillStyle(WATER_BODY_COLOR[season], 0.95);
          waterG.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        }
      }
      this.tiles.push(waterG);
      this.tiles.push(sandG);
    } else {
      waterG.destroy();
      sandG.destroy();
    }
    if (zone === "farm") this.drawGardenBedEdges(scene, terrain);

    // Pass 2: overlay animated / shore tiles on top of the solid body.
    // Góc lõm (đường chéo đất, cardinal nước) được vá bằng quarter-arc cát
    // trên graphics riêng — shore cell không phủ case này.
    const patchG = scene.add.graphics().setDepth(-17.5);
    for (let row = 0; row < terrain.length; row++) {
      for (let col = 0; col < terrain[row].length; col++) {
        const type = terrain[row][col] as TileType;
        if (type === T.WATER && waterAnim) {
          const decomp = waterShoreDecomp(terrain, row, col);
          const shoreCell = decomp.corner
            ? WATER_SHORE_CELLS[`corner-${decomp.corner}`]
            : decomp.edge
              ? WATER_SHORE_CELLS[`edge-${decomp.edge}`]
              : undefined;
          const x = col * TILE_SIZE;
          const y = row * TILE_SIZE;
          // Vá góc lõm bằng quarter-circle cát chấm vào mép nước.
          if (decomp.innerCorners.length > 0 && !shoreCell) {
            patchG.fillStyle(SAND_RIM_COLOR, 1);
            const rr = TILE_SIZE / 2;
            for (const ic of decomp.innerCorners) {
              const px = ic === "ne" || ic === "se" ? x + TILE_SIZE : x;
              const py = ic === "se" || ic === "sw" ? y + TILE_SIZE : y;
              const start = ic === "nw" ? 90 : ic === "ne" ? 180 : ic === "se" ? 270 : 0;
              patchG.slice(px, py, rr, Phaser.Math.DegToRad(start), Phaser.Math.DegToRad(start + 90), false);
              patchG.fillPath();
            }
          }
          const water = shoreCell
            ? addTileImage(scene, col, row, "tile.water.anim", shoreCell.sx, shoreCell.sy, -18)
            : this.addWaterSprite(scene, col, row);
          if (water) {
            if (season === "Winter") water.setTint(WINTER_WATER_TINT);
            this.tiles.push(water);
          }
          continue;
        }
        const src = tileSourceRect(type, season, zone);
        let sx = src.sx;
        let sy = src.sy;
        if (zone === "farm" && type === T.PATH) {
          sy = seed(col, row) % 3 === 0 ? 144 : 128;
        }
        // Đất hoang: trộn biến thể (144,0)/(32,16) để field không thành một bảng phẳng.
        if (zone === "farm" && type === T.FALLOW && seed(col, row) % 4 === 0) {
          sx = 32;
          sy = 16;
        }
        const img = addTileImage(scene, col, row, src.sheet, sx, sy, -20);
        if (img) {
          if (season === "Winter" && type === T.WATER) img.setTint(WINTER_WATER_TINT);
          this.tiles.push(img);
        }
      }
    }
    this.tiles.push(patchG);
    return this.tiles.length > 0;
  }

  /** Viền luống nổi (đất sẫm) chia khung vườn thành 4 khu 3x2 — vườn có chủ ý,
   * không còn là một mảng FALLOW phẳng. Chỉ farm zone, dưới plot/crop sprites. */
  private drawGardenBedEdges(scene: Phaser.Scene, terrain: number[][]): void {
    const g = scene.add.graphics().setDepth(-17);
    const { tx, ty, cols, rows } = FARM_EMPTY_FIELD;
    // Cột giữa dọc + hàng giữa ngang của khung 6x6 → biên 4 luống.
    for (let r = ty; r < ty + rows; r++) {
      if (terrain[r]?.[tx + 3] === undefined || terrain[r][tx + 3] !== T.FALLOW) continue;
      this.strokeTileEdge(g, tx + 3, r, "v");
      this.strokeTileEdge(g, tx + 2, r, "v");
    }
    for (let c = tx; c < tx + cols; c++) {
      if (terrain[ty + 3]?.[c] !== T.FALLOW) continue;
      this.strokeTileEdge(g, c, ty + 3, "h");
      this.strokeTileEdge(g, c, ty + 2, "h");
    }
    this.tiles.push(g);
  }

  private strokeTileEdge(
    g: Phaser.GameObjects.Graphics,
    col: number,
    row: number,
    dir: "h" | "v",
  ): void {
    const x = col * TILE_SIZE;
    const y = row * TILE_SIZE;
    g.fillStyle(0x8a6a42, 0.55);
    if (dir === "h") {
      g.fillRect(x, y + TILE_SIZE - 5, TILE_SIZE, 5);
    } else {
      g.fillRect(x + TILE_SIZE - 5, y, 5, TILE_SIZE);
    }
  }

  /** Sprite (không phải image tĩnh) để chạy anim — vị trí/depth mirror addTileImage. */
  private addWaterSprite(
    scene: Phaser.Scene,
    col: number,
    row: number,
  ): Phaser.GameObjects.Sprite {
    const spr = scene.add.sprite(
      col * TILE_SIZE + TILE_SIZE / 2,
      row * TILE_SIZE + TILE_SIZE / 2,
      "tile.water.anim",
      "water-anim-0",
    );
    spr.setDisplaySize(TILE_SIZE, TILE_SIZE);
    // Trên body solid (-19) để ánh lấp lánh / sóng hiện được; dưới shore/decor (-18...).
    spr.setDepth(-18);
    // Stagger theo toạ độ tile: hàng xóm lệch frame → nước không nhấp nháy đồng loạt.
    spr.play({ key: "tile-water-loop", startFrame: (col + row) % 4 });
    return spr;
  }

  private renderFallback(
    scene: Phaser.Scene,
    terrain: number[][],
    zone: string,
    season: Season,
  ): boolean {
    const ground = scene.add.graphics();
    ground.setDepth(-20);
    for (let row = 0; row < terrain.length; row++) {
      for (let col = 0; col < terrain[row].length; col++) {
        this.drawTile(ground, col, row, terrain[row][col] as TileType, zone, season);
      }
    }
    this.tiles.push(ground);
    return true;
  }

  private drawTile(
    g: Phaser.GameObjects.Graphics,
    col: number,
    row: number,
    type: TileType,
    zone: string,
    season: Season,
  ): void {
    const x = col * TILE_SIZE;
    const y = row * TILE_SIZE;
    const variation = seed(col, row);
    const pal = SEASON_GRASS_FALLBACK[season];

    if (zone === "house") {
      g.fillStyle(type === T.ROCK ? 0x6b4a2b : 0xd7b48c).fillRect(x, y, TILE_SIZE, TILE_SIZE);
      return;
    }
    if (zone === "cave") {
      g.fillStyle(type === T.ROCK ? 0x2c2428 : 0x4a3a40).fillRect(x, y, TILE_SIZE, TILE_SIZE);
      return;
    }
    if (zone === "beach") {
      if (type === T.WATER) {
        g.fillStyle(variation % 2 ? 0x0092dd : 0x2e82ba).fillRect(x, y, TILE_SIZE, TILE_SIZE);
        return;
      }
      g.fillStyle(variation % 2 ? 0xe8d6a8 : 0xd4c08a).fillRect(x, y, TILE_SIZE, TILE_SIZE);
      return;
    }
    if (zone === "village") {
      if (type === T.PATH) {
        g.fillStyle(variation % 2 ? 0xc4a36a : 0xb08958).fillRect(x, y, TILE_SIZE, TILE_SIZE);
        return;
      }
      g.fillStyle(variation % 5 === 0 ? pal.grassAlt : pal.grass).fillRect(x, y, TILE_SIZE, TILE_SIZE);
      return;
    }

    if (type === T.WATER) {
      g.fillStyle(pal.water).fillRect(x, y, TILE_SIZE, TILE_SIZE);
      return;
    }
    if (type === T.FALLOW) {
      g.fillStyle(0xc4a574).fillRect(x, y, TILE_SIZE, TILE_SIZE);
      return;
    }
    if (type === T.TILLED || type === T.TILLED_WET) {
      const base = type === T.TILLED_WET ? 0x9d4c46 : 0xbc6b47;
      g.fillStyle(base).fillRect(x, y, TILE_SIZE, TILE_SIZE);
      return;
    }
    if (type === T.PATH || type === T.BRIDGE) {
      g.fillStyle(pal.path).fillRect(x, y, TILE_SIZE, TILE_SIZE);
      return;
    }
    if (type === T.SAND) {
      g.fillStyle(variation % 2 ? 0xe8d6a8 : 0xd4c08a).fillRect(x, y, TILE_SIZE, TILE_SIZE);
      return;
    }
    if (type === T.ROCK) {
      g.fillStyle(0x6b6560).fillRect(x, y, TILE_SIZE, TILE_SIZE);
      return;
    }
    // Tri-shade base: alt1 every 5th, alt2 every 11th → visible meadow texture.
    const baseColor =
      variation % 11 === 0 ? pal.grassAlt :
      variation % 5 === 0  ? (pal.grass & 0xfefefe) + 0x080808 :  // slight highlight
      pal.grass;
    g.fillStyle(baseColor).fillRect(x, y, TILE_SIZE, TILE_SIZE);
    // Larger tufts: every 12th tile gets a darker grass clump to break monotony.
    if (variation % 12 === 0) {
      g.fillStyle(pal.grassAlt, 0.8).fillRect(x + 3 * PX, y + 4 * PX, 5 * PX, 3 * PX);
      g.fillStyle(pal.grassAlt, 0.8).fillRect(x + 9 * PX, y + 3 * PX, 4 * PX, 4 * PX);
    }
    if (season !== "Winter" && (type === T.GRASS_FLOWER || variation % 17 === 0)) {
      const flowerColor = season === "Fall" ? 0xe07a2a : season === "Spring" ? 0xf4a7c3 : 0xf4d272;
      // Draw a visible flower cluster — 3×3 PX dots at two spots per tile.
      g.fillStyle(flowerColor).fillRect(x + 4 * PX, y + 4 * PX, 3 * PX, 3 * PX);
      g.fillStyle(flowerColor).fillRect(x + 10 * PX, y + 8 * PX, 3 * PX, 3 * PX);
      if (type === T.GRASS_FLOWER) {
        // Full flower tile: add a third petal cluster.
        g.fillStyle(flowerColor).fillRect(x + 7 * PX, y + 2 * PX, 3 * PX, 3 * PX);
      }
    }
  }

  destroy(): void {
    for (const tile of this.tiles) tile.destroy();
    this.tiles = [];
  }

  get count(): number {
    return this.tiles.length;
  }
}
