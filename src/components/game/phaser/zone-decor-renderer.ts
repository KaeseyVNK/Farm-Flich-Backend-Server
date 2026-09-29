// Zone labels (banners + warp signs) and cave gameplay entities.
// Task 8: static zone props (house/village/cave/beach landmarks) moved to the
// data-driven placements in src/lib/game/scenery/*-layout.ts, drawn by
// ZoneSceneryRenderer via FarmSceneryRenderer — the placeholder graphics
// bodies are retired. What stays here is what the layouts cannot express:
// text banners/warp signs (graphics) and cave ore/slime sprites whose state
// lives in worldStore (mined/defeated), not in static placement data.
// Visual-only: stores still own interact, sleep, mining, and zone changes.
import Phaser from "phaser";
import { TILE_SIZE } from "@/lib/game/constants";
import { addFootSprite, addTileImage } from "@/lib/game/phaser/texture-frames";
import { CAVE_ZONE } from "@/lib/game/zones/cave";
import { useWorldStore } from "@/store/worldStore";

export function drawWarpSign(
  scene: Phaser.Scene,
  tx: number,
  ty: number,
  label: string,
): Phaser.GameObjects.GameObject[] {
  const x = tx * TILE_SIZE;
  const y = ty * TILE_SIZE;
  const inner = Math.max(54, label.length * 9 + 10);
  const boardW = inner + 6;
  const board = scene.add.graphics().setDepth(y + 80);
  board.fillStyle(0x3b2416, 1).fillRect(x - 4, y - 14, 8, 18);
  board.fillStyle(0x1a0e08, 1).fillRect(x - boardW / 2, y - 40, boardW, 26);
  board.fillStyle(0xd4a05c, 1).fillRect(x - inner / 2, y - 37, inner, 20);
  const out: Phaser.GameObjects.GameObject[] = [board];
  if (typeof scene.add.text === "function") {
    out.push(
      scene.add
        .text(x, y - 27, label, {
          fontFamily: "VT323, monospace",
          fontSize: "16px",
          color: "#2a1810",
        })
        .setOrigin(0.5)
        .setDepth(y + 81),
    );
  }
  return out;
}

function banner(
  scene: Phaser.Scene,
  tx: number,
  ty: number,
  label: string,
  fill = 0x3b2f23,
): Phaser.GameObjects.GameObject[] {
  const x = tx * TILE_SIZE;
  const y = ty * TILE_SIZE;
  const w = Math.max(120, label.length * 9);
  const board = scene.add.graphics().setDepth(y + 90);
  board.fillStyle(fill, 0.92).fillRect(x - w / 2, y - 18, w, 22);
  board.fillStyle(0xf4e6c3, 0.95).fillRect(x - w / 2 + 2, y - 16, w - 4, 18);
  const out: Phaser.GameObjects.GameObject[] = [board];
  if (typeof scene.add.text === "function") {
    out.push(
      scene.add
        .text(x, y - 7, label, {
          fontFamily: "monospace",
          fontSize: "12px",
          color: "#3b2f23",
          fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setDepth(y + 91),
    );
  }
  return out;
}

interface ZoneLabel {
  banner?: { tx: number; ty: number; label: string; fill?: number };
  signs: Array<{ tx: number; ty: number; label: string }>;
}

/** Per-zone label table — signs sit on the zone's warp tile(s). */
const ZONE_LABELS: Record<string, ZoneLabel> = {
  house: {
    banner: { tx: 8, ty: 1.4, label: "NHÀ TIDECREST" },
    signs: [
      { tx: 8, ty: 11, label: "RA SÂN" }, // south door warp (8,11)
      { tx: 2, ty: 3, label: "NGỦ" }, // bed foot (4,3) is faced from (4,4)
    ],
  },
  village: {
    banner: { tx: 14, ty: 2, label: "LÀNG TIDECREST" },
    signs: [{ tx: 1, ty: 13, label: "VỀ TRẠI" }], // west gate warp (1,13)
  },
  cave: {
    banner: { tx: 12, ty: 18, label: "HANG CŨ", fill: 0x2c2428 },
    signs: [{ tx: 15, ty: 23, label: "LỐI RA" }], // exit corridor warp (15,23)
  },
  beach: {
    banner: { tx: 13, ty: 3, label: "BÃI BIỂN" },
    signs: [{ tx: 20, ty: 11, label: "VỀ TRẠI" }], // pier foot warp (20,11)
  },
};

/** Zone-title banner + warp signs for an away zone (graphics, no sprites). */
export function drawZoneLabels(
  scene: Phaser.Scene,
  zoneId: string,
): Phaser.GameObjects.GameObject[] {
  const label = ZONE_LABELS[zoneId];
  if (!label) return [];
  const layers: Phaser.GameObjects.GameObject[] = [];
  if (label.banner) {
    layers.push(...banner(scene, label.banner.tx, label.banner.ty, label.banner.label, label.banner.fill));
  }
  for (const sign of label.signs) {
    layers.push(...drawWarpSign(scene, sign.tx, sign.ty, sign.label));
  }
  return layers;
}

/**
 * Cave ore nodes + slimes — gameplay state lives in worldStore (mined /
 * defeated), so these cannot be static ZoneScenery placements. Sprites when
 * the sheets exist, flat-color fallback otherwise.
 */
export function drawCaveEntities(scene: Phaser.Scene): Phaser.GameObjects.GameObject[] {
  const layers: Phaser.GameObjects.GameObject[] = [];
  const world = useWorldStore.getState();
  for (const rock of CAVE_ZONE.rocks) {
    if (world.isRockMined(rock.x, rock.y)) continue;
    const img = addTileImage(scene, rock.x, rock.y, "tile.caves", 0, 0, rock.y * TILE_SIZE + TILE_SIZE);
    if (img) {
      layers.push(img);
      continue;
    }
    const g = scene.add.graphics().setDepth(rock.y * TILE_SIZE + 8);
    g.fillStyle(0x8a6a3a).fillRect(rock.x * TILE_SIZE + 8, rock.y * TILE_SIZE + 8, 32, 28);
    g.fillStyle(0xc9a227).fillRect(rock.x * TILE_SIZE + 16, rock.y * TILE_SIZE + 16, 8, 8);
    layers.push(g);
  }
  const slimes: Array<[string, number, number]> = [
    ["enemy.slime.green", 6, 10],
    ["enemy.slime.blue", 15, 7],
    ["enemy.slime.pink", 12, 11],
  ];
  CAVE_ZONE.slimes.forEach((slime, i) => {
    if (!world.isSlimeAlive(slime.id)) return;
    const [key] = slimes[i] ?? slimes[0];
    const img = addFootSprite(
      scene, key, 0, 0, 16, 16,
      slime.x * TILE_SIZE + TILE_SIZE / 2,
      slime.y * TILE_SIZE + TILE_SIZE,
      slime.y * TILE_SIZE + TILE_SIZE,
      "idle0",
    );
    if (img) {
      layers.push(img);
      return;
    }
    const g = scene.add.graphics().setDepth(slime.y * TILE_SIZE + 8);
    g.fillStyle(0x5aa453).fillRect(
      slime.x * TILE_SIZE + 10,
      slime.y * TILE_SIZE + 14,
      28,
      20,
    );
    layers.push(g);
  });
  return layers;
}
