// FarmSceneryRenderer — "Trại Sữa & Trái Cây Đồi Xanh" (Green Hill Dairy & Orchard).
// Visual-only: crop/save/interact authority stays in the stores.
import Phaser from "phaser";
import { TILE_SIZE, type Season } from "@/lib/game/constants";
import { useAnimalStore, type AnimalKind } from "@/store/animalStore";
import {
  FARM_BARN,
  FARM_BARNYARD_FENCES,
  FARM_BARNYARD_GATE,
  FARM_BARNYARD_PROPS,
  FARM_BRIDGE_NORTH,
  FARM_BRIDGE_SOUTH,
  FARM_COOP,
  FARM_CRAFT_PROPS,
  FARM_DECOR_ANIMALS,
  FARM_GREENHOUSE,
  FARM_GREENHOUSE_FENCE,
  FARM_GREENHOUSE_PROPS,
  FARM_HAY_SHED,
  FARM_HOUSE,
  FARM_HOUSE_PATIO,
  FARM_LOGGING_PROPS,
  FARM_MEADOW_PROPS,
  FARM_ORCHARD_BEEHIVES,
  FARM_ORCHARD_FENCES,
  FARM_PIER,
  FARM_PLOT_FENCE,
  FARM_PLOT_GATE,
  FARM_SHORE_PROPS,
  FARM_SHOWCASE_CROPS,
  FARM_SHRINE,
  FARM_SHRINE_PROPS,
  FARM_STABLE,
  FARM_STUMPS,
  FARM_SW_PICNIC_FENCE,
  FARM_TREES,
  FARM_WELL,
  FARM_YARD_PROPS,
  ORCHARD_TREES,
  type FarmPropSpot,
} from "@/lib/game/farm-scenery-layout";
import {
  addFootSprite,
  addTileImage,
  ensureFrame,
  textureHas,
} from "@/lib/game/phaser/texture-frames";
import { seasonSheet } from "@/lib/game/assets/tileset-mapper";
import {
  MAPLE_SEASON_FRAME,
  PINE_SEASON_FRAME,
  SEASON_TREE_GFX,
} from "@/lib/game/season-look";
import { drawCaveEntities, drawZoneLabels } from "./zone-decor-renderer";
import { ZoneSceneryRenderer } from "./zone-scenery-renderer";
import { attachSway } from "./foliage-sway";
import { spawnAmbient } from "./ambient-particles";

const PX = 3;

export class FarmSceneryRenderer {
  private layers: Phaser.GameObjects.GameObject[] = [];
  /** Away-zone (house/village/cave/beach) placements — data-driven sprites. */
  private zoneRenderer = new ZoneSceneryRenderer();
  private season: Season = "Spring";
  /** Scene của render() gần nhất — cần cho killTweensOf trong destroy(). */
  private sceneCtx: Phaser.Scene | undefined;
  /** Sprites đang có tween sway — kill tween tường minh khi destroy. */
  private swayImgs: Phaser.GameObjects.Image[] = [];
  private swayEnabled = false;
  private ambient: { destroy(): void } | undefined;
  private worldWidth = 60 * TILE_SIZE;
  private worldHeight = 60 * TILE_SIZE;
  private wellRepaired = false;

  render(
    scene: Phaser.Scene,
    zoneId: string = "farm",
    season: Season = "Spring",
    opts: {
      reducedMotion?: boolean;
      worldWidth?: number;
      worldHeight?: number;
      wellRepaired?: boolean;
    } = {},
  ): void {
    this.destroy();
    this.sceneCtx = scene;
    this.season = season;
    this.wellRepaired = !!opts.wellRepaired;
    this.swayEnabled = !opts.reducedMotion;
    this.worldWidth = opts.worldWidth ?? this.worldWidth;
    this.worldHeight = opts.worldHeight ?? this.worldHeight;

    if (zoneId !== "farm") {
      this.zoneRenderer.render(scene, zoneId, season, { reducedMotion: !this.swayEnabled });
      this.layers = drawZoneLabels(scene, zoneId);
      if (zoneId === "cave") this.layers.push(...drawCaveEntities(scene));
    } else {
      const packed = textureHas(scene, "obj.house.3") && textureHas(scene, "obj.tree");
      if (packed) this.renderSprites(scene);
      else this.renderFallback(scene);
      this.drawSignboard(scene);
      this.drawStable(scene);
    }

    // Ambient theo mùa (bướm/lá/tuyết)
    this.ambient = spawnAmbient(scene, {
      zone: zoneId,
      season,
      reducedMotion: !!opts.reducedMotion,
      worldWidth: this.worldWidth,
      worldHeight: this.worldHeight,
    });
  }

  private renderSprites(scene: Phaser.Scene): void {
    this.drawHousePatio(scene);
    this.drawHouse(scene);
    this.drawWell(scene);
    this.drawBridges(scene);
    this.drawPier(scene);
    this.drawWaterLife(scene);

    // Forest trees & Island tree
    FARM_TREES.forEach((tree, i) => this.drawTree(scene, tree.tx, tree.ty, i, tree.pine));
    this.drawStumps(scene);

    // Fences
    this.drawFenceRing(
      scene,
      FARM_PLOT_FENCE.tx,
      FARM_PLOT_FENCE.ty,
      FARM_PLOT_FENCE.cols,
      FARM_PLOT_FENCE.rows,
      { from: FARM_PLOT_GATE.tx0, to: FARM_PLOT_GATE.tx1 },
    );
    for (const fence of FARM_ORCHARD_FENCES) {
      this.drawFenceRing(scene, fence.tx, fence.ty, fence.cols, fence.rows);
    }
    for (const fence of FARM_SW_PICNIC_FENCE) {
      this.drawFenceRing(scene, fence.tx, fence.ty, fence.cols, fence.rows);
    }
    for (const fence of FARM_GREENHOUSE_FENCE) {
      this.drawFenceRing(scene, fence.tx, fence.ty, fence.cols, fence.rows);
    }

    this.drawBarnyard(scene);
    this.drawCraftCorner(scene);
    this.drawCropShowcase(scene);
    this.drawOrchard(scene);
    this.drawPicnicMeadows(scene);
    this.drawLoggingCamp(scene);
    this.drawGreenhouse(scene);
    this.drawAncientShrine(scene);
    this.drawYardProps(scene);
    this.drawPropSpots(scene, FARM_SHORE_PROPS);
    this.drawAnimals(scene);
    this.drawWildflowers(scene);

    if (this.season === "Spring") this.drawBlossoms(scene);
    if (this.season === "Winter") this.drawSnowTufts(scene);
  }

  /** Biển hiệu lớn bằng gỗ góc trên cùng bên trái. */
  private drawSignboard(scene: Phaser.Scene): void {
    const x = 3 * TILE_SIZE;
    const y = 1 * TILE_SIZE;
    const w = 5.5 * TILE_SIZE;
    const h = 2.8 * TILE_SIZE;

    const g = scene.add.graphics().setDepth(y + h + 10);
    // Bóng đổ biển hiệu
    g.fillStyle(0x1a0e08, 0.35);
    g.fillRoundedRect(x + 4, y + 6, w, h, 8);

    // Khung gỗ nâu viền ngoài
    g.fillStyle(0x543621, 1);
    g.fillRoundedRect(x, y, w, h, 8);
    // Nền gỗ sáng bên trong
    g.fillStyle(0xa87144, 1);
    g.fillRoundedRect(x + 4, y + 4, w - 8, h - 8, 6);
    g.lineStyle(2, 0x3d2312, 0.9);
    g.strokeRoundedRect(x + 4, y + 4, w - 8, h - 8, 6);

    // Cột chống biển hiệu
    g.fillStyle(0x3d2312, 1);
    g.fillRect(x + 16, y + h - 2, 8, 18);
    g.fillRect(x + w - 24, y + h - 2, 8, 18);

    this.layers.push(g);

    // Biểu tượng bình sữa bên trái & anh đào bên phải
    const milk = scene.add.text(x + 12, y + 16, "🥛", { fontSize: "16px" }).setDepth(y + h + 12);
    const cherry = scene.add.text(x + w - 28, y + 16, "🍒", { fontSize: "16px" }).setDepth(y + h + 12);
    this.layers.push(milk, cherry);

    // Chữ biển hiệu
    const title1 = scene.add.text(x + w / 2, y + 15, "Trại Sữa & Trái Cây", {
      fontFamily: "Arial, sans-serif",
      fontSize: "13px",
      fontStyle: "bold",
      color: "#fff5ea",
      stroke: "#3d2312",
      strokeThickness: 3,
    }).setOrigin(0.5, 0.5).setDepth(y + h + 12);

    const title2 = scene.add.text(x + w / 2, y + 34, "ĐỒI XANH", {
      fontFamily: "Arial, sans-serif",
      fontSize: "15px",
      fontStyle: "bold",
      color: "#ffeb99",
      stroke: "#3d2312",
      strokeThickness: 3,
    }).setOrigin(0.5, 0.5).setDepth(y + h + 12);

    const sub = scene.add.text(x + w / 2, y + 52, "Green Hill Dairy & Orchard", {
      fontFamily: "Arial, sans-serif",
      fontSize: "9px",
      fontStyle: "italic",
      color: "#f0dfcf",
      stroke: "#26150a",
      strokeThickness: 2,
    }).setOrigin(0.5, 0.5).setDepth(y + h + 12);

    this.layers.push(title1, title2, sub);
  }

  private drawGroundShadow(
    scene: Phaser.Scene,
    footX: number,
    footY: number,
    radiusX: number,
    radiusY: number,
  ): void {
    const g = scene.add.graphics().setDepth(footY - 1);
    g.fillStyle(0x1a0e08, 0.28);
    g.fillEllipse(footX, footY - 4, radiusX, radiusY);
    this.layers.push(g);
  }

  /** Sân đá lát cobblestone trước nhà chính. */
  private drawHousePatio(scene: Phaser.Scene): void {
    const g = scene.add.graphics().setDepth(-18);
    const x0 = FARM_HOUSE_PATIO.tx * TILE_SIZE;
    const y0 = FARM_HOUSE_PATIO.ty * TILE_SIZE;
    const w = FARM_HOUSE_PATIO.cols * TILE_SIZE;
    const h = FARM_HOUSE_PATIO.rows * TILE_SIZE;

    g.fillStyle(0x8a8479, 0.92);
    g.fillRoundedRect(x0, y0, w, h, 10);
    g.lineStyle(2, 0x5a544b, 0.6);
    g.strokeRoundedRect(x0, y0, w, h, 10);

    g.lineStyle(1, 0x6e685f, 0.4);
    for (let r = y0 + 16; r < y0 + h; r += 16) {
      g.lineBetween(x0 + 4, r, x0 + w - 4, r);
    }
    for (let c = x0 + 24; c < x0 + w; c += 24) {
      g.lineBetween(c, y0 + 4, c, y0 + h - 4);
    }
    this.layers.push(g);
  }

  /** 2 Cây cầu gỗ bắc qua sông. */
  private drawBridges(scene: Phaser.Scene): void {
    const hasBridge = textureHas(scene, "tile.beach.bridge");
    if (!hasBridge) return;

    // North bridge
    for (let r = 0; r < FARM_BRIDGE_NORTH.rows; r++) {
      for (let c = 0; c < FARM_BRIDGE_NORTH.cols; c++) {
        const img = addTileImage(scene, FARM_BRIDGE_NORTH.tx + c, FARM_BRIDGE_NORTH.ty + r, "tile.beach.bridge", 32, 48, (FARM_BRIDGE_NORTH.ty + r) * TILE_SIZE);
        if (img) this.layers.push(img);
      }
    }

    // South bridge
    for (let r = 0; r < FARM_BRIDGE_SOUTH.rows; r++) {
      for (let c = 0; c < FARM_BRIDGE_SOUTH.cols; c++) {
        const img = addTileImage(scene, FARM_BRIDGE_SOUTH.tx + c, FARM_BRIDGE_SOUTH.ty + r, "tile.beach.bridge", 32, 48, (FARM_BRIDGE_SOUTH.ty + r) * TILE_SIZE);
        if (img) this.layers.push(img);
      }
    }
  }

  /** Cầu tàu câu cá ở ao tây. */
  private drawPier(scene: Phaser.Scene): void {
    const hasBridge = textureHas(scene, "tile.beach.bridge");
    if (!hasBridge) return;
    for (let r = 0; r < FARM_PIER.rows; r++) {
      for (let c = 0; c < FARM_PIER.cols; c++) {
        const img = addTileImage(scene, FARM_PIER.tx + c, FARM_PIER.ty + r, "tile.beach.bridge", 32, 48, (FARM_PIER.ty + r) * TILE_SIZE);
        if (img) this.layers.push(img);
      }
    }
  }

  /** Sinh vật dưới nước: cá, hoa súng, thuyền canoe. */
  private drawWaterLife(scene: Phaser.Scene): void {
    const g = scene.add.graphics().setDepth(-10);

    const boatX = 31 * TILE_SIZE;
    const boatY = 12 * TILE_SIZE + 10;
    g.fillStyle(0x1a0e08, 0.35).fillEllipse(boatX + 24, boatY + 12, 38, 10);
    g.fillStyle(0x6b4423, 1).fillRoundedRect(boatX, boatY, 48, 16, 6);
    g.fillStyle(0x8a5a32, 1).fillRoundedRect(boatX + 4, boatY + 2, 40, 12, 4);
    g.fillStyle(0x4a2e15, 1).fillRect(boatX + 20, boatY + 3, 8, 10);

    const fishSpots = [
      [29, 14], [32, 13], [36, 14], [38, 16], [30, 18],
      [35, 18], [37, 19], [8, 23], [10, 24], [11, 22],
    ];
    for (const [fx, fy] of fishSpots) {
      const px = fx * TILE_SIZE + 16;
      const py = fy * TILE_SIZE + 16;
      g.fillStyle(0x4080b0, 0.8).fillEllipse(px, py, 6, 3);
      g.fillStyle(0x60b0e0, 0.9).fillTriangle(px - 3, py, px - 6, py - 2, px - 6, py + 2);
    }

    const lilySpots = [
      [28, 15], [36, 13], [39, 17], [31, 18], [8, 24], [11, 23],
    ];
    for (const [lx, ly] of lilySpots) {
      const px = lx * TILE_SIZE + 20;
      const py = ly * TILE_SIZE + 20;
      g.fillStyle(0x3a7d44, 0.85).fillCircle(px, py, 5);
      g.fillStyle(0xffaacc, 0.9).fillCircle(px + 1, py - 1, 2);
    }

    this.layers.push(g);
  }

  private drawHouse(scene: Phaser.Scene): void {
    const footX = (FARM_HOUSE.tx + FARM_HOUSE.cols / 2) * TILE_SIZE;
    const footY = (FARM_HOUSE.ty + FARM_HOUSE.rows) * TILE_SIZE;
    this.drawGroundShadow(scene, footX, footY, 85, 18);
    const img = addFootSprite(
      scene, "obj.house.3", 0, 0, 128, 112,
      footX, footY, footY, "house",
    );
    if (img) this.layers.push(img);

    // Khói ống khói
    if (this.swayEnabled) {
      this.spawnChimneySmoke(scene, footX + 22, footY - 104);
    }
  }

  private spawnChimneySmoke(scene: Phaser.Scene, sx: number, sy: number): void {
    const smokeG = scene.add.graphics().setDepth(sy + 300);
    smokeG.fillStyle(0xefede8, 0.4);
    smokeG.fillCircle(sx, sy, 4);
    this.layers.push(smokeG);
    scene.tweens.add({
      targets: smokeG,
      x: { from: 0, to: 12 },
      y: { from: 0, to: -28 },
      alpha: { from: 0.5, to: 0 },
      scale: { from: 1, to: 2.4 },
      duration: 2400,
      repeat: -1,
      ease: "Sine.easeOut",
    });
  }

  private drawWell(scene: Phaser.Scene): void {
    if (!textureHas(scene, "obj.well")) return;
    const footX = (FARM_WELL.tx + FARM_WELL.cols / 2) * TILE_SIZE;
    const footY = (FARM_WELL.ty + FARM_WELL.rows) * TILE_SIZE;

    // Nền đá tròn quanh giếng
    const stoneG = scene.add.graphics().setDepth(-15);
    stoneG.fillStyle(0x756758, 0.45).fillCircle(footX, footY - 8, 38);
    stoneG.lineStyle(1.5, 0x4a3d31, 0.6).strokeCircle(footX, footY - 8, 38);
    this.layers.push(stoneG);

    this.drawGroundShadow(scene, footX, footY, 32, 14);
    const img = addFootSprite(
      scene, "obj.well", 0, 0, 32, 48,
      footX, footY, footY, "well0",
    );
    if (img) {
      const bucket = addFootSprite(
        scene, "obj.farm.waterbuckets", 0, 0, 16, 16,
        footX + 22, footY, footY, "well-bucket",
      );
      if (bucket) this.layers.push(bucket);
      this.layers.push(img);
    }
  }

  /** Chuồng trại gia súc & đồng cỏ. */
  private drawBarnyard(scene: Phaser.Scene): void {
    // 1. Barn House (obj.house.3)
    const barnFootX = (FARM_BARN.tx + FARM_BARN.cols / 2) * TILE_SIZE;
    const barnFootY = (FARM_BARN.ty + FARM_BARN.rows) * TILE_SIZE;
    this.drawGroundShadow(scene, barnFootX, barnFootY, 90, 16);
    const barn = addFootSprite(
      scene, "obj.house", 0, 0, 80, 112,
      barnFootX, barnFootY, barnFootY, "barn",
    );
    if (barn) this.layers.push(barn);

    // 2. Coop / Rustic Cottage (obj.house.6)
    const coopFootX = (FARM_COOP.tx + FARM_COOP.cols / 2) * TILE_SIZE;
    const coopFootY = (FARM_COOP.ty + FARM_COOP.rows) * TILE_SIZE;
    this.drawGroundShadow(scene, coopFootX, coopFootY, 75, 14);
    const coop = addFootSprite(
      scene, "obj.house.6", 0, 0, 80, 96,
      coopFootX, coopFootY, coopFootY, "coop",
    );
    if (coop) this.layers.push(coop);

    // 3. Hay shed in top right corner of pasture
    const shedX = (FARM_HAY_SHED.tx + FARM_HAY_SHED.cols / 2) * TILE_SIZE;
    const shedY = (FARM_HAY_SHED.ty + FARM_HAY_SHED.rows) * TILE_SIZE;
    this.drawGroundShadow(scene, shedX, shedY, 45, 12);
    const shedG = scene.add.graphics().setDepth(shedY);
    shedG.fillStyle(0x734828, 1).fillRect(shedX - 24, shedY - 28, 48, 28);
    shedG.fillStyle(0xb5893e, 1).fillTriangle(shedX - 28, shedY - 26, shedX, shedY - 44, shedX + 28, shedY - 26);
    shedG.fillStyle(0xecd066, 1).fillRect(shedX - 16, shedY - 20, 32, 18); // rơm vàng bên trong
    this.layers.push(shedG);

    // 4. Props & Fences
    this.drawPropSpots(scene, FARM_BARNYARD_PROPS);
    for (const fence of FARM_BARNYARD_FENCES) {
      this.drawFenceRing(scene, fence.tx, fence.ty, fence.cols, fence.rows, {
        from: FARM_BARNYARD_GATE.tx0,
        to: FARM_BARNYARD_GATE.tx1,
      });
    }
  }

  private drawCraftCorner(scene: Phaser.Scene): void {
    this.drawPropSpots(scene, FARM_CRAFT_PROPS);
  }

  /** Hiển thị các luống rau củ & bí ngô sinh động. */
  private drawCropShowcase(scene: Phaser.Scene): void {
    for (const c of FARM_SHOWCASE_CROPS) {
      if (textureHas(scene, c.key)) {
        const footX = c.tx * TILE_SIZE + TILE_SIZE / 2;
        const footY = c.ty * TILE_SIZE + TILE_SIZE;
        const img = addFootSprite(scene, c.key, 64, 0, 16, 32, footX, footY, footY - 1, "crop");
        if (img) this.layers.push(img);
      }
    }
  }

  /** Vườn cây ăn trái & Tổ ong. */
  private drawOrchard(scene: Phaser.Scene): void {
    const rowSheets = ["tree.apple", "tree.orange", "tree.peach"];
    const frameX: Record<string, number> = {
      "tree.apple": 192,
      "tree.orange": 160,
      "tree.peach": 160,
    };

    ORCHARD_TREES.forEach((tree, i) => {
      const rowIndex = Math.floor(i / 4);
      const sheet = rowSheets[rowIndex % rowSheets.length];
      const sx = frameX[sheet] ?? 160;
      const footX = tree.tx * TILE_SIZE + TILE_SIZE;
      const footY = (tree.ty + 2) * TILE_SIZE;

      this.drawGroundShadow(scene, footX, footY, 36, 12);
      const img = addFootSprite(scene, sheet, sx, 0, 32, 48, footX, footY, footY, "orchard-tree");
      if (img) {
        if (this.swayEnabled) {
          attachSway(scene, img, tree.tx * 31 + tree.ty);
          this.swayImgs.push(img);
        }
        this.layers.push(img);
      }
    });

    // Vẽ các thùng tổ ong bên dưới cây
    this.drawPropSpots(scene, FARM_ORCHARD_BEEHIVES);
  }

  /** 2 Khu Dã ngoại. */
  private drawPicnicMeadows(scene: Phaser.Scene): void {
    this.drawPropSpots(scene, FARM_MEADOW_PROPS);

    // Vẽ thảm caro dã ngoại lớn ở khu picnic đông
    const g = scene.add.graphics().setDepth(22 * TILE_SIZE - 5);
    const px = 35 * TILE_SIZE + 12;
    const py = 22 * TILE_SIZE + 8;
    const pw = 4 * TILE_SIZE;
    const ph = 3 * TILE_SIZE;

    g.fillStyle(0xfde8ee, 1).fillRect(px, py, pw, ph);
    g.fillStyle(0xf498b2, 0.7);
    for (let r = 0; r < ph; r += 16) {
      for (let c = 0; c < pw; c += 16) {
        if ((Math.floor(r / 16) + Math.floor(c / 16)) % 2 === 0) {
          g.fillRect(px + c, py + r, 16, 16);
        }
      }
    }
    g.lineStyle(2, 0xeb6b8b, 0.9).strokeRect(px, py, pw, ph);

    const swX = 3 * TILE_SIZE + 4;
    const swY = 18 * TILE_SIZE;
    const swW = 2.5 * TILE_SIZE;
    const swH = 2.2 * TILE_SIZE;
    g.fillStyle(0xfde8ee, 1).fillRect(swX, swY, swW, swH);
    g.fillStyle(0xf498b2, 0.7);
    for (let r = 0; r < swH; r += 12) {
      for (let c = 0; c < swW; c += 12) {
        if ((Math.floor(r / 12) + Math.floor(c / 12)) % 2 === 0) {
          g.fillRect(swX + c, swY + r, 12, 12);
        }
      }
    }
    g.lineStyle(1.5, 0xeb6b8b, 0.9).strokeRect(swX, swY, swW, swH);

    this.layers.push(g);
  }

  /** Khu Đốn gỗ (Logging Camp). */
  private drawLoggingCamp(scene: Phaser.Scene): void {
    // Đống gỗ tròn xẻ ngay ngắn
    const g = scene.add.graphics().setDepth(15 * TILE_SIZE);
    const lx = 43 * TILE_SIZE;
    const ly = 13 * TILE_SIZE;
    g.fillStyle(0x1a0e08, 0.3).fillEllipse(lx + 32, ly + 40, 50, 14);

    // Vẽ từng súc gỗ xếp chồng
    const logCols = [0x855836, 0x6e4628, 0x9c6a43];
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4 - row; col++) {
        const x = lx + col * 16 + row * 8;
        const y = ly + 32 - row * 12;
        g.fillStyle(logCols[(row + col) % 3], 1).fillRoundedRect(x, y, 24, 12, 4);
        g.fillStyle(0xcaa176, 1).fillCircle(x + 22, y + 6, 5);
        g.fillStyle(0x8a6238, 1).fillCircle(x + 22, y + 6, 2); // vân gỗ
      }
    }
    this.layers.push(g);

    this.drawPropSpots(scene, FARM_LOGGING_PROPS);
  }

  /** Nhà kính Glasshouse & Vườn hoa ươm giống. */
  private drawGreenhouse(scene: Phaser.Scene): void {
    const footX = (FARM_GREENHOUSE.tx + FARM_GREENHOUSE.cols / 2) * TILE_SIZE;
    const footY = (FARM_GREENHOUSE.ty + FARM_GREENHOUSE.rows) * TILE_SIZE;
    this.drawGroundShadow(scene, footX, footY, 80, 18);

    const g = scene.add.graphics().setDepth(footY);
    const gx = FARM_GREENHOUSE.tx * TILE_SIZE;
    const gy = FARM_GREENHOUSE.ty * TILE_SIZE;
    const gw = FARM_GREENHOUSE.cols * TILE_SIZE;
    const gh = FARM_GREENHOUSE.rows * TILE_SIZE;

    // Nền móng nhà kính gỗ
    g.fillStyle(0x543621, 1).fillRect(gx, gy + gh - 18, gw, 18);
    // Khung kính và mặt kính xanh trong suốt
    g.fillStyle(0x70c0e8, 0.45).fillRect(gx + 6, gy + 32, gw - 12, gh - 48);
    // Mái kính gabled
    g.fillStyle(0x92d8f8, 0.55).fillTriangle(gx, gy + 32, gx + gw / 2, gy, gx + gw, gy + 32);
    // Khung sườn gỗ
    g.lineStyle(2.5, 0x543621, 0.95);
    g.strokeTriangle(gx, gy + 32, gx + gw / 2, gy, gx + gw, gy + 32);
    g.strokeRect(gx + 4, gy + 32, gw - 8, gh - 36);
    g.lineBetween(gx + gw / 2, gy, gx + gw / 2, gy + gh - 4);
    g.lineBetween(gx + 4, gy + gh / 2, gx + gw - 4, gy + gh / 2);

    // Cửa ra vào
    g.fillStyle(0x3d2312, 0.9).fillRect(gx + gw / 2 - 12, gy + gh - 28, 24, 28);
    g.fillStyle(0xaad8f0, 0.6).fillRect(gx + gw / 2 - 8, gy + gh - 24, 16, 16);

    this.layers.push(g);

    this.drawPropSpots(scene, FARM_GREENHOUSE_PROPS);
  }

  /** Đền thờ đá cổ (Ancient Stone Shrine). */
  private drawAncientShrine(scene: Phaser.Scene): void {
    const footX = (FARM_SHRINE.tx + FARM_SHRINE.cols / 2) * TILE_SIZE;
    const footY = (FARM_SHRINE.ty + FARM_SHRINE.rows) * TILE_SIZE;

    const g = scene.add.graphics().setDepth(-15);
    // Bậc thang đá tròn
    g.fillStyle(0x605c56, 0.8).fillCircle(footX, footY - 30, 68);
    g.fillStyle(0x78746c, 0.9).fillCircle(footX, footY - 30, 52);
    g.fillStyle(0x908c84, 0.95).fillCircle(footX, footY - 30, 36);
    g.lineStyle(2, 0x484440, 0.8).strokeCircle(footX, footY - 30, 68);
    g.lineStyle(1.5, 0x484440, 0.8).strokeCircle(footX, footY - 30, 52);
    this.layers.push(g);

    // Vẽ biểu tượng la bàn N trên bàn thờ đá
    const txt = scene.add.text(footX, footY - 32, "N", {
      fontFamily: "Arial, sans-serif",
      fontSize: "14px",
      fontStyle: "bold",
      color: "#2a2622",
    }).setOrigin(0.5, 0.5).setDepth(footY + 2);
    this.layers.push(txt);

    this.drawPropSpots(scene, FARM_SHRINE_PROPS);
  }

  /** Gốc cây cưa tròn có vân gỗ (Stumps). */
  private drawStumps(scene: Phaser.Scene): void {
    const g = scene.add.graphics().setDepth(20);
    for (const s of FARM_STUMPS) {
      const px = s.tx * TILE_SIZE + TILE_SIZE / 2;
      const py = s.ty * TILE_SIZE + TILE_SIZE;
      g.fillStyle(0x1a0e08, 0.25).fillEllipse(px, py, 24, 8);
      g.fillStyle(0x614023, 1).fillRoundedRect(px - 14, py - 18, 28, 18, 4);
      g.fillStyle(0xc79d6b, 1).fillEllipse(px, py - 18, 14, 7);
      g.lineStyle(1, 0x7a4d25, 0.6).strokeEllipse(px, py - 18, 8, 4);
    }
    this.layers.push(g);
  }

  private drawTree(scene: Phaser.Scene, tx: number, ty: number, variant: number, pine = false): void {
    const footX = tx * TILE_SIZE + TILE_SIZE;
    const footY = ty * TILE_SIZE + TILE_SIZE * 2;
    const sway = (img: Phaser.GameObjects.Image) => {
      if (!this.swayEnabled) return;
      attachSway(scene, img, tx * 31 + ty);
      this.swayImgs.push(img);
    };

    this.drawGroundShadow(scene, footX, footY, 40, 14);

    if ((pine || variant % 2 === 1) && textureHas(scene, "obj.tree.pine")) {
      const pine = PINE_SEASON_FRAME[this.season];
      const img = addFootSprite(
        scene, "obj.tree.pine", pine.sx, pine.sy, 32, 48,
        footX, footY, footY, pine.frame,
      );
      if (img) {
        sway(img);
        this.layers.push(img);
      }
      return;
    }
    const maple = MAPLE_SEASON_FRAME[this.season];
    const img = addFootSprite(
      scene, "obj.tree", maple.sx, maple.sy, maple.sw, maple.sh,
      footX, footY, footY, maple.frame,
    );
    if (img) {
      sway(img);
      this.layers.push(img);
    }
  }

  private drawFenceRing(
    scene: Phaser.Scene,
    tx: number,
    ty: number,
    cols: number,
    rows: number,
    southOpen?: { from: number; to: number },
  ): void {
    if (!textureHas(scene, "obj.fence") || cols < 1 || rows < 1) return;
    const winter = this.season === "Winter" ? 80 : 0;
    const x1 = tx + cols - 1;
    const y1 = ty + rows - 1;
    const open = (col: number): boolean =>
      Boolean(southOpen && col >= southOpen.from && col <= southOpen.to);
    const put = (col: number, row: number, sx: number, sy: number, tag: string) => {
      const img = addFootSprite(
        scene, "obj.fence", sx, sy + winter, 16, 16,
        col * TILE_SIZE + TILE_SIZE / 2,
        row * TILE_SIZE + TILE_SIZE,
        row * TILE_SIZE + TILE_SIZE,
        `fn-${tag}-${col}-${row}-${this.season}`,
      );
      if (img) this.layers.push(img);
    };

    if (rows === 1) {
      for (let c = 0; c < cols; c++) {
        const col = tx + c;
        if (open(col)) continue;
        const sx = c === 0 ? 0 : c === cols - 1 ? 32 : 16;
        put(col, ty, sx, 32, "h");
      }
      return;
    }
    if (cols === 1) {
      for (let r = 0; r < rows; r++) {
        const sy = r === 0 ? 0 : r === rows - 1 ? 32 : 16;
        put(tx, ty + r, 0, sy, "v");
      }
      return;
    }

    put(tx, ty, 0, 0, "tl");
    put(x1, ty, 32, 0, "tr");
    if (!open(tx)) put(tx, y1, 0, 32, "bl");
    if (!open(x1)) put(x1, y1, 32, 32, "br");
    for (let c = tx + 1; c < x1; c++) {
      put(c, ty, 16, 32, "n");
      if (open(c)) continue;
      if (southOpen && (c === southOpen.from - 1 || c === southOpen.to + 1)) continue;
      put(c, y1, 16, 32, "s");
    }
    for (let r = ty + 1; r < y1; r++) {
      put(tx, r, 0, 16, "w");
      put(x1, r, 32, 16, "e");
    }
    if (southOpen) {
      put(southOpen.from - 1, y1, 48, 0, "gl");
      put(southOpen.to + 1, y1, 80, 0, "gr");
    }
  }

  private drawAnimals(scene: Phaser.Scene): void {
    // Gia súc rải theo ảnh mẫu: bò, cừu trong chuồng và ngoài bãi
    const decor = FARM_DECOR_ANIMALS;

    const SHEET: Record<AnimalKind, [string, number, number]> = {
      chicken: ["animal.chicken", 16, 16],
      cow: ["animal.cow", 32, 32],
      duck: ["animal.duck", 16, 16],
    };

    const animals: Array<[string, number, number, number, number]> = [
      ...decor,
      ...useAnimalStore.getState().animals.map((a) => {
        const [key, w, h] = SHEET[a.kind];
        return [key, a.tx, a.ty, w, h] as [string, number, number, number, number];
      }),
    ];

    for (const [key, tx, ty, w, h] of animals) {
      const footX = tx * TILE_SIZE + TILE_SIZE / 2;
      const footY = ty * TILE_SIZE + TILE_SIZE;
      this.drawGroundShadow(scene, footX, footY, w / 2, 8);
      const img = addFootSprite(scene, key, 0, 0, w, h, footX, footY, footY, "idle0");
      if (img) this.layers.push(img);
    }
  }

  private static readonly PROP_SLICES: Record<string, [number, number, number, number]> = {
    "obj.farm.trough": [0, 0, 32, 16],
    "obj.farm.waterbuckets": [0, 0, 16, 16],
    "obj.farm.barrels": [0, 0, 48, 48],
    "obj.farm.haybale": [0, 0, 48, 16],
    "obj.farm.anvil": [0, 0, 32, 32],
    "obj.farm.churn": [0, 0, 32, 32],
    "obj.farm.jammaker": [0, 0, 32, 32],
    "obj.farm.beehive": [0, 0, 16, 32],
    "obj.picnic": [0, 0, 48, 48],
    "obj.birdhouse": [0, 0, 32, 32],
    "obj.farm.berry.pile": [0, 0, 48, 32],
    "obj.farm.scarecrow": [0, 0, 32, 32],
    "obj.farm.mailbox": [0, 0, 16, 32],
    "obj.farm.shippingbox": [0, 16, 48, 16],
    "obj.streetlamp": [0, 0, 16, 48],
    "obj.decor.bench": [0, 0, 32, 32],
    "obj.workbench": [0, 0, 32, 32],
    "obj.shrine.altar": [0, 0, 48, 48],
    "obj.shrine.pillar": [0, 0, 16, 48],
    "obj.shrine.column.broken": [0, 0, 16, 32],
  };

  private drawPropSpots(scene: Phaser.Scene, spots: readonly FarmPropSpot[]): void {
    for (const spot of spots) {
      const slice = FarmSceneryRenderer.PROP_SLICES[spot.key];
      if (!slice) continue;
      const [sx, sy, w, h] = slice;
      const footX = spot.tx * TILE_SIZE + TILE_SIZE / 2;
      const footY = spot.ty * TILE_SIZE + TILE_SIZE;
      this.drawGroundShadow(scene, footX, footY, w / 2, 8);
      const img = addFootSprite(
        scene, spot.key, sx, sy, w, h, footX, footY, footY, "prop",
      );
      if (img) this.layers.push(img);
    }
  }

  private drawStable(scene: Phaser.Scene): void {
    const footX = (FARM_STABLE.tx + FARM_STABLE.cols / 2) * TILE_SIZE;
    const footY = (FARM_STABLE.ty + FARM_STABLE.rows) * TILE_SIZE;
    this.drawGroundShadow(scene, footX, footY, 120, 16);
    if (!ensureFrame(scene, "obj.stable", "stable-0", 0, 0, 224, 144)) return;
    const img = scene.add.image(footX, footY, "obj.stable", "stable-0");
    img.setOrigin(0.5, 1);
    img.setScale((FARM_STABLE.rows * TILE_SIZE) / 144);
    img.setDepth(footY);
    this.layers.push(img);
  }

  private drawYardProps(scene: Phaser.Scene): void {
    this.drawPropSpots(scene, FARM_YARD_PROPS);
  }

  private drawWildflowers(scene: Phaser.Scene): void {
    if (this.season === "Winter") return;
    const sheet = seasonSheet(this.season);
    const flowers = [
      [3, 5], [7, 7], [9, 16], [13, 16], [23, 15], [25, 15],
      [35, 21], [37, 25], [27, 34], [31, 38], [35, 38],
      [5, 25], [8, 45], [13, 49], [42, 14], [51, 20],
    ] as const;
    for (const [tx, ty] of flowers) {
      const img = addTileImage(scene, tx, ty, sheet, 80, 16, ty * TILE_SIZE);
      if (img) {
        if (this.swayEnabled) {
          attachSway(scene, img, tx * 31 + ty);
          this.swayImgs.push(img);
        }
        this.layers.push(img);
      }
    }
  }

  private drawBlossoms(scene: Phaser.Scene): void {
    const g = scene.add.graphics().setDepth(1200);
    for (const tree of FARM_TREES) {
      if (tree.pine) continue;
      const cx = tree.tx * TILE_SIZE + TILE_SIZE;
      const cy = tree.ty * TILE_SIZE + TILE_SIZE * 0.4;
      const spots: [number, number, number][] = [
        [cx - 22, cy - 18, 10], [cx - 10, cy - 26, 12], [cx + 4,  cy - 22, 11],
        [cx + 18, cy - 16, 10], [cx - 26, cy - 4,  10], [cx + 20, cy - 2,  9],
        [cx - 18, cy + 8,   9], [cx + 12, cy + 6,  9],
      ];
      for (const [bx, by, r] of spots) {
        g.fillStyle(0xf4a7c3, 0.9).fillRect(bx, by, r, r);
        g.fillStyle(0xfde8f2, 0.6).fillRect(bx + 3, by + 3, r - 4, r - 4);
      }
    }
    this.layers.push(g);
  }

  private drawSnowTufts(scene: Phaser.Scene): void {
    const g = scene.add.graphics().setDepth(6);
    g.fillStyle(0xf4f8fc, 0.9);
    const tufts = [[11, 8], [15, 10], [22, 8], [32, 14], [6, 18], [33, 21], [14, 27], [25, 21]];
    for (const [tx, ty] of tufts) {
      g.fillRect(tx * TILE_SIZE + 8, ty * TILE_SIZE + 10, 18, 10);
      g.fillRect(tx * TILE_SIZE + 14, ty * TILE_SIZE + 6, 10, 8);
    }
    this.layers.push(g);
  }

  private renderFallback(scene: Phaser.Scene): void {
    const ground = scene.add.graphics().setDepth(5);
    const house = scene.add.graphics().setDepth((FARM_HOUSE.ty + FARM_HOUSE.rows) * TILE_SIZE);
    const objects = scene.add.graphics().setDepth(950);
    const foreground = scene.add.graphics().setDepth(1300);
    this.layers = [ground, house, objects, foreground];

    this.drawHouseGfx(house, FARM_HOUSE.tx, FARM_HOUSE.ty);
    const gfx = SEASON_TREE_GFX[this.season];
    FARM_TREES.forEach((tree) => {
      this.drawTreeGfx(objects, foreground, tree.tx, tree.ty, gfx.shade, gfx.leaf);
    });
  }

  private drawHouseGfx(g: Phaser.GameObjects.Graphics, tx: number, ty: number): void {
    const x = tx * TILE_SIZE;
    const y = ty * TILE_SIZE;
    const w = FARM_HOUSE.cols * TILE_SIZE;
    const h = FARM_HOUSE.rows * TILE_SIZE;
    g.fillStyle(0x4a3025).fillRect(x, y + 15 * PX, w, h - 15 * PX);
    g.fillStyle(0xe3bf84).fillRect(x + PX, y + 15 * PX, w - 2 * PX, h - 17 * PX);
    g.fillStyle(0xa65143).fillPoints([
      new Phaser.Math.Vector2(x + PX, y + 15 * PX),
      new Phaser.Math.Vector2(x + w / 2, y),
      new Phaser.Math.Vector2(x + w - PX, y + 15 * PX),
    ], true);
  }

  private drawTreeGfx(
    g: Phaser.GameObjects.Graphics,
    _fg: Phaser.GameObjects.Graphics,
    tx: number, ty: number, shade: number, leaf: number,
  ): void {
    const x = tx * TILE_SIZE;
    const y = ty * TILE_SIZE;
    g.fillStyle(0x593b27).fillRect(x + 22 * PX, y + 16 * PX, 6 * PX, 17 * PX);
    g.fillStyle(shade).fillRect(x + 12 * PX, y + 5 * PX, 17 * PX, 12 * PX);
    g.fillStyle(leaf).fillRect(x + 17 * PX, y + 11 * PX, 15 * PX, 12 * PX);
  }

  destroy(): void {
    this.ambient?.destroy();
    this.ambient = undefined;
    this.zoneRenderer.destroy();
    if (this.sceneCtx) {
      for (const img of this.swayImgs) this.sceneCtx.tweens.killTweensOf(img);
    }
    this.swayImgs = [];
    for (const layer of this.layers) layer.destroy();
    this.layers = [];
  }
}
