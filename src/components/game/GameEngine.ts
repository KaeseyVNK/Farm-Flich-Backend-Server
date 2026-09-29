// The canvas game engine. Handles rendering, player movement, collision,
// tile interaction, time progression, and day/night visuals.

import {
  TILE_SIZE,
  MAP_COLS,
  MAP_ROWS,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  T,
} from "@/lib/game/constants";
import { CROPS, NPCS, getItem } from "@/lib/game/data";
import { useGameStore } from "@/store/gameStore";
import { useInventoryStore } from "@/store/inventoryStore";
import { useFarmStore } from "@/store/farmStore";
import { useNpcStore } from "@/store/npcStore";
import { useUiStore } from "@/store/uiStore";
import { gameActions } from "@/lib/game/actions";
import { registerGameBridge } from "@/lib/game/bridge";
import { resumeAudio } from "@/lib/game/sfx";
import { tryInteract } from "@/lib/game/interact";
import { isGameplayBlocked } from "@/lib/game/ui-gate";
import { generateZoneMap, type ZoneData, type DecorEntry } from "@/lib/game/zone-manager";
import { isBuildingTile } from "@/lib/game/building-footprints";
import { FARM_HOUSE } from "@/lib/game/farm-scenery-layout";
import {
  drawTile,
  drawCrop,
  drawForage,
  drawPlacedObject,
  drawPlayer,
  drawNpc,
  drawBuilding,
  drawDecor,
  type Facing,
} from "./textures";

interface NpcEntity {
  id: string;
  x: number; // pixel pos (center of tile)
  y: number;
  targetX: number;
  targetY: number;
  facing: Facing;
}

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private raf = 0;
  private running = false;
  private lastTs = 0;

  // player
  private px = 19 * TILE_SIZE + TILE_SIZE / 2;
  private py = 20 * TILE_SIZE + TILE_SIZE / 2;
  private facing: Facing = "up";
  private walkPhase = 0;
  private speed = 2.4; // px per frame baseline

  // input
  private keys: Record<string, boolean> = {};
  private interactCooldown = 0;

  // camera
  private camX = 0;
  private camY = 0;
  private viewW = 800;
  private viewH = 600;

  // npcs
  private npcs: NpcEntity[] = [];

  // zone decor cache (generated once per zone)
  private zoneDecor: DecorEntry[] = [];

  // day/night overlay color cache
  private lastDay = 1;

  // interaction feedback
  private actionFlash = 0;
  private actionFlashColor = "#fff";

  // ---- Performance: offscreen terrain cache ----
  // The full map terrain is rendered once to an offscreen canvas and only
  // rebuilt when the farm `version` or season changes. Each frame we just
  // blit the visible sub-rectangle — O(1) drawImage instead of ~600 drawTile
  // calls per frame.
  private terrainCanvas: HTMLCanvasElement | null = null;
  private terrainCtx: CanvasRenderingContext2D | null = null;
  private terrainCacheVersion = -1;
  private terrainCacheSeason: string = "";

  // ---- Performance: farm snapshot caching ----
  // Cache the farm store snapshot between frames; only re-fetch when the
  // store `version` bumps (i.e. a tile/crop/object/forage changed).
  private farmVersion = -1;
  private farmSnapshot: {
    terrain: number[];
    crops: Record<number, { cropId: string; stage: number; daysGrown: number; watered: boolean; dead: boolean }>;
    objects: Record<number, { type: string }>;
    forage: Record<number, string>;
    shippingBoxes: Record<number, { tileIndex: number; contents: Record<string, number> }>;
  } | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;

    // init npcs at home tiles
    this.npcs = Object.values(NPCS).map((n) => ({
      id: n.id,
      x: n.home.x * TILE_SIZE + TILE_SIZE / 2,
      y: n.home.y * TILE_SIZE + TILE_SIZE / 2,
      targetX: n.home.x * TILE_SIZE + TILE_SIZE / 2,
      targetY: n.home.y * TILE_SIZE + TILE_SIZE / 2,
      facing: "down" as Facing,
    }));

    // Generate farm zone decor once at startup
    const farmZone = generateZoneMap("farm");
    this.zoneDecor = farmZone.decor;

    this.bindInput();
    this.resize();
    registerGameBridge({
      teleportToTile: (x, y) => this.teleport(x, y),
      getPlayerTile: () => ({
        x: Math.floor(this.px / TILE_SIZE),
        y: Math.floor(this.py / TILE_SIZE),
      }),
      focusCameraOnTile: (x, y) => {
        this.camX = x * TILE_SIZE - this.viewW / 2;
        this.camY = y * TILE_SIZE - this.viewH / 2;
      },
      setVirtualKey: (key, down) => {
        // Touch D-pad: set movement keys directly (bypasses modal-open check
        // since the D-pad is only shown when no modal is open)
        this.keys[key] = down;
        if (down) resumeAudio();
      },
      triggerInteract: () => {
        if (!this.isModalOpen()) {
          resumeAudio();
          this.tryInteract();
        }
      },
    });
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTs = performance.now();
    this.loop(this.lastTs);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.unbindInput();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.viewW = Math.max(320, Math.floor(rect.width));
    this.viewH = Math.max(240, Math.floor(rect.height));
    this.canvas.width = Math.floor(this.viewW * dpr);
    this.canvas.height = Math.floor(this.viewH * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
  }

  teleport(tx: number, ty: number) {
    this.px = tx * TILE_SIZE + TILE_SIZE / 2;
    this.py = ty * TILE_SIZE + TILE_SIZE / 2;
    this.camX = this.px - this.viewW / 2;
    this.camY = this.py - this.viewH / 2;
  }

  // ---------- Input ----------
  private onKeyDown = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    const k = e.key.toLowerCase();
    // Don't capture gameplay keys when a React modal/overlay is open
    if (this.isModalOpen()) {
      return;
    }
    // Resume the AudioContext on first user interaction (browser autoplay policy)
    resumeAudio();
    this.keys[k] = true;
    // prevent scroll for arrows/space
    if (
      ["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "spacebar"].includes(k)
    ) {
      e.preventDefault();
    }
    if (k === " " || k === "e" || k === "enter") {
      this.tryInteract();
    }
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys[e.key.toLowerCase()] = false;
  };

  private isModalOpen(): boolean {
    // Shared gate — overlays + raid phase (raid full-screen che viewport, gameplay
    // bên dưới đóng băng). Trước đây duplicate list ở 4 nơi → raid phase không
    // được thêm → WASD vẫn di chuyển sau raid backdrop. Dùng chung helper.
    return isGameplayBlocked();
  }
  private bindInput() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("resize", this.onResize);
  }
  private unbindInput() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("resize", this.onResize);
  }
  private onResize = () => this.resize();

  // ---------- Main loop ----------
  private loop = (ts: number) => {
    if (!this.running) return;
    const dt = Math.min(50, ts - this.lastTs); // ms, clamp
    this.lastTs = ts;
    this.update(dt);
    this.render();
    this.raf = requestAnimationFrame(this.loop);
  };

  private update(dt: number) {
    // Overlay/raid gate — đóng băng tick + movement + collapse khi modal/panel
    // mở hoặc raid full-screen. Trước đây chỉ chặn keydown (held keys vẫn move),
    // tick advance dựa `g.paused` (GameLayout) mà raid phase không set paused →
    // in-game clock chạy trong lúc raid. Dùng shared gate (ui-gate).
    if (isGameplayBlocked()) return;

    // time progression
    const g = useGameStore.getState();
    if (!g.paused) {
      g.tick(dt);
    }
    // auto end-day at 2am collapse (skip when a modal overlay is open — same gate
    // as FarmScene/endDay: collapse xuyên shop/dialogue → toast ngày mới đè modal,
    // trông như UI vỡ. endDay tự chặn nếu modal mở (H6); ta không clear needsSleep
    // để frame sau (khi modal đóng) retry collapse).
    if (g.needsSleep && !isGameplayBlocked()) {
      useUiStore.getState().notify("Bạn kiệt sức ngã gục! Tự động đi ngủ...", "warn");
      gameActions.endDay(true);
      useGameStore.getState().clearNeedsSleep();
    }
    // detect new day -> run endDay side effects once
    if (g.day !== this.lastDay) {
      this.lastDay = g.day;
    }

    // movement
    let dx = 0;
    let dy = 0;
    if (this.keys["w"] || this.keys["arrowup"]) dy -= 1;
    if (this.keys["s"] || this.keys["arrowdown"]) dy += 1;
    if (this.keys["a"] || this.keys["arrowleft"]) dx -= 1;
    if (this.keys["d"] || this.keys["arrowright"]) dx += 1;

    const moving = dx !== 0 || dy !== 0;
    if (moving) {
      // normalize
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
      // facing (prioritize horizontal if both)
      if (Math.abs(dx) > Math.abs(dy)) {
        this.facing = dx > 0 ? "right" : "left";
      } else {
        this.facing = dy > 0 ? "down" : "up";
      }
      // Exhausted state: movement slowed to 55% speed.
      const exhausted = useGameStore.getState().energy <= 0;
      const step = this.speed * (dt / 16.67) * (exhausted ? 0.55 : 1);
      const nx = this.px + dx * step;
      const ny = this.py + dy * step;
      // collision: check target tile; allow sliding on axes separately
      if (!this.collides(nx, this.py)) this.px = nx;
      if (!this.collides(this.px, ny)) this.py = ny;
      // clamp to world
      this.px = Math.max(8, Math.min(WORLD_WIDTH - 8, this.px));
      this.py = Math.max(8, Math.min(WORLD_HEIGHT - 8, this.py));
      this.walkPhase += dt * 0.012;
    } else {
      this.walkPhase = 0;
    }

    // auto-pickup forage on current tile
    const curTileX = Math.floor(this.px / TILE_SIZE);
    const curTileY = Math.floor(this.py / TILE_SIZE);
    const farm = useFarmStore.getState();
    const forageItemId = farm.forage[curTileY * MAP_COLS + curTileX];
    if (forageItemId) {
      const inv = useInventoryStore.getState();
      // pick-up trên tile khi di chuyển: pickupForage delete khỏi farmStore TRƯỚC
      // khi addItem → túi đầy = mất forage im lặng. Kiểm tra leftover trước, nếu
      // không chứa được thì GIỮ forage trên map (không xóa) + warn. Trước đây xóa
      // rồi mới add → data loss.
      const left = inv.addItem(forageItemId, 1);
      if (left > 0) {
        useUiStore.getState().notify(`Túi đầy — không nhặt được ${getItem(forageItemId)?.name}`, "warn");
      } else {
        farm.pickupForage(curTileX, curTileY);
        useUiStore.getState().notify(`Nhặt được ${getItem(forageItemId)?.name}`, "success");
      }
    }

    // NPC schedule-driven movement: pick the schedule point for the current hour
    const gameHour = Math.floor(useGameStore.getState().timeMinutes / 60);
    for (const npc of this.npcs) {
      const def = NPCS[npc.id];
      // Determine the active schedule point (latest hour <= current)
      let active = def.schedulePoints[0];
      for (const sp of def.schedulePoints) {
        if (sp.hour <= gameHour) active = sp;
      }
      const targetX = active.x * TILE_SIZE + TILE_SIZE / 2;
      const targetY = active.y * TILE_SIZE + TILE_SIZE / 2;
      npc.targetX = targetX;
      npc.targetY = targetY;
      const ddx = npc.targetX - npc.x;
      const ddy = npc.targetY - npc.y;
      const dlen = Math.hypot(ddx, ddy);
      if (dlen > 1.5) {
        const sp = 0.8 * (dt / 16.67);
        npc.x += (ddx / dlen) * sp;
        npc.y += (ddy / dlen) * sp;
        if (Math.abs(ddx) > Math.abs(ddy)) npc.facing = ddx > 0 ? "right" : "left";
        else npc.facing = ddy > 0 ? "down" : "up";
      }
    }

    // camera follow with clamp
    const targetCamX = this.px - this.viewW / 2;
    const targetCamY = this.py - this.viewH / 2;
    this.camX += (targetCamX - this.camX) * 0.12;
    this.camY += (targetCamY - this.camY) * 0.12;
    this.camX = Math.max(0, Math.min(Math.max(0, WORLD_WIDTH - this.viewW), this.camX));
    this.camY = Math.max(0, Math.min(Math.max(0, WORLD_HEIGHT - this.viewH), this.camY));

    if (this.interactCooldown > 0) this.interactCooldown -= dt;
    if (this.actionFlash > 0) this.actionFlash -= dt;
  }

  private collides(nx: number, ny: number): boolean {
    // check the tile the player's center would be in, plus a small bounding box
    const farm = useFarmStore.getState();
    const half = 8;
    const checks = [
      [nx - half, ny - half],
      [nx + half, ny - half],
      [nx - half, ny + half],
      [nx + half, ny + half],
      [nx, ny],
    ];
    for (const [cx, cy] of checks) {
      const tx = Math.floor(cx / TILE_SIZE);
      const ty = Math.floor(cy / TILE_SIZE);
      if (tx < 0 || ty < 0 || tx >= MAP_COLS || ty >= MAP_ROWS) return true;
      const t = farm.terrain[ty * MAP_COLS + tx];
      if (t === T.WATER || t === T.TREE || t === T.ROCK || t === T.FENCE || t === T.FLOWER_BUSH) {
        return true;
      }
      // buildings collision (hardcoded footprints)
      if (this.isBuildingTile(tx, ty)) return true;
      const obj = farm.objects[ty * MAP_COLS + tx];
      if (obj?.type === "fence") return true;
    }
    // NPC collision
    for (const npc of this.npcs) {
      // NPC hitbox scale theo TILE_SIZE — trước đây cứng 14px (thiết kế cho tile 32),
      // với TILE_SIZE 48 hitbox quá nhỏ → player lọt qua NPC. 0.35*TILE_SIZE ≈ 17px.
      const hit = TILE_SIZE * 0.35;
      if (Math.abs(npc.x - nx) < hit && Math.abs(npc.y - ny) < hit) return true;
    }
    return false;
  }

  private isBuildingTile(tx: number, ty: number): boolean {
    return isBuildingTile(tx, ty);
  }

  // ---------- Interaction ----------
  private getFacingTile(): { x: number; y: number } {
    const cx = Math.floor(this.px / TILE_SIZE);
    const cy = Math.floor(this.py / TILE_SIZE);
    let fx = cx;
    let fy = cy;
    if (this.facing === "up") fy = cy - 1;
    else if (this.facing === "down") fy = cy + 1;
    else if (this.facing === "left") fx = cx - 1;
    else if (this.facing === "right") fx = cx + 1;
    return { x: fx, y: fy };
  }

  private tryInteract() {
    if (this.interactCooldown > 0) return;
    this.interactCooldown = 180;
    const facingTile = this.getFacingTile();
    const playerTile = {
      x: Math.floor(this.px / TILE_SIZE),
      y: Math.floor(this.py / TILE_SIZE),
    };
    // Shared tile-interaction logic (also used by the Phaser FarmScene).
    tryInteract({
      facingTile,
      playerTile,
      npcs: this.npcs
        .filter((n) => Math.abs(n.x / TILE_SIZE - playerTile.x) <= 1 && Math.abs(n.y / TILE_SIZE - playerTile.y) <= 1)
        .map((n) => ({
          id: n.id,
          tx: Math.floor(n.x / TILE_SIZE),
          ty: Math.floor(n.y / TILE_SIZE),
        })),
      flash: (color) => this.flash(color),
    });
  }

  private flash(color: string) {
    this.actionFlash = 220;
    this.actionFlashColor = color;
  }

  // ---- Performance: cached farm snapshot ----
  // Returns the farm state, re-fetching from the store only when `version`
  // bumps. This avoids calling getState() + spreading every frame when the
  // vast majority of frames have no farm mutation.
  private getFarmSnapshot() {
    const farm = useFarmStore.getState();
    if (farm.version !== this.farmVersion || !this.farmSnapshot) {
      this.farmVersion = farm.version;
      // Shallow-copy the mutable collections so React/Zustand don't see reads
      // during the render loop; the snapshot is frozen until next version bump.
      this.farmSnapshot = {
        terrain: farm.terrain,
        crops: farm.crops,
        objects: farm.objects,
        forage: farm.forage,
        shippingBoxes: farm.shippingBoxes,
      };
    }
    return this.farmSnapshot;
  }

  // ---- Performance: offscreen terrain cache ----
  // Renders the entire map terrain (all MAP_COLS×MAP_ROWS tiles) to an
  // offscreen canvas once, then blits the visible region each frame.
  // Rebuilds only when farm.version or season changes.
  private rebuildTerrainCache(season: string) {
    const farm = useFarmStore.getState();
    const version = farm.version;
    if (
      this.terrainCanvas &&
      this.terrainCacheVersion === version &&
      this.terrainCacheSeason === season
    ) {
      return; // cache still valid
    }
    if (!this.terrainCanvas) {
      this.terrainCanvas = document.createElement("canvas");
      this.terrainCanvas.width = WORLD_WIDTH;
      this.terrainCanvas.height = WORLD_HEIGHT;
      this.terrainCtx = this.terrainCanvas.getContext("2d", { alpha: false });
    }
    const tctx = this.terrainCtx;
    if (!tctx) return;
    tctx.imageSmoothingEnabled = false;
    // Fill base
    tctx.fillStyle = "#6fb84a";
    tctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    // Render every tile once
    for (let ty = 0; ty < MAP_ROWS; ty++) {
      for (let tx = 0; tx < MAP_COLS; tx++) {
        drawTile(tctx, farm.terrain[ty * MAP_COLS + tx], tx, ty, season as never);
      }
    }
    this.terrainCacheVersion = version;
    this.terrainCacheSeason = season;
  }

  // ---------- Render ----------
  private render() {
    const ctx = this.ctx;
    const game = useGameStore.getState();
    const camX = Math.floor(this.camX);
    const camY = Math.floor(this.camY);

    // sky background (seasonal)
    ctx.fillStyle = "#bfe3ff";
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    // ---- Terrain: blit from offscreen cache (rebuilt only on change) ----
    this.rebuildTerrainCache(game.season);
    if (this.terrainCanvas) {
      // Draw the visible sub-rectangle of the cached terrain.
      // Clamp source rect to world bounds.
      const srcX = Math.max(0, camX);
      const srcY = Math.max(0, camY);
      const srcW = Math.min(WORLD_WIDTH - srcX, this.viewW);
      const srcH = Math.min(WORLD_HEIGHT - srcY, this.viewH);
      const dstX = Math.max(0, -camX);
      const dstY = Math.max(0, -camY);
      if (srcW > 0 && srcH > 0) {
        ctx.drawImage(
          this.terrainCanvas,
          srcX,
          srcY,
          srcW,
          srcH,
          dstX,
          dstY,
          srcW,
          srcH,
        );
      }
    }

    // Use the cached farm snapshot (re-fetched only on version bump)
    const farm = this.getFarmSnapshot();

    // visible tile range (for culling dynamic layers)
    const startCol = Math.max(0, Math.floor(camX / TILE_SIZE));
    const endCol = Math.min(MAP_COLS - 1, Math.ceil((camX + this.viewW) / TILE_SIZE));
    const startRow = Math.max(0, Math.floor(camY / TILE_SIZE));
    const endRow = Math.min(MAP_ROWS - 1, Math.ceil((camY + this.viewH) / TILE_SIZE));

    // Apply camera transform to canvas for world-space object rendering
    ctx.save();
    ctx.translate(-camX, -camY);

    // buildings (drawn at their fixed world footprints)
    drawBuilding(ctx, "house", FARM_HOUSE.tx, FARM_HOUSE.ty, FARM_HOUSE.cols, FARM_HOUSE.rows);
    // Robin's shop / town-hall draws removed with their BUILDING_FOOTPRINTS rows
    // (farm-MAX) — drawing a building its collision no longer blocks lets the
    // player walk through it on the Canvas2D rollback path (?sprite=off).

    // zone decor (trees, rocks, flowers, bushes, props) — world space
    for (const d of this.zoneDecor) {
      if (d.x < startCol - 1 || d.x > endCol + 1 || d.y < startRow - 1 || d.y > endRow + 1) continue;
      drawDecor(ctx, d.type, d.x, d.y);
    }

    // placed objects
    for (const key of Object.keys(farm.objects)) {
      const i = Number(key);
      const tx = i % MAP_COLS;
      const ty = Math.floor(i / MAP_COLS);
      if (tx < startCol - 1 || tx > endCol + 1 || ty < startRow - 1 || ty > endRow + 1) continue;
      const obj = farm.objects[i];
      const hasContents =
        obj.type === "shipping_box" &&
        !!farm.shippingBoxes[i] &&
        Object.values(farm.shippingBoxes[i].contents).reduce((a, b) => a + b, 0) > 0;
      drawPlacedObject(ctx, obj.type as "fence" | "sprinkler" | "shipping_box", tx, ty, hasContents);
    }

    // forage
    for (const key of Object.keys(farm.forage)) {
      const i = Number(key);
      const tx = i % MAP_COLS;
      const ty = Math.floor(i / MAP_COLS);
      if (tx < startCol - 1 || tx > endCol + 1 || ty < startRow - 1 || ty > endRow + 1) continue;
      drawForage(ctx, farm.forage[i], tx, ty);
    }

    // crops
    for (const key of Object.keys(farm.crops)) {
      const i = Number(key);
      const tx = i % MAP_COLS;
      const ty = Math.floor(i / MAP_COLS);
      if (tx < startCol - 1 || tx > endCol + 1 || ty < startRow - 1 || ty > endRow + 1) continue;
      const c = farm.crops[i];
      const def = CROPS[c.cropId];
      if (!def) continue;
      drawCrop(ctx, c.cropId, c.stage, def.stages, tx, ty, c.dead);
    }

    // NPCs
    for (const npc of this.npcs) {
      drawNpc(ctx, NPCS[npc.id], npc.x, npc.y, npc.facing);
    }

    // player (drawn in world coordinates)
    const isMoving =
      this.keys["w"] ||
      this.keys["s"] ||
      this.keys["a"] ||
      this.keys["d"] ||
      this.keys["arrowup"] ||
      this.keys["arrowdown"] ||
      this.keys["arrowleft"] ||
      this.keys["arrowright"];
    drawPlayer(ctx, this.px, this.py, this.facing, this.walkPhase, Boolean(isMoving));

    // facing tile highlight
    const f = this.getFacingTile();
    if (f.x >= 0 && f.y >= 0 && f.x < MAP_COLS && f.y < MAP_ROWS) {
      const hx = f.x * TILE_SIZE;
      const hy = f.y * TILE_SIZE;
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.strokeRect(hx + 1, hy + 1, TILE_SIZE - 2, TILE_SIZE - 2);
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = "#fff";
      ctx.fillRect(hx, hy, TILE_SIZE, TILE_SIZE);
      ctx.restore();
    }

    // Restore camera transform for screen-space overlays
    ctx.restore();

    // action flash
    if (this.actionFlash > 0) {
      ctx.save();
      ctx.globalAlpha = (this.actionFlash / 220) * 0.3;
      ctx.fillStyle = this.actionFlashColor;
      ctx.fillRect(0, 0, this.viewW, this.viewH);
      ctx.restore();
    }

    // day/night overlay
    this.renderDayNight(ctx, game.timeMinutes);

    // vignette
    const grad = ctx.createRadialGradient(
      this.viewW / 2,
      this.viewH / 2,
      this.viewH * 0.3,
      this.viewW / 2,
      this.viewH / 2,
      this.viewH * 0.75,
    );
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.viewW, this.viewH);
  }

  private renderDayNight(ctx: CanvasRenderingContext2D, minutes: number) {
    // Continuous hour (0..~26). Smooth color-temperature transitions across the day.
    // Phases: 0-6 deep night, 6-7 dawn warm, 7-12 morning clear, 12-17 bright noon,
    // 17-20 dusk orange/purple, 20-26 night blue.
    const h = minutes / 60;

    // Helper: linear interpolate between two [r,g,b] colors
    const lerp = (a: number[], b: number[], t: number) => [
      Math.round(a[0] + (b[0] - a[0]) * t),
      Math.round(a[1] + (b[1] - a[1]) * t),
      Math.round(a[2] + (b[2] - a[2]) * t),
    ];

    // Color stops: [hour, [r,g,b], alpha]
    const STOPS: { h: number; c: number[]; a: number }[] = [
      { h: 0, c: [18, 26, 64], a: 0.55 }, // deep night
      { h: 5, c: [18, 26, 64], a: 0.5 },
      { h: 6, c: [255, 170, 110], a: 0.18 }, // dawn glow
      { h: 7.5, c: [255, 230, 170], a: 0.06 }, // early morning
      { h: 12, c: [255, 250, 220], a: 0.0 }, // bright noon (clear)
      { h: 16, c: [255, 250, 220], a: 0.0 },
      { h: 17.5, c: [255, 150, 70], a: 0.16 }, // dusk orange
      { h: 19, c: [180, 90, 120], a: 0.26 }, // purple dusk
      { h: 20.5, c: [40, 50, 110], a: 0.4 }, // twilight blue
      { h: 22, c: [20, 30, 70], a: 0.5 }, // night
      { h: 26, c: [18, 26, 64], a: 0.55 }, // late night
    ];

    // find surrounding stops
    let lo = STOPS[0];
    let hi = STOPS[STOPS.length - 1];
    for (let i = 0; i < STOPS.length - 1; i++) {
      if (h >= STOPS[i].h && h <= STOPS[i + 1].h) {
        lo = STOPS[i];
        hi = STOPS[i + 1];
        break;
      }
    }
    const span = hi.h - lo.h || 1;
    const t = Math.max(0, Math.min(1, (h - lo.h) / span));
    const c = lerp(lo.c, hi.c, t);
    const a = lo.a + (hi.a - lo.a) * t;

    if (a > 0.005) {
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
      ctx.fillRect(0, 0, this.viewW, this.viewH);
      ctx.restore();

      // Dawn/dusk directional warmth: a soft gradient from the horizon edge
      if (h >= 5.5 && h <= 8) {
        // dawn — warm from the east (right)
        const g = ctx.createLinearGradient(this.viewW, 0, 0, 0);
        g.addColorStop(0, "rgba(255,180,120,0.18)");
        g.addColorStop(0.5, "rgba(255,180,120,0.05)");
        g.addColorStop(1, "rgba(255,180,120,0)");
        ctx.save();
        ctx.globalCompositeOperation = "overlay";
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, this.viewW, this.viewH);
        ctx.restore();
      } else if (h >= 17 && h <= 20) {
        // dusk — warm from the west (left)
        const g = ctx.createLinearGradient(0, 0, this.viewW, 0);
        g.addColorStop(0, "rgba(255,140,70,0.2)");
        g.addColorStop(0.5, "rgba(255,140,70,0.06)");
        g.addColorStop(1, "rgba(255,140,70,0)");
        ctx.save();
        ctx.globalCompositeOperation = "overlay";
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, this.viewW, this.viewH);
        ctx.restore();
      }
    }
  }
}
