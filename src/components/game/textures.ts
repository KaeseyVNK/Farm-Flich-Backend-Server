// Procedural pixel-art drawing helpers for the canvas game engine.
// Everything is drawn with the 2D context — no external image assets needed.

import { TILE_SIZE } from "@/lib/game/constants";
import type { Season } from "@/lib/game/constants";
import { T } from "@/lib/game/constants";
import { CROPS, getItem } from "@/lib/game/data";
import type { DecorType } from "@/lib/game/zone-manager";

type Ctx = CanvasRenderingContext2D;

// Deterministic pseudo-random for tile texture noise
function rng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function px(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export function drawTile(
  ctx: Ctx,
  type: number,
  tx: number,
  ty: number,
  season: Season,
) {
  const x = tx * TILE_SIZE;
  const y = ty * TILE_SIZE;
  const s = TILE_SIZE;
  const rand = rng(tx * 73 + ty * 131 + type * 17);

  // Season ground tint for grass
  const grassBase =
    season === "Spring"
      ? "#6fb84a"
      : season === "Summer"
        ? "#7fc04a"
        : season === "Fall"
          ? "#b07e3a"
          : "#dfe9ee";
  const grassDark =
    season === "Spring"
      ? "#5a9e3a"
      : season === "Summer"
        ? "#6aa83a"
        : season === "Fall"
          ? "#8f6628"
          : "#c8d6dd";

  switch (type) {
    case T.GRASS:
    case T.GRASS_FLOWER: {
      px(ctx, x, y, s, s, grassBase);
      // texture specks
      for (let i = 0; i < 6; i++) {
        const sx = x + Math.floor(rand() * (s - 2));
        const sy = y + Math.floor(rand() * (s - 2));
        px(ctx, sx, sy, 2, 2, grassDark);
      }
      // grass blade tufts for richer texture
      ctx.fillStyle = grassDark;
      const tuftPositions = [
        [6, 10],
        [20, 6],
        [14, 22],
        [26, 18],
      ];
      for (const [gx, gy] of tuftPositions) {
        if (rand() > 0.5) {
          ctx.fillRect(x + gx, y + gy - 3, 1, 3);
          ctx.fillRect(x + gx + 1, y + gy - 2, 1, 2);
          ctx.fillRect(x + gx - 1, y + gy - 2, 1, 2);
        }
      }
      // occasional dirt patch for natural variation
      if (rand() > 0.85) {
        ctx.fillStyle = "rgba(139, 90, 43, 0.25)";
        ctx.fillRect(x + 4 + Math.floor(rand() * 16), y + 4 + Math.floor(rand() * 16), 6, 4);
      }
      if (type === T.GRASS_FLOWER) {
        // little flower
        const fx = x + s / 2;
        const fy = y + s / 2;
        const colors = ["#e7b94e", "#d9694e", "#f3f0e0", "#e0473a", "#c98ad9"];
        const c = colors[Math.floor(rand() * colors.length)];
        ctx.fillStyle = c;
        ctx.fillRect(fx - 1, fy - 3, 2, 2);
        ctx.fillRect(fx - 3, fy - 1, 2, 2);
        ctx.fillRect(fx + 1, fy - 1, 2, 2);
        ctx.fillRect(fx - 1, fy + 1, 2, 2);
        ctx.fillStyle = "#e7b94e";
        ctx.fillRect(fx - 1, fy - 1, 2, 2);
        // stem
        ctx.fillStyle = grassDark;
        ctx.fillRect(fx, fy + 3, 1, 4);
      }
      break;
    }
    case T.PATH: {
      px(ctx, x, y, s, s, "#c9a86a");
      // Pixel RPG cobblestone pattern with border shadowing
      ctx.fillStyle = "#b8985a";
      ctx.fillRect(x + 2, y + 2, 12, 12);
      ctx.fillRect(x + 18, y + 2, 12, 12);
      ctx.fillRect(x + 2, y + 18, 12, 12);
      ctx.fillRect(x + 18, y + 18, 12, 12);
      ctx.fillStyle = "#d4b478";
      ctx.fillRect(x + 4, y + 4, 4, 4);
      ctx.fillRect(x + 20, y + 4, 4, 4);
      ctx.fillRect(x + 4, y + 20, 4, 4);
      ctx.fillRect(x + 20, y + 20, 4, 4);
      // Outer path edge detail
      ctx.fillStyle = "rgba(60, 40, 20, 0.15)";
      ctx.fillRect(x, y, s, 2);
      ctx.fillRect(x, y, 2, s);
      break;
    }
    case T.WATER: {
      // gradient water
      ctx.fillStyle = "#4a93c9";
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = "#5aa9d9";
      ctx.fillRect(x, y, s, s / 2);
      // ripples
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(x + 4, y + 8, 8, 2);
      ctx.fillRect(x + 18, y + 18, 8, 2);
      ctx.fillRect(x + 10, y + 24, 6, 2);
      break;
    }
    case T.SAND: {
      px(ctx, x, y, s, s, "#e8d6a8");
      ctx.fillStyle = "#d8c089";
      for (let i = 0; i < 5; i++) {
        ctx.fillRect(x + Math.floor(rand() * s), y + Math.floor(rand() * s), 2, 2);
      }
      break;
    }
    case T.FALLOW: {
      px(ctx, x, y, s, s, "#c4a574");
      break;
    }
    case T.TILLED: {
      px(ctx, x, y, s, s, "#8a5a2f");
      ctx.fillStyle = "#7a4f2b";
      ctx.fillRect(x, y, s, 6);
      ctx.fillStyle = "#6a3f22";
      // furrows
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(x + 3 + i * 9, y + 8, 5, 18);
      }
      ctx.fillStyle = "#9a6a3a";
      ctx.fillRect(x, y + s - 3, s, 3);
      break;
    }
    case T.TILLED_WET: {
      px(ctx, x, y, s, s, "#5a3a1f");
      ctx.fillStyle = "#4a2f18";
      ctx.fillRect(x, y, s, 6);
      ctx.fillStyle = "#3a2412";
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(x + 3 + i * 9, y + 8, 5, 18);
      }
      // wet sheen
      ctx.fillStyle = "rgba(90,150,200,0.25)";
      ctx.fillRect(x, y, s, s);
      break;
    }
    case T.TREE: {
      // grass base
      px(ctx, x, y, s, s, grassBase);
      // trunk
      ctx.fillStyle = "#5a3a1f";
      ctx.fillRect(x + 13, y + 20, 6, 10);
      ctx.fillStyle = "#7a5230";
      ctx.fillRect(x + 14, y + 21, 4, 8);
      // canopy
      const canopy =
        season === "Winter" ? "#9ec9e8" : season === "Fall" ? "#c9662a" : "#2f6b32";
      const canopyLight =
        season === "Winter" ? "#bcdcec" : season === "Fall" ? "#e0852a" : "#3f8b3a";
      ctx.fillStyle = canopy;
      ctx.beginPath();
      ctx.arc(x + 16, y + 12, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = canopyLight;
      ctx.beginPath();
      ctx.arc(x + 12, y + 10, 6, 0, Math.PI * 2);
      ctx.fill();
      // shadow
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.fillRect(x + 16, y + 30, 8, 2);
      break;
    }
    case T.STUMP: {
      px(ctx, x, y, s, s, grassBase);
      ctx.fillStyle = "#7a5230";
      ctx.fillRect(x + 10, y + 16, 12, 12);
      ctx.fillStyle = "#9a6a3a";
      ctx.fillRect(x + 12, y + 18, 8, 8);
      ctx.fillStyle = "#5a3a1f";
      ctx.fillRect(x + 13, y + 20, 6, 6);
      // rings
      ctx.strokeStyle = "#5a3a1f";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x + 16, y + 22, 3, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case T.ROCK: {
      px(ctx, x, y, s, s, grassBase);
      ctx.fillStyle = "#8a8a8a";
      ctx.beginPath();
      ctx.ellipse(x + 16, y + 18, 11, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#a5a5a5";
      ctx.beginPath();
      ctx.ellipse(x + 13, y + 15, 6, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#6a6a6a";
      ctx.fillRect(x + 10, y + 22, 12, 4);
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.fillRect(x + 12, y + 26, 8, 2);
      break;
    }
    case T.STONE_EMPTY: {
      px(ctx, x, y, s, s, grassBase);
      ctx.fillStyle = "#9a9a9a";
      ctx.fillRect(x + 8, y + 22, 4, 3);
      ctx.fillRect(x + 20, y + 20, 3, 3);
      break;
    }
    case T.FENCE: {
      px(ctx, x, y, s, s, grassBase);
      ctx.fillStyle = "#8a6238";
      ctx.fillRect(x + 4, y + 6, 4, 20);
      ctx.fillRect(x + 24, y + 6, 4, 20);
      ctx.fillRect(x + 2, y + 12, 28, 4);
      ctx.fillStyle = "#6b4a2b";
      ctx.fillRect(x + 4, y + 6, 2, 20);
      ctx.fillRect(x + 24, y + 6, 2, 20);
      break;
    }
    case T.FLOWER_BUSH: {
      px(ctx, x, y, s, s, grassBase);
      ctx.fillStyle = "#2f6b32";
      ctx.beginPath();
      ctx.arc(x + 16, y + 18, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#d9694e";
      ctx.fillRect(x + 10, y + 12, 3, 3);
      ctx.fillRect(x + 18, y + 14, 3, 3);
      ctx.fillStyle = "#e7b94e";
      ctx.fillRect(x + 14, y + 20, 3, 3);
      ctx.fillRect(x + 20, y + 22, 3, 3);
      ctx.fillStyle = "#f3f0e0";
      ctx.fillRect(x + 8, y + 18, 3, 3);
      break;
    }
    default:
      px(ctx, x, y, s, s, grassBase);
  }
}

export function drawCrop(
  ctx: Ctx,
  cropId: string,
  stage: number,
  totalStages: number,
  tx: number,
  ty: number,
  dead: boolean,
) {
  const def = CROPS[cropId];
  if (!def) return;
  const x = tx * TILE_SIZE;
  const y = ty * TILE_SIZE;
  const cx = x + TILE_SIZE / 2;
  const cy = y + TILE_SIZE / 2;

  if (dead) {
    ctx.fillStyle = "#6a4a2a";
    ctx.fillRect(cx - 4, cy + 4, 8, 10);
    ctx.fillStyle = "#8a6a3a";
    ctx.fillRect(cx - 6, cy + 2, 4, 4);
    ctx.fillRect(cx + 2, cy + 6, 3, 3);
    return;
  }

  const progress = stage / (totalStages - 1);
  const isMature = stage >= totalStages - 1;

  // stem
  ctx.fillStyle = def.color;
  if (progress > 0.1) ctx.fillRect(cx - 2, cy - 2, 4, 14);
  if (progress > 0.4) {
    // leaves
    ctx.fillStyle = def.color;
    ctx.fillRect(cx - 6, cy + 2, 4, 3);
    ctx.fillRect(cx + 2, cy + 4, 4, 3);
  }
  if (progress > 0.7 || isMature) {
    // fruit/bud
    ctx.fillStyle = def.fruitColor;
    const size = isMature ? 10 : 6;
    ctx.beginPath();
    ctx.arc(cx, cy - 4, size / 2, 0, Math.PI * 2);
    ctx.fill();
    if (isMature) {
      // shine
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.fillRect(cx - 2, cy - 6, 2, 2);
      // ready glow
      ctx.strokeStyle = "rgba(231,185,78,0.7)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy - 2, 11, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (progress <= 0.1) {
    // sprout
    ctx.fillStyle = def.color;
    ctx.fillRect(cx - 1, cy + 8, 2, 4);
    ctx.fillRect(cx - 3, cy + 8, 2, 2);
    ctx.fillRect(cx + 1, cy + 8, 2, 2);
  }
}

export function drawForage(ctx: Ctx, itemId: string, tx: number, ty: number) {
  const def = getItem(itemId);
  if (!def) return;
  const x = tx * TILE_SIZE;
  const y = ty * TILE_SIZE;
  const cx = x + TILE_SIZE / 2;
  const cy = y + TILE_SIZE / 2 + 4;
  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 6, 7, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  switch (itemId) {
    case "dandelion":
      ctx.fillStyle = "#e7b94e";
      ctx.fillRect(cx - 1, cy - 5, 2, 8);
      ctx.fillStyle = "#f3e04a";
      ctx.beginPath();
      ctx.arc(cx, cy - 6, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e7b94e";
      ctx.fillRect(cx - 1, cy - 7, 2, 2);
      break;
    case "leek":
      ctx.fillStyle = "#4e7d3a";
      ctx.fillRect(cx - 2, cy - 6, 4, 10);
      ctx.fillStyle = "#7cc36b";
      ctx.fillRect(cx - 3, cy - 8, 2, 4);
      ctx.fillRect(cx + 1, cy - 8, 2, 4);
      ctx.fillStyle = "#fff";
      ctx.fillRect(cx - 1, cy + 2, 2, 3);
      break;
    case "mushroom":
      ctx.fillStyle = "#f3f0e0";
      ctx.fillRect(cx - 2, cy - 2, 4, 6);
      ctx.fillStyle = "#c0452f";
      ctx.beginPath();
      ctx.arc(cx, cy - 3, 5, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillRect(cx - 2, cy - 4, 1, 1);
      ctx.fillRect(cx + 1, cy - 5, 1, 1);
      break;
    default:
      ctx.fillStyle = "#e7b94e";
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fill();
  }

  // sparkle to indicate pickable
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillRect(cx + 6, cy - 6, 2, 1);
  ctx.fillRect(cx + 7, cy - 7, 1, 3);
}

export function drawPlacedObject(
  ctx: Ctx,
  type: "fence" | "sprinkler" | "shipping_box",
  tx: number,
  ty: number,
  hasContents = false,
) {
  const x = tx * TILE_SIZE;
  const y = ty * TILE_SIZE;
  const cx = x + TILE_SIZE / 2;
  const cy = y + TILE_SIZE / 2;
  if (type === "fence") {
    ctx.fillStyle = "#8a6238";
    ctx.fillRect(x + 4, y + 6, 4, 22);
    ctx.fillRect(x + 24, y + 6, 4, 22);
    ctx.fillStyle = "#6b4a2b";
    ctx.fillRect(x + 2, y + 12, 28, 4);
    ctx.fillRect(x + 2, y + 22, 28, 4);
  } else if (type === "sprinkler") {
    // sprinkler
    ctx.fillStyle = "#5a5a5a";
    ctx.fillRect(cx - 5, cy - 5, 10, 10);
    ctx.fillStyle = "#8a8a8a";
    ctx.fillRect(cx - 4, cy - 4, 8, 8);
    ctx.fillStyle = "#5aa9d9";
    ctx.fillRect(cx - 2, cy - 2, 4, 4);
    // water arcs
    ctx.strokeStyle = "rgba(90,169,217,0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + 14, cy);
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx - 14, cy);
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy + 14);
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy - 14);
    ctx.stroke();
  } else {
    // shipping box — a wooden crate
    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(x + 4, y + 26, 24, 3);
    // box body
    ctx.fillStyle = "#8a6238";
    ctx.fillRect(x + 4, y + 8, 24, 18);
    ctx.fillStyle = "#a07644";
    ctx.fillRect(x + 5, y + 9, 22, 16);
    // wood planks
    ctx.fillStyle = "#6b4a2b";
    ctx.fillRect(x + 4, y + 13, 24, 2);
    ctx.fillRect(x + 4, y + 19, 24, 2);
    // top lid
    ctx.fillStyle = "#8a6238";
    ctx.fillRect(x + 3, y + 6, 26, 4);
    ctx.fillStyle = "#6b4a2b";
    ctx.fillRect(x + 3, y + 9, 26, 1);
    // metal corners
    ctx.fillStyle = "#5a5a5a";
    ctx.fillRect(x + 4, y + 8, 2, 2);
    ctx.fillRect(x + 26, y + 8, 2, 2);
    ctx.fillRect(x + 4, y + 24, 2, 2);
    ctx.fillRect(x + 26, y + 24, 2, 2);
    // contents indicator (glow if non-empty)
    if (hasContents) {
      ctx.fillStyle = "rgba(231,185,78,0.7)";
      ctx.fillRect(x + 14, y + 4, 4, 3);
      ctx.strokeStyle = "rgba(231,185,78,0.5)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 2, y + 4, 28, 24);
    }
  }
}

export type Facing = "down" | "up" | "left" | "right";

export function drawPlayer(
  ctx: Ctx,
  pxPos: number,
  pyPos: number,
  facing: Facing,
  walkPhase: number,
  moving: boolean,
) {
  const cx = Math.round(pxPos);
  const cy = Math.round(pyPos);
  const bob = moving ? Math.sin(walkPhase) * 1.5 : 0;
  const top = cy - 24 + bob;

  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2, 9, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // legs
  const legSwing = moving ? Math.sin(walkPhase) * 3 : 0;
  ctx.fillStyle = "#3a2a18";
  if (facing === "left" || facing === "right") {
    ctx.fillRect(cx - 4, cy - 4, 3, 8 + legSwing);
    ctx.fillRect(cx + 1, cy - 4, 3, 8 - legSwing);
  } else {
    ctx.fillRect(cx - 5, cy - 4, 3, 8 + legSwing);
    ctx.fillRect(cx + 2, cy - 4, 3, 8 - legSwing);
  }

  // body (overalls - blue)
  ctx.fillStyle = "#3a6b9c";
  ctx.fillRect(cx - 6, top + 10, 12, 10);
  ctx.fillStyle = "#4a7bac";
  ctx.fillRect(cx - 6, top + 10, 12, 2);
  // shirt sleeves
  ctx.fillStyle = "#c0452f";
  ctx.fillRect(cx - 8, top + 10, 3, 7);
  ctx.fillRect(cx + 5, top + 10, 3, 7);
  // arms
  ctx.fillStyle = "#e8c89a";
  if (facing === "left") {
    ctx.fillRect(cx - 8, top + 16, 3, 4);
  } else if (facing === "right") {
    ctx.fillRect(cx + 5, top + 16, 3, 4);
  } else {
    ctx.fillRect(cx - 8, top + 16, 3, 4);
    ctx.fillRect(cx + 5, top + 16, 3, 4);
  }

  // head
  ctx.fillStyle = "#e8c89a";
  ctx.fillRect(cx - 5, top + 2, 10, 9);
  // hair (brown)
  ctx.fillStyle = "#5a3a1f";
  ctx.fillRect(cx - 6, top + 1, 12, 4);
  ctx.fillRect(cx - 6, top + 2, 2, 3);
  ctx.fillRect(cx + 4, top + 2, 2, 3);

  // face details by facing
  if (facing === "down") {
    ctx.fillStyle = "#2a1a0a";
    ctx.fillRect(cx - 3, top + 6, 2, 2);
    ctx.fillRect(cx + 1, top + 6, 2, 2);
    // smile
    ctx.fillStyle = "#8a4a2a";
    ctx.fillRect(cx - 1, top + 9, 3, 1);
  } else if (facing === "up") {
    // back of head — just hair
    ctx.fillStyle = "#5a3a1f";
    ctx.fillRect(cx - 5, top + 2, 10, 8);
  } else if (facing === "left") {
    ctx.fillStyle = "#2a1a0a";
    ctx.fillRect(cx - 4, top + 6, 2, 2);
  } else {
    ctx.fillStyle = "#2a1a0a";
    ctx.fillRect(cx + 2, top + 6, 2, 2);
  }

  // hat (straw hat)
  ctx.fillStyle = "#d9b85a";
  ctx.fillRect(cx - 7, top + 0, 14, 2);
  ctx.fillStyle = "#c9a84a";
  ctx.fillRect(cx - 4, top - 2, 8, 3);
  ctx.fillStyle = "#8a6a2a";
  ctx.fillRect(cx - 4, top + 1, 8, 1);
}

export function drawNpc(
  ctx: Ctx,
  npc: { color: string; emoji: string },
  pxPos: number,
  pyPos: number,
  facing: Facing = "down",
) {
  const cx = Math.round(pxPos);
  const cy = Math.round(pyPos);
  const top = cy - 22;

  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2, 8, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // legs
  ctx.fillStyle = "#3a2a18";
  ctx.fillRect(cx - 4, cy - 4, 3, 8);
  ctx.fillRect(cx + 1, cy - 4, 3, 8);

  // body
  ctx.fillStyle = npc.color;
  ctx.fillRect(cx - 6, top + 10, 12, 10);
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.fillRect(cx - 6, top + 18, 12, 2);

  // head
  ctx.fillStyle = "#e8c89a";
  ctx.fillRect(cx - 4, top + 2, 8, 9);
  ctx.fillStyle = "#2a1a0a";
  if (facing === "down") {
    ctx.fillRect(cx - 2, top + 6, 1, 1);
    ctx.fillRect(cx + 1, top + 6, 1, 1);
  }
  // hair / hat depending on emoji
  ctx.fillStyle = npc.emoji === "🎩" ? "#2a1a0a" : "#5a3a1f";
  ctx.fillRect(cx - 5, top + 1, 10, 3);
  if (npc.emoji === "🎩") {
    ctx.fillStyle = "#1a0a0a";
    ctx.fillRect(cx - 3, top - 3, 6, 4);
    ctx.fillStyle = "#3a2a1a";
    ctx.fillRect(cx - 5, top + 0, 10, 2);
  }

  // name tag
  ctx.font = "bold 9px monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(cx - 18, top - 12, 36, 10);
  ctx.fillStyle = "#fff";
  ctx.fillText(npc.emoji, cx - 12, top - 4);
  // We can't easily render emoji text reliably across systems on canvas; draw a small role dot
  ctx.fillStyle = npc.color;
  ctx.fillRect(cx + 8, top - 10, 4, 4);
}

export function drawBuilding(
  ctx: Ctx,
  kind: "house" | "shop" | "barn",
  tx: number,
  ty: number,
  w: number,
  h: number,
) {
  const x = tx * TILE_SIZE;
  const y = ty * TILE_SIZE;
  const W = w * TILE_SIZE;
  const H = h * TILE_SIZE;
  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.fillRect(x + 4, y + H, W, 4);
  // walls
  ctx.fillStyle = kind === "shop" ? "#c9a86a" : "#d9b88a";
  ctx.fillRect(x, y + 12, W, H - 12);
  // wall shading
  ctx.fillStyle = "rgba(0,0,0,0.1)";
  ctx.fillRect(x, y + H - 8, W, 8);
  // roof
  ctx.fillStyle = kind === "house" ? "#8a3a2a" : kind === "shop" ? "#5a4a2a" : "#6a4a2a";
  ctx.beginPath();
  ctx.moveTo(x - 2, y + 14);
  ctx.lineTo(x + W / 2, y - 2);
  ctx.lineTo(x + W + 2, y + 14);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.beginPath();
  ctx.moveTo(x + W / 2, y - 2);
  ctx.lineTo(x + W + 2, y + 14);
  ctx.lineTo(x + W / 2, y + 14);
  ctx.closePath();
  ctx.fill();
  // door
  ctx.fillStyle = "#5a3a1f";
  ctx.fillRect(x + W / 2 - 6, y + H - 16, 12, 16);
  ctx.fillStyle = "#e7b94e";
  ctx.fillRect(x + W / 2 + 2, y + H - 8, 2, 2);
  // windows
  ctx.fillStyle = "#8fc4e0";
  ctx.fillRect(x + 6, y + 20, 8, 8);
  ctx.fillRect(x + W - 14, y + 20, 8, 8);
  ctx.strokeStyle = "#5a3a1f";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 6, y + 20, 8, 8);
  ctx.strokeRect(x + W - 14, y + 20, 8, 8);
  ctx.beginPath();
  ctx.moveTo(x + 10, y + 20);
  ctx.lineTo(x + 10, y + 28);
  ctx.moveTo(x + 6, y + 24);
  ctx.lineTo(x + 14, y + 24);
  ctx.stroke();
}

// ============================================================
// DECOR LAYER — Pixel-art decorative props scattered on the map
// ============================================================

export function drawDecor(ctx: Ctx, type: DecorType, tx: number, ty: number) {
  const x = tx * TILE_SIZE;
  const y = ty * TILE_SIZE;
  const s = TILE_SIZE;

  switch (type) {
    case "tree": {
      // grass base peek
      px(ctx, x, y, s, s, "#6fb84a");
      // shadow
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.beginPath();
      ctx.ellipse(x + s / 2, y + s - 3, 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      // trunk
      ctx.fillStyle = "#5a3a1f";
      ctx.fillRect(x + 14, y + 18, 4, 10);
      ctx.fillStyle = "#7a5230";
      ctx.fillRect(x + 15, y + 19, 2, 8);
      // canopy layered circles
      const drawLeaf = (cx: number, cy: number, r: number, base: string, hi: string) => {
        ctx.fillStyle = base;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = hi;
        ctx.beginPath();
        ctx.arc(cx - 2, cy - 2, r - 3, 0, Math.PI * 2);
        ctx.fill();
      };
      drawLeaf(x + s / 2, y + 10, 11, "#2f6b32", "#3f8b3a");
      drawLeaf(x + s / 2 - 7, y + 14, 7, "#286030", "#3a8038");
      drawLeaf(x + s / 2 + 7, y + 14, 7, "#286030", "#3a8038");
      break;
    }
    case "stump": {
      px(ctx, x, y, s, s, "#6fb84a");
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.beginPath();
      ctx.ellipse(x + s / 2, y + s - 4, 8, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      // stump body
      ctx.fillStyle = "#7a5230";
      ctx.fillRect(x + 10, y + 18, 12, 8);
      ctx.fillStyle = "#a36b36";
      ctx.fillRect(x + 10, y + 18, 12, 3);
      // rings
      ctx.fillStyle = "#5a3a1f";
      ctx.fillRect(x + 13, y + 21, 6, 2);
      ctx.fillStyle = "#8a5a2f";
      ctx.fillRect(x + 14, y + 21, 4, 1);
      break;
    }
    case "rock": {
      px(ctx, x, y, s, s, "#6fb84a");
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.beginPath();
      ctx.ellipse(x + s / 2, y + s - 4, 9, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#8a8a8a";
      ctx.beginPath();
      ctx.arc(x + s / 2, y + s / 2 + 2, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#a8a8a8";
      ctx.beginPath();
      ctx.arc(x + s / 2 - 2, y + s / 2, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#6a6a6a";
      ctx.fillRect(x + s / 2 + 2, y + s / 2 + 3, 3, 2);
      break;
    }
    case "flower_bush": {
      px(ctx, x, y, s, s, "#6fb84a");
      ctx.fillStyle = "#3f8b3a";
      ctx.beginPath();
      ctx.arc(x + s / 2, y + s / 2 + 2, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#2f6b32";
      ctx.beginPath();
      ctx.arc(x + s / 2 + 3, y + s / 2 + 4, 6, 0, Math.PI * 2);
      ctx.fill();
      // flowers
      const flowerColors = ["#e7b94e", "#d9694e", "#f3f0e0", "#e0473a", "#c98ad9"];
      const seed = tx * 31 + ty * 17;
      for (let i = 0; i < 4; i++) {
        const ang = (i / 4) * Math.PI * 2 + (seed % 3);
        const fr = 5;
        const fx = x + s / 2 + Math.cos(ang) * fr;
        const fy = y + s / 2 + 2 + Math.sin(ang) * fr;
        const c = flowerColors[(seed + i) % flowerColors.length];
        ctx.fillStyle = c;
        ctx.fillRect(Math.round(fx) - 1, Math.round(fy) - 1, 2, 2);
        ctx.fillStyle = "#e7b94e";
        ctx.fillRect(Math.round(fx), Math.round(fy), 1, 1);
      }
      break;
    }
    case "bush": {
      px(ctx, x, y, s, s, "#6fb84a");
      ctx.fillStyle = "#2f6b32";
      ctx.beginPath();
      ctx.arc(x + s / 2 - 4, y + s / 2 + 2, 6, 0, Math.PI * 2);
      ctx.arc(x + s / 2 + 4, y + s / 2 + 2, 6, 0, Math.PI * 2);
      ctx.arc(x + s / 2, y + s / 2 - 1, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#3f8b3a";
      ctx.beginPath();
      ctx.arc(x + s / 2 - 2, y + s / 2, 3, 0, Math.PI * 2);
      ctx.fill();
      // berries
      ctx.fillStyle = "#9e2a2a";
      ctx.fillRect(x + s / 2 + 3, y + s / 2 + 1, 2, 2);
      ctx.fillRect(x + s / 2 - 4, y + s / 2 + 3, 2, 2);
      break;
    }
    case "lantern": {
      px(ctx, x, y, s, s, "#6fb84a");
      // post
      ctx.fillStyle = "#3a2412";
      ctx.fillRect(x + s / 2 - 1, y + 10, 2, 18);
      // lamp housing
      ctx.fillStyle = "#5a3a1f";
      ctx.fillRect(x + s / 2 - 5, y + 6, 10, 8);
      // glow
      ctx.fillStyle = "rgba(255, 210, 90, 0.85)";
      ctx.fillRect(x + s / 2 - 3, y + 8, 6, 4);
      ctx.fillStyle = "rgba(255, 240, 160, 0.5)";
      ctx.beginPath();
      ctx.arc(x + s / 2, y + 18, 9, 0, Math.PI * 2);
      ctx.fill();
      // top cap
      ctx.fillStyle = "#3a2412";
      ctx.fillRect(x + s / 2 - 6, y + 4, 12, 3);
      break;
    }
    case "crate": {
      px(ctx, x, y, s, s, "#6fb84a");
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.fillRect(x + 4, y + s - 4, s - 8, 3);
      ctx.fillStyle = "#a36b36";
      ctx.fillRect(x + 5, y + 8, 22, 20);
      ctx.fillStyle = "#7a4f2b";
      ctx.strokeStyle = "#5a3818";
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 5, y + 8, 22, 20);
      // cross planks
      ctx.beginPath();
      ctx.moveTo(x + 5, y + 8);
      ctx.lineTo(x + 27, y + 28);
      ctx.moveTo(x + 27, y + 8);
      ctx.lineTo(x + 5, y + 28);
      ctx.stroke();
      ctx.fillStyle = "#c08a52";
      ctx.fillRect(x + 7, y + 10, 18, 2);
      break;
    }
    case "barrel": {
      px(ctx, x, y, s, s, "#6fb84a");
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.beginPath();
      ctx.ellipse(x + s / 2, y + s - 4, 8, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#7a4f2b";
      ctx.fillRect(x + 8, y + 9, 16, 19);
      ctx.fillStyle = "#5a3818";
      ctx.fillRect(x + 8, y + 13, 16, 2);
      ctx.fillRect(x + 8, y + 22, 16, 2);
      ctx.fillStyle = "#a36b36";
      ctx.fillRect(x + 9, y + 10, 14, 2);
      ctx.fillRect(x + 9, y + 14, 14, 7);
      // top
      ctx.fillStyle = "#5a3818";
      ctx.beginPath();
      ctx.ellipse(x + s / 2, y + 9, 8, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#8a5a2f";
      ctx.beginPath();
      ctx.ellipse(x + s / 2, y + 9, 6, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "haystack": {
      px(ctx, x, y, s, s, "#6fb84a");
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.beginPath();
      ctx.ellipse(x + s / 2, y + s - 4, 10, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e0c060";
      ctx.beginPath();
      ctx.ellipse(x + s / 2, y + s / 2 + 4, 11, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#d9a83a";
      ctx.beginPath();
      ctx.ellipse(x + s / 2, y + s / 2 + 4, 11, 10, 0, 0, Math.PI);
      ctx.fill();
      // straw lines
      ctx.strokeStyle = "#b88820";
      ctx.lineWidth = 1;
      for (let i = -8; i <= 8; i += 3) {
        ctx.beginPath();
        ctx.moveTo(x + s / 2 + i, y + s / 2 - 3);
        ctx.lineTo(x + s / 2 + i, y + s / 2 + 10);
        ctx.stroke();
      }
      ctx.fillStyle = "#f0d878";
      ctx.beginPath();
      ctx.ellipse(x + s / 2 - 3, y + s / 2, 4, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "mushroom": {
      px(ctx, x, y, s, s, "#6fb84a");
      ctx.fillStyle = "#f3e8d0";
      ctx.fillRect(x + s / 2 - 2, y + s / 2 + 2, 4, 8);
      ctx.fillStyle = "#c93232";
      ctx.beginPath();
      ctx.arc(x + s / 2, y + s / 2 + 2, 7, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = "#e0473a";
      ctx.beginPath();
      ctx.arc(x + s / 2, y + s / 2 + 2, 5, Math.PI, 0);
      ctx.fill();
      // spots
      ctx.fillStyle = "#fff";
      ctx.fillRect(x + s / 2 - 3, y + s / 2 - 1, 2, 2);
      ctx.fillRect(x + s / 2 + 2, y + s / 2, 2, 2);
      // small mushroom
      ctx.fillStyle = "#f3e8d0";
      ctx.fillRect(x + s / 2 + 7, y + s / 2 + 6, 2, 4);
      ctx.fillStyle = "#c9902a";
      ctx.beginPath();
      ctx.arc(x + s / 2 + 8, y + s / 2 + 6, 3, Math.PI, 0);
      ctx.fill();
      break;
    }
    case "tombstone": {
      px(ctx, x, y, s, s, "#3a3328");
      // ground shadow
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.ellipse(x + s / 2, y + s - 4, 9, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#6a6258";
      ctx.beginPath();
      ctx.moveTo(x + 8, y + s - 6);
      ctx.lineTo(x + 8, y + 14);
      ctx.arc(x + s / 2, y + 14, 8, Math.PI, 0);
      ctx.lineTo(x + s - 8, y + s - 6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#8a8278";
      ctx.fillRect(x + 10, y + 14, 12, 3);
      // RIP engraving
      ctx.fillStyle = "#3a3328";
      ctx.fillRect(x + s / 2 - 4, y + 16, 1, 6);
      ctx.fillRect(x + s / 2 - 4, y + 16, 4, 1);
      ctx.fillRect(x + s / 2 - 4, y + 18, 3, 1);
      ctx.fillRect(x + s / 2 + 1, y + 16, 1, 6);
      ctx.fillRect(x + s / 2 + 1, y + 16, 3, 1);
      ctx.fillRect(x + s / 2 + 1, y + 18, 3, 1);
      ctx.fillRect(x + s / 2 + 1, y + 21, 3, 1);
      break;
    }
    case "ruin_pillar": {
      px(ctx, x, y, s, s, "#6a6258");
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(x + 6, y + s - 4, 20, 3);
      ctx.fillStyle = "#8a8278";
      ctx.fillRect(x + 8, y + 6, 16, 22);
      ctx.fillStyle = "#6a6258";
      ctx.fillRect(x + 8, y + 6, 16, 3);
      ctx.fillRect(x + 8, y + 25, 16, 3);
      // crack
      ctx.fillStyle = "#4a4238";
      ctx.fillRect(x + 14, y + 10, 1, 8);
      ctx.fillRect(x + 15, y + 14, 1, 6);
      // moss
      ctx.fillStyle = "#3f8b3a";
      ctx.fillRect(x + 9, y + 22, 3, 2);
      ctx.fillRect(x + 20, y + 18, 2, 2);
      break;
    }
  }
}
