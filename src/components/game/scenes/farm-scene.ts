// FarmScene — main farm scene. ADR-002 + ADR-003.
// Phase 2 SKELETON: terrain procedural tạm (graphics rects), player sprite tạm, camera follow.
// Phase 3: tilemap sprite replacement + terrain collision layer.
// Bridge cleanup tại shutdown (ADR-002) — Zustand unsub.
import Phaser from "phaser";
import { TILE_SIZE, T, SCALE, SEASON_THEME, type Season } from "@/lib/game/constants";
import {
  createCamState,
  updateCamera,
  cameraFinalPos,
  clampCamera,
  quantizeForZoom,
} from "@/lib/game/phaser/camera-smoothing";
import { overlaySize } from "@/lib/game/phaser/farm-camera";
import { specForEvent, applyReducedMotion, type FeedbackSpec } from "@/lib/game/feedback/feedback-bundle";
import { createActionState, feedKeyboard, endFrame, InputAction, type ActionState } from "@/lib/game/input/action-map";
import { loadRebinding } from "@/lib/game/input/rebinding";
import { registerGameBridge, type TravelSpot } from "@/lib/game/bridge";
import { tryInteract } from "@/lib/game/interact";
import { isGameplayBlocked } from "@/lib/game/ui-gate";
import { TerrainSpriteRenderer } from "@/components/game/phaser/terrain-sprite-renderer";
import { FarmSceneryRenderer } from "@/components/game/phaser/farm-scenery-renderer";
import { enableVillageFestival } from "@/lib/game/scenery/village-layout";
import { isFestivalDay } from "@/lib/game/festival/festival-schedule";
import { DecorRenderer } from "@/components/game/phaser/decor-renderer";
import { CombatController } from "@/components/game/phaser/combat-controller";
import { useDecorModeStore } from "@/store/decorModeStore";
import { decorById } from "@/lib/game/decor/decor-catalog";
import { footprintOf } from "@/lib/game/decor/decor-placement";
import {
  canPlaceAtCursor,
  decorPlaceAtCursor,
  decorPickAtCursor,
  decorRotateAtCursor,
  decorSyncTarget,
} from "@/lib/game/decor/decor-commands";
import { CropSpriteRenderer } from "@/components/game/phaser/crop-sprite-renderer";
import { FarmEntitySpriteRenderer } from "@/components/game/phaser/farm-entity-sprite-renderer";
import { useGameStore } from "@/store/gameStore";
import { useFarmStore } from "@/store/farmStore";
import { useUiStore } from "@/store/uiStore";
import { useWorldStore } from "@/store/worldStore";
import { useInventoryStore } from "@/store/inventoryStore";
import { useProgressionStore } from "@/store/progressionStore";
import { xpMultiplier } from "@/lib/game/buff";
import { COZY_DEATH, faintPenalty } from "@/lib/game/combat/cozy-death";
import { useFishingStore, setFishingWaterLabel } from "@/store/fishingStore";
import { siloCapacity, siloUsed } from "@/lib/game/silo";
import { gameActions } from "@/lib/game/actions";
import { NPCS } from "@/lib/game/data";
import { getZone, findWarp } from "@/lib/game/zones";
import { slideMove } from "@/lib/game/phaser/axis-move";
import { ensureFrame, textureHas } from "@/lib/game/phaser/texture-frames";
import { getItem } from "@/lib/game/data";
import { mountById, MOUNTS } from "@/lib/game/mounts/mount-catalog";
import { FARM_STABLE } from "@/lib/game/farm-scenery-layout";
import { useMountStore } from "@/store/mountStore";
import {
  idleSession,
  nextFishing,
  type FishingSession,
} from "@/lib/game/fishing/fishing-sm";
import { nearestWaterTile, tryStartFishing } from "@/lib/game/fishing/fishing-session";
import { fryGrowDays, isFryItemId, waterTypeAt } from "@/lib/game/fish-catalog";
import { fishingRng } from "@/lib/game/fishing/fishing-rng";
import { advanceVelocity, DEFAULT_KINETICS, mountKinetics } from "@/lib/game/phaser/movement-kinetics";
import { speedMultiplier, scaleKinetics } from "@/lib/game/buff";
import { dayLightAt } from "@/lib/game/phaser/day-night";
import { nextLocomotion, type LocomotionState } from "@/lib/game/phaser/locomotion-state";
import { createFootstepFx } from "@/components/game/phaser/footstep-fx";
import { playSfx } from "@/lib/game/sfx";
import { createAmbientDirector } from "@/lib/game/audio/ambient-director";

const TILE_COLOR: Record<number, number> = {
  [T.GRASS]: 0x6fb84a,
  [T.GRASS_FLOWER]: 0x7cc36b,
  [T.PATH]: 0xc98a3a,
  [T.WATER]: 0x3a7ec9,
  [T.TILLED]: 0x8a6238,
  [T.TILLED_WET]: 0x5a4a36,
  [T.FALLOW]: 0xc4a574,
  [T.TREE]: 0x2e6b2a,
  [T.ROCK]: 0x8a8a8a,
  [T.SAND]: 0xe2cf9e,
  [T.BRIDGE]: 0x8a6238,
};

/** Số frame mỗi sheet (grid 32×32, 3 hàng d/u/a) — pack Maeve verified. */
export const FARMER_SHEET_FRAMES = { idle: 4, walk: 6, run: 8 } as const;

/** Action kind → tên sheet/anim tool (pack Alex: Hoe/Watering/Axe/Pickaxe). */
export const TOOL_ANIM_FOR_KIND = {
  till: "hoe",
  water: "water",
  chop: "axe",
  mine: "pickaxe",
} as const;

/** Frame count mỗi tool sheet (grid 32×32, 3 hàng d/u/a). Sword 10f (PIL probe W5). */
export const TOOL_SHEET_FRAMES = { hoe: 6, water: 8, axe: 6, pickaxe: 6, sword: 10 } as const;

const TOOL_SHEET_KEY = { hoe: "char.alex.hoe", water: "char.alex.water", axe: "char.alex.axe", pickaxe: "char.alex.pickaxe", sword: "char.alex.sword" } as const;

/**
 * Wave 1 P4 — Alex fishing pre-made sheets (frame 64×48, KHÁC 32×32 tool).
 * Hàng: 0=down, 1=up, 2=side (hẹp), 3=side-wide (rod vươn xa) — dùng hàng 3 cho side.
 */
export const FISHING_SHEETS = {
  cast: { key: "char.alex.fishing.cast", cols: 15, fps: 25 }, // 15f/25fps = 600ms khớp castMs
  wait: { key: "char.alex.fishing.wait", cols: 4, fps: 4 },
  bite: { key: "char.alex.fishing.bite", cols: 8, fps: 10 },
  reel: { key: "char.alex.fishing.reel", cols: 4, fps: 8 },
  catch: { key: "char.alex.fishing.catch", cols: 4, fps: 6 },
} as const;

export type FishingStage = keyof typeof FISHING_SHEETS;

/** anim key từ locomotion + facing ("a" = side, flipX cho trái). */
export function farmerAnimKey(anim: "idle" | "walk" | "run", facing: "up" | "down" | "left" | "right"): string {
  const dir = facing === "up" ? "u" : facing === "down" ? "d" : "a";
  return `farmer-${anim}-${dir}`;
}

export class FarmScene extends Phaser.Scene {
  private terrainRenderer = new TerrainSpriteRenderer();
  private cropRenderer = new CropSpriteRenderer();
  private entityRenderer = new FarmEntitySpriteRenderer();
  /** Static farm scenery — visual-only anchors for home, fields and pond. */
  private sceneryRenderer = new FarmSceneryRenderer();
  private decorRenderer = new DecorRenderer(); // W3P3: placedDecor crop-frame
  /** W6P3: mount id đang hiển thị trên farmerSprite (null = đi bộ) — drift-check. */
  private mountVisual: string | null = null;
  /** W5: quái + pickups deepforest (scene-local, sync theo zone). */
  private combat: CombatController | undefined;
  // W3P4: DecorMode cursor + preview (tái dùng qua các frame, destroy khi thoát).
  private decorCursorGfx: Phaser.GameObjects.Graphics | undefined;
  private decorPreviewImg: Phaser.GameObjects.Image | undefined;
  private terrainLayer?: Phaser.GameObjects.Rectangle[][];
  /** NPC entities (home pos, tĩnh cho MVP) — cho interact NPC mở dialogue trên Phaser path. */
  private npcs: { id: string; tx: number; ty: number }[] = [];
  private player?: Phaser.GameObjects.Rectangle;
  /** Visible player avatar follows the invisible collision/camera body. */
  private playerAvatar?: Phaser.GameObjects.Container;
  private farmerSprite?: Phaser.GameObjects.Sprite;
  /** Footstep dust + step sfx theo nhịp walk/run anim — destroy cùng avatar. */
  private footstepFx?: { destroy(): void };
  private cam = createCamState();
  private actions?: ActionState;
  private currentSeason: "Spring" | "Summer" | "Fall" | "Winter" = "Spring";
  private seasonUnsub?: () => void;
  private farmUnsub?: () => void;
  private worldUnsub?: () => void;
  private zoneCols = 60;
  private zoneRows = 60;
  private unregisterBridge?: () => void;
  /** W9P5 fix: scene đã shutdown/destroy — zustand subscriber KHÔNG render nữa.
   *  Destroy không qua shutdown (React StrictMode double-mount race dưới tải
   *  CPU) để subscription cũ sống sót → renderFallback vào factory chết →
   *  TypeError 'add' of null trong endDay→newDay→rerender. */
  private dead = false;
  /** Last movement direction — determines the interact-facing tile. "down" khớp frame idle-d-0 ban đầu. */
  private facing: "up" | "down" | "left" | "right" = "down";
  /** Velocity hiện tại (px/s) — kinetics accel/braking. */
  private pvx = 0;
  private pvy = 0;
  private loco: LocomotionState = { anim: "idle", facing: "down" };
  private interactCooldown = 0;
  /** >0 → đang chơi tool anim, khoá input di chuyển (ms còn lại). */
  private actionLockMs = 0;
  /** W1P4: session câu đang chạy — movement khoá, interact = tap/cancel. */
  private fishing: FishingSession | null = null;
  /** Bobber trên ô nước (graphics ellipse — destroy khi end). */
  private fishingBobber?: Phaser.GameObjects.Ellipse;
  /** Throttle đẩy reel snapshot vào fishingStore (ms còn lại). */
  private fishingUiThrottle = 0;
  /** Ignore warp tiles for a beat after teleport so spawn-adjacent doors don't bounce. */
  private warpCooldown = 0;
  /** Overlay ngày/đêm — fixed to camera, scene owns (auto-destroy on shutdown). */
  private nightOverlay?: Phaser.GameObjects.Rectangle;
  /** Camera trauma [0,1] for bounded world feedback (harvest etc.) — decays each frame. */
  private trauma = 0;
  /** Sampled once per feedback event so shake oscillates coherently instead of per-frame jitter. */
  private shakeNoiseX = 0;
  private shakeNoiseY = 0;
  /** Reduced-motion: kill shake (verification matrix §Accessibility). */
  private reduceMotion = false;
  /** User key bindings (phase 8 rebinding) — load 1 lần/init. */
  private kbBindings: Record<string, InputAction> = {};
  /** Ambient track theo zone + giờ (Task 12) — recreate trong init() cho restart. */
  private ambientDirector = createAmbientDirector();
  /** Blur/visibility listeners — clear keyboard held-state khi tab mất focus. */
  private blurClear: () => void = () => {};
  private visClear: () => void = () => {};
  /** Window WASD/arrows — HUD can steal Phaser canvas focus. */
  private onWindowKey: (e: KeyboardEvent) => void = () => {};

  /** Clear tất cả keyboard held actions + refcount (stuck-key recovery). */
  private clearKeyboardHeld(): void {
    if (!this.actions) return;
    this.actions.pressed.clear();
    this.actions.holdCount.clear();
    this.actions.heldCodes.clear();
  }

  constructor() {
    super({ key: "FarmScene" });
    // Phaser 4.2.1: Systems constructor KHÔNG propagate config.key vào
    // sys.settings.key (breaking change vs v3). SceneManager bootQueue đọc
    // newScene.sys.settings.key làm key đăng ký → nếu không set, mọi scene
    // đều thành 'default', getScene('FarmScene') trả null. Set thủ công.
    // Guard sys?.settings cho unit test (mock phaser không có sys).
    if (this.sys?.settings) this.sys.settings.key = "FarmScene";
  }

  init(): void {
    // ADR-002: reset state nội bộ (mảng, cờ) cho New Game+ reuse instance.
    // W9P5: cờ dead cũng reset — instance được reuse qua restart phải "sống lại".
    this.dead = false;
    // Ambient director: instance scene được reuse qua restart — destroy bản cũ
    // (stop mọi ambient loop) rồi tạo mới để `current` không mang track cũ của
    // run trước (destroy là no-op an toàn lần đầu khởi tạo).
    this.ambientDirector.destroy();
    this.ambientDirector = createAmbientDirector();
    this.terrainLayer = undefined;
    this.cropRenderer.destroy();
    this.entityRenderer.destroy();
    this.sceneryRenderer.destroy();
    this.decorRenderer.destroy();
    this.npcs = [];
    this.player = undefined;
    this.playerAvatar?.destroy();
    this.playerAvatar = undefined;
    this.farmerSprite = undefined;
    this.footstepFx?.destroy();
    this.footstepFx = undefined;
    // Scene owns overlay — auto-destroyed on shutdown, chỉ cần reset ref.
    this.nightOverlay = undefined;
    this.cam = createCamState();
    this.actions = createActionState();
    this.facing = "down";
    this.pvx = 0;
    this.pvy = 0;
    this.loco = { anim: "idle", facing: "down" };
    this.interactCooldown = 0;
    this.actionLockMs = 0;
    this.warpCooldown = 0;
    this.currentSeason = "Spring";
    this.unregisterBridge = undefined;
    this.trauma = 0;
    this.shakeNoiseX = 0;
    this.shakeNoiseY = 0;
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      this.reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    // Phase 8: load rebinding user (localStorage) — fallback default bindings.
    this.kbBindings = loadRebinding().keyboard;
  }

  create(): void {
    this.currentSeason = useGameStore.getState().season as typeof this.currentSeason;
    this.rebuildWorld(false);

    this.player = this.add.rectangle(
      9 * TILE_SIZE + TILE_SIZE / 2,
      22 * TILE_SIZE + TILE_SIZE / 2,
      TILE_SIZE * 0.6,
      TILE_SIZE * 0.8,
      0xe7b94e,
    );
    this.player.setVisible(false);
    this.playerAvatar = this.createPlayerAvatar(this.player.x, this.player.y);
    this.applyPendingSpawn();

    this.cameras.main.setBounds(0, 0, this.zoneCols * TILE_SIZE, this.zoneRows * TILE_SIZE);
    this.cameras.main.setZoom(2 / 3);
    this.snapCameraAfterMove();

    // Overlay ngày/đêm — fixed to camera, trên mọi layer trừ UI React.
    // Camera zoom 2/3 co rect scrollFactor(0) quanh tâm màn hình → rect 960×704
    // (game view) chỉ phủ 640×469 px. Phải kích thước view/zoom (farm-camera
    // helper) và đặt lệch nửa phần dư để phủ kín viewport bất kể world size.
    const camView = this.cameras.main;
    const { w: overlayW, h: overlayH } = overlaySize(
      camView.width,
      camView.height,
      camView.zoom,
    );
    this.nightOverlay = this.add.rectangle(
      (camView.width - overlayW) / 2,
      (camView.height - overlayH) / 2,
      overlayW,
      overlayH,
      0x10162e,
      0,
    );
    this.nightOverlay.setOrigin(0, 0);
    this.nightOverlay.setScrollFactor(0);
    this.nightOverlay.setDepth(9500);

    // Window-level keys: HUD overlays steal canvas focus, so Phaser's keyboard
    // plugin can miss WASD. Guard inputs/textareas the same way GameLayout does.
    this.onWindowKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      // W3P4: DecorMode ăn phím riêng (edge-trigger) — WASD/R/F/X/Space/Esc
      // không xuống action map khi đang trong chế độ.
      if (e.type === "keydown" && useDecorModeStore.getState().active) {
        const d = useDecorModeStore.getState();
        const layout = getZone(useWorldStore.getState().zone === "house" ? "house" : "farm");
        let handled = true;
        switch (e.code) {
          case "KeyW": case "ArrowUp": d.dispatch({ type: "move", dx: 0, dy: -1, cols: layout.cols, rows: layout.rows }); break;
          case "KeyS": case "ArrowDown": d.dispatch({ type: "move", dx: 0, dy: 1, cols: layout.cols, rows: layout.rows }); break;
          case "KeyA": case "ArrowLeft": d.dispatch({ type: "move", dx: -1, dy: 0, cols: layout.cols, rows: layout.rows }); break;
          case "KeyD": case "ArrowRight": d.dispatch({ type: "move", dx: 1, dy: 0, cols: layout.cols, rows: layout.rows }); break;
          case "KeyR": decorRotateAtCursor(); break;
          case "KeyF": d.dispatch({ type: "flip" }); break;
          case "KeyX": decorPickAtCursor(); break;
          case "Space": decorPlaceAtCursor(); break;
          case "Escape": d.dispatch({ type: "exit" }); break;
          default: handled = false;
        }
        if (handled) {
          e.preventDefault();
          decorSyncTarget();
          return;
        }
      }
      // W6P3: N toggle mount (edge-press) — KHÔNG dùng M: trùng hotkey map-panel
      // (KEY_TO_PANEL m → map — plan dặn kiểm keymap, bị sót lúc P3).
      if (e.code === "KeyN" && e.type === "keydown" && !e.repeat) this.toggleMount();
      if (this.actions) feedKeyboard(this.actions, e.code, e.type === "keydown", this.kbBindings);
    };
    window.addEventListener("keydown", this.onWindowKey);
    window.addEventListener("keyup", this.onWindowKey);

    // ADR-014: InputAction map indirection — feed keyboard → action state.
    // Gameplay đọc actions.pressed.has(MoveUp), không raw key codes.
    this.input.keyboard?.on("keydown", (e: KeyboardEvent) => {
      if (this.actions) feedKeyboard(this.actions, e.code, true, this.kbBindings);
    });
    this.input.keyboard?.on("keyup", (e: KeyboardEvent) => {
      if (this.actions) feedKeyboard(this.actions, e.code, false, this.kbBindings);
    });

    // Re-render terrain + crops khi farm version đổi (till/water/plant/harvest)
    // hoặc season đổi. Bug audit: trước đây chỉ render 1 lần từ zone.terrain →
    // till/water/crop mutate farmStore nhưng Phaser không hiện (mismatch với
    // legacy engine). Gộp 2 nguồn: farm version (terrain/crops mutate) + season.
    let lastVersion = useFarmStore.getState().version;
    let lastCropCount = Object.keys(useFarmStore.getState().crops).length;
    const rerender = (terrain: number[], season: typeof this.currentSeason) => {
      const curZone = useWorldStore.getState().zone;
      if (curZone !== "farm") {
        // W3P3: farm version bump (đặt/nhặt decor) trong nhà — vẫn refresh decor.
        if (curZone === "house") this.decorRenderer.render(this, "house");
        return;
      }
      const farm = useFarmStore.getState();
      this.renderTerrain(this.terrainTo2D(terrain, this.zoneCols, this.zoneRows), season);
      this.sceneryRenderer.render(this, "farm", season, {
        reducedMotion: this.reduceMotion,
        worldWidth: this.zoneCols * TILE_SIZE,
        worldHeight: this.zoneRows * TILE_SIZE,
        wellRepaired: useWorldStore.getState().wellRepaired,
      });
      this.decorRenderer.render(this, "farm");
      this.cropRenderer.render(this, farm.crops);
      // Bounded world feedback: crop count dropped => a harvest happened. Small shake,
      // reduced-motion aware. NEVER delays store/input (feedback-bundle tiers).
      if (!this.reduceMotion) {
        const cropCount = Object.keys(farm.crops).length;
        if (cropCount < lastCropCount) {
          const spec = applyReducedMotion(specForEvent("harvest"), this.reduceMotion);
          this.trauma = Math.min(1, this.trauma + spec.shake);
          // Sample noise once per event so the shake reads as one bounded oscillation,
          // not per-frame random jitter. Amplify to a perceptible px amplitude.
          this.shakeNoiseX = Math.random() * 2 - 1;
          this.shakeNoiseY = Math.random() * 2 - 1;
        }
        lastCropCount = cropCount;
      }
    };
    this.farmUnsub = useFarmStore.subscribe((f) => {
      if (this.dead || f.version === lastVersion) return;
      lastVersion = f.version;
      rerender(f.terrain, this.currentSeason);
    });
    this.seasonUnsub = useGameStore.subscribe((s) => {
      if (this.dead) return;
      const season = s.season as typeof this.currentSeason;
      if (season === this.currentSeason) return;
      this.currentSeason = season;
      const farm = useFarmStore.getState();
      lastVersion = farm.version;
      this.applySeasonChrome();
      rerender(farm.terrain, season);
    });
    let lastWorld = useWorldStore.getState().version;
    this.worldUnsub = useWorldStore.subscribe((w) => {
      if (this.dead || w.version === lastWorld) return;
      lastWorld = w.version;
      this.rebuildWorld(true);
    });

    // ADR-002: cleanup store subscriptions tại shutdown. W9P5 fix: destroy có
    // thể KHÔNG đi qua shutdown (React StrictMode double-mount race dưới tải
    // CPU) → đăng ký cả hai event; dead=true vô hiệu hoá mọi subscriber còn sót.
    const teardown = () => {
      this.dead = true;
      this.terrainLayer = undefined;
      this.player = undefined;
      this.playerAvatar?.destroy();
      this.playerAvatar = undefined;
      this.farmerSprite = undefined;
      this.footstepFx?.destroy();
      this.footstepFx = undefined;
      // W1P5 (review fix): dọn session câu + overlay — tránh FishingOverlay kẹt
      // "Câu ở ao..." với nút Thu cần không ai consume sau unmount.
      this.fishing = null;
      // W5: dọn quái/pickups deepforest.
      this.combat?.destroy();
      this.combat = undefined;
      this.fishingBobber?.destroy();
      this.fishingBobber = undefined;
      useFishingStore.getState().reset();
      this.nightOverlay = undefined; // scene-owned, auto-destroyed cùng shutdown
      this.terrainRenderer.destroy();
      this.cropRenderer.destroy();
      this.entityRenderer.destroy();
      this.sceneryRenderer.destroy();
      this.decorRenderer.destroy();
      // Ambient director (Task 12) — stop ambient loop khi rời scene; init() của
      // lần start sau sẽ tạo director mới.
      this.ambientDirector.destroy();
      this.seasonUnsub?.();
      this.seasonUnsub = undefined;
      this.farmUnsub?.();
      this.farmUnsub = undefined;
      this.worldUnsub?.();
      this.worldUnsub = undefined;
      // Window blur/visibility listeners — tránh stuck-key khi tab mất focus giữa phím hold.
      window.removeEventListener("blur", this.blurClear);
      document.removeEventListener("visibilitychange", this.visClear);
      window.removeEventListener("keydown", this.onWindowKey);
      window.removeEventListener("keyup", this.onWindowKey);
      // Unregister bridge callbacks — tránh callback cũ trỏ scene đã destroy
      // khi route away → back / locale switch (mobile D-pad kích hoạt scene chết).
      this.unregisterBridge?.();
      this.unregisterBridge = undefined;
    };
    this.events.on("shutdown", teardown);
    this.events.on("destroy", teardown);

    // Stuck-key guard: window mất focus (alt-tab, devtools, modal system) giữa lúc
    // hold phím → browser không fire keyup → state.pressed giữ action → player đi mãi.
    // Clear toàn bộ pressed + refcount khi blur/tab hidden.
    this.blurClear = () => this.clearKeyboardHeld();
    this.visClear = () => {
      if (document.visibilityState === "hidden") this.clearKeyboardHeld();
    };
    if (typeof window !== "undefined") {
      window.addEventListener("blur", this.blurClear);
      document.addEventListener("visibilitychange", this.visClear);
    }

    // E2E CDP eval hook (dev/test only — phase 9 canvas strategy).
    if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_E2E) {
      (window as unknown as { __game?: Phaser.Game }).__game = this.game;
    }

    // Audit #2: register bridge callbacks cho Phaser default path (save/load, mobile, fast-travel).
    // Legacy Canvas2D path (GameEngine.ts) registers riêng — không conflict (chỉ 1 path active).
    this.unregisterBridge = registerGameBridge({
      teleportToTile: (tx, ty) => {
        if (!this.player) return;
        this.player.x = tx * TILE_SIZE + TILE_SIZE / 2;
        this.player.y = ty * TILE_SIZE + TILE_SIZE / 2;
        this.playerAvatar?.setPosition(this.player.x, this.player.y).setDepth(this.player.y + 8);
        // Snap camera + clear lookahead. Lookahead là velocity-eased offset;
        // nếu giữ giá cũ, frame sau update() cộng lookahead cũ vào pos → camera
        // trượt về hướng player vừa ĐI trước khi teleport (drift uốn éo).
        this.snapCameraAfterMove();
      },
      getPlayerTile: () => {
        if (!this.player) return { x: 9, y: 22 };
        return {
          x: Math.floor(this.player.x / TILE_SIZE),
          y: Math.floor(this.player.y / TILE_SIZE),
        };
      },
      focusCameraOnTile: (tx, ty) => {
        this.cam.x = tx * TILE_SIZE + TILE_SIZE / 2;
        this.cam.y = ty * TILE_SIZE + TILE_SIZE / 2;
      },
      // Mobile D-pad: touch key → action-map feed (giống keyboard).
      setVirtualKey: (key, down) => {
        if (!this.actions) return;
        const code = key.length === 1 ? `Key${key.toUpperCase()}` : key;
        feedKeyboard(this.actions, code, down, this.kbBindings);
      },
      triggerInteract: () => {
        this.doInteract();
      },
      getFacing: () => this.facing,
      // W5: combat hooks cho bridge (e2e snapshot + spawn thử nghiệm).
      getCombatSnapshot: () => this.combat?.snapshot() ?? null,
      spawnEnemy: (defId, tx, ty) => this.combat?.spawnAt(defId, tx, ty) ?? false,
    });
  }

  /** Execute the shared interact logic on the player's facing tile. */
  private doInteract(): void {
    // W3P5-fix: decor mode sở hữu toàn bộ input phím — Interact (Space/E/mobile)
    // KHÔNG được rò xuống thế giới (thu hoạch/ăn/warp sau lưng khi đang đặt decor).
    if (useDecorModeStore.getState().active) return;
    if (this.interactCooldown > 0) return;
    this.interactCooldown = 180;
    if (!this.player) return;
    // W6P3: cầm tool/rod bấm Space khi đang cưỡi → xuống ngựa rồi flow chạy tiếp
    // (đơn giản hơn chặn — plan). Fishing tap không đụng (chưa mounted khi câu).
    const px = Math.floor(this.player.x / TILE_SIZE);
    const py = Math.floor(this.player.y / TILE_SIZE);
    // W1P4: session câu đang chạy → interact là TAP (cắn/reel), không phải interact thường.
    if (this.fishing) {
      this.fishing = nextFishing(this.fishing, { type: "tap", now: performance.now() }, fishingRng);
      this.syncFishingPhaseFx();
      return;
    }
    // W1P5: cầm cá bột đứng gần AO (pond) → thả vào ao nuôi.
    const selSlot0 = useInventoryStore.getState().getSelectedSlot();
    if (selSlot0 && isFryItemId(selSlot0.itemId)) {
      if (this.nearWaterType(px, py) === "pond") {
        gameActions.releaseFry(selSlot0.itemId);
      } else {
        useUiStore.getState().notify("Đứng cạnh ao farm để thả cá bột", "warn");
      }
      return;
    }
    // W1P5 (review fix): thu ao CHỈ khi FACING ô nước pond + không cầm watering
    // can (can = refill) — trước đây quét bán kính 2 mọi hướng che mất
    // refill/forage quanh ao khi có cá chín.
    const facingT = this.getFacingTile(px, py);
    const layout0 = getZone(useWorldStore.getState().zone);
    const facingWater =
      facingT.x >= 0 && facingT.y >= 0 && facingT.x < layout0.cols && facingT.y < layout0.rows
        ? layout0.terrain[facingT.y * layout0.cols + facingT.x]
        : T.WATER + 999;
    if (
      selSlot0 &&
      getItem(selSlot0.itemId)?.toolKind !== "rod" &&
      getItem(selSlot0.itemId)?.toolKind !== "water" &&
      !isFryItemId(selSlot0.itemId) &&
      facingWater === T.WATER &&
      waterTypeAt(layout0.id, facingT.x, facingT.y) === "pond" &&
      useFarmStore.getState().pondFish.some(
        (p) => p.daysGrown >= fryGrowDays(`fry_${p.fishId}`),
      )
    ) {
      gameActions.harvestPond();
      return;
    }
    // W6P4: đứng kề chuồng ngựa bấm Space → chưa có mount: mở shop; có: lên/xuống.
    if (
      facingT.x >= FARM_STABLE.tx && facingT.x < FARM_STABLE.tx + FARM_STABLE.cols &&
      facingT.y >= FARM_STABLE.ty && facingT.y < FARM_STABLE.ty + FARM_STABLE.rows
    ) {
      if (useMountStore.getState().owned.length === 0) {
        useUiStore.getState().notify("Chưa có thú cưỡi — mở cửa hàng", "info");
        useUiStore.getState().setShowShop(true);
      } else {
        this.toggleMount();
      }
      return;
    }
    // W1P4: cầm cần câu → thử bắt đầu session (pre-check V4 trong fishing-session).
    const selSlot = selSlot0;
    if (useMountStore.getState().mounted) this.autoDismount("dùng đồ");
    if (selSlot && getItem(selSlot.itemId)?.toolKind === "rod") {
      this.tryStartFishingAt(px, py);
      return;
    }
    // W5P3: cầm kiếm → vung (chỉ deepforest — zone khác kiếm vô dụng, không ăn
    // energy oan). Hit tính NGAY lúc văng (không frame-perfect — cozy).
    if (selSlot && getItem(selSlot.itemId)?.toolKind === "sword") {
      if (useWorldStore.getState().zone !== "deepforest") {
        useUiStore.getState().notify("Kiếm chỉ dùng ở rừng sâu", "info");
        return;
      }
      const toolDef = getItem(selSlot.itemId)!;
      if (!useGameStore.getState().spendEnergy(toolDef.toolEnergy ?? 1)) {
        useUiStore.getState().notify("Hết năng lượng", "warn");
        return;
      }
      this.playSwordSwing();
      const r = this.combat?.swing() ?? { hits: 0, kills: 0 };
      if (r.hits === 0) useUiStore.getState().notify("Vung hụt…", "info");
      return;
    }
    const facingTile = { ...this.getFacingTile(px, py) };
    // Shared interact logic (same behavior as the Canvas2D engine).
    const outcome = tryInteract({
      facingTile,
      playerTile: { x: px, y: py },
      // NPC entities (home pos) — nhưng FILTER trong radius 1 tile giống GameEngine
      // (420): tryInteract không tự filter, chọn NPC gần nhất bất kể khoảng cách →
      // không filter → interact mở dialogue NPC cách xa cả map (bug khi thêm NPC).
      npcs: this.npcs.filter(
        (n) => Math.abs(n.tx - px) <= 1 && Math.abs(n.ty - py) <= 1,
      ),
      flash: () => undefined,
    });
    // Tool anim play-once (hoe/water/axe/pickaxe) + brief action lock.
    if (outcome && outcome.kind in TOOL_ANIM_FOR_KIND) {
      this.playToolAnim(outcome.kind as keyof typeof TOOL_ANIM_FOR_KIND);
    }
  }

  /** Draw the controllable farmer once; the simulation body above supplies x/y. */
  private createPlayerAvatar(x: number, y: number): Phaser.GameObjects.Container {
    const avatar = this.add.container(x, y);
    if (textureHas(this, "char.alex.idle") && typeof this.add.sprite === "function") {
      this.ensureFarmerFrames();
      const spr = this.add.sprite(0, 10, "char.alex.idle", "idle-d-0");
      spr.setOrigin(0.5, 1);
      spr.setScale(SCALE);
      avatar.add(spr);
      this.farmerSprite = spr;
      this.footstepFx = createFootstepFx(this, avatar, {
        reducedMotion: this.reduceMotion,
        onStep: () => playSfx("step"),
      });
      this.playLocomotionAnim();
    } else {
      const sprite = this.add.graphics();
      sprite.fillStyle(0x342821, 0.25).fillEllipse(-13, 14, 26, 6);
      sprite.fillStyle(0x362920).fillRect(-8, 6, 5, 8).fillRect(3, 6, 5, 8);
      sprite.fillStyle(0x3f6f91).fillRect(-9, -5, 18, 13);
      sprite.fillStyle(0xe3b88f).fillRect(-6, -16, 12, 11);
      sprite.fillStyle(0xe3ae4d).fillRect(-7, -26, 14, 6);
      avatar.add(sprite);
    }
    avatar.setDepth(y + 8);
    return avatar;
  }

  private ensureFarmerFrames(): void {
    const rows = ["d", "u", "a"] as const;
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < FARMER_SHEET_FRAMES.idle; col++) {
        ensureFrame(this, "char.alex.idle", `idle-${rows[row]}-${col}`, col * 32, row * 32, 32, 32);
      }
    }
    if (textureHas(this, "char.alex.walk")) {
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < FARMER_SHEET_FRAMES.walk; col++) {
          ensureFrame(this, "char.alex.walk", `walk-${rows[row]}-${col}`, col * 32, row * 32, 32, 32);
        }
      }
    }
    if (textureHas(this, "char.alex.run")) {
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < FARMER_SHEET_FRAMES.run; col++) {
          ensureFrame(this, "char.alex.run", `run-${rows[row]}-${col}`, col * 32, row * 32, 32, 32);
        }
      }
      for (const dir of rows) {
        if (!this.anims.exists("farmer-run-" + dir)) {
          this.anims.create({
            key: `farmer-run-${dir}`,
            frames: Array.from({ length: FARMER_SHEET_FRAMES.run }, (_, i) => ({ key: "char.alex.run", frame: `run-${dir}-${i}` })),
            frameRate: 12,
            repeat: -1,
          });
        }
      }
    }
    for (const dir of rows) {
      if (!this.anims.exists(`farmer-idle-${dir}`)) {
        this.anims.create({
          key: `farmer-idle-${dir}`,
          frames: Array.from({ length: FARMER_SHEET_FRAMES.idle }, (_, i) => ({ key: "char.alex.idle", frame: `idle-${dir}-${i}` })),
          frameRate: 5,
          repeat: -1,
        });
      }
      if (textureHas(this, "char.alex.walk") && !this.anims.exists(`farmer-walk-${dir}`)) {
        this.anims.create({
          key: `farmer-walk-${dir}`,
          frames: Array.from({ length: FARMER_SHEET_FRAMES.walk }, (_, i) => ({ key: "char.alex.walk", frame: `walk-${dir}-${i}` })),
          frameRate: 8,
          repeat: -1,
        });
      }
    }
    // Tool sheets (pack Alex) — slice generic theo frame count mỗi tool.
    for (const [tool, sheetKey] of Object.entries(TOOL_SHEET_KEY) as [keyof typeof TOOL_SHEET_KEY, string][]) {
      if (!textureHas(this, sheetKey)) continue;
      const frames = TOOL_SHEET_FRAMES[tool as keyof typeof TOOL_SHEET_FRAMES];
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < frames; col++) {
          ensureFrame(this, sheetKey, `tool-${tool}-${rows[row]}-${col}`, col * 32, row * 32, 32, 32);
        }
      }
      for (const dir of rows) {
        const key = `farmer-tool-${tool}-${dir}`;
        if (!this.anims.exists(key)) {
          this.anims.create({
            key,
            frames: Array.from({ length: frames }, (_, i) => ({ key: sheetKey, frame: `tool-${tool}-${dir}-${i}` })),
            frameRate: 12,
            repeat: 0, // play-once
          });
        }
      }
    }
  }

  // ── W6 P3: mount render — sheet riêng 32×frameH, anim walk(run chậm)/run/idle ──

  /** Slice mount run-sheet (frame cao riêng theo def) + anims 4 hướng × 3 loại. */
  private ensureMountFrames(): void {
    for (const def of MOUNTS) {
      if (!textureHas(this, def.sheets.run)) continue;
      const rows = ["d", "u", "a"] as const;
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < def.framesPerDir; col++) {
          ensureFrame(this, def.sheets.run, `m${rows[row]}-${col}`, col * 32, row * def.frameH, 32, def.frameH);
        }
      }
      for (const dir of rows) {
        // walk = run sheet chạy chậm (pack không có walk riêng — note plan P1).
        // idle = frame 0 đứng hình theo hướng.
        for (const [kind, rate] of [["walk", 8], ["run", 12]] as const) {
          const key = `mount-${def.id}-${kind}-${dir}`;
          if (!this.anims.exists(key)) {
            this.anims.create({
              key,
              frames: Array.from({ length: def.framesPerDir }, (_, i) => ({ key: def.sheets.run, frame: `m${dir}-${i}` })),
              frameRate: rate,
              repeat: -1,
            });
          }
        }
        const idleKey = `mount-${def.id}-idle-${dir}`;
        if (!this.anims.exists(idleKey)) {
          this.anims.create({
            key: idleKey,
            frames: [{ key: def.sheets.run, frame: `m${dir}-0` }],
            frameRate: 1,
            repeat: -1,
          });
        }
      }
    }
  }

  /** Đổi texture farmer ↔ mount rider (origin 0.5,1 giữ — chân ngựa chạm tile). */
  private syncMountTexture(): void {
    const spr = this.farmerSprite;
    if (!spr) return;
    const m = useMountStore.getState();
    const want = m.mounted && m.active ? m.active : null;
    if (want === this.mountVisual) return;
    if (want) {
      const def = mountById(want);
      if (def && textureHas(this, def.sheets.run)) {
        this.ensureMountFrames();
        const dir = this.loco.facing === "up" ? "u" : this.loco.facing === "down" ? "d" : "a";
        spr.setTexture(def.sheets.run, `m${dir}-0`);
        this.mountVisual = want;
      }
    } else {
      spr.setTexture("char.alex.idle", "idle-d-0");
      this.mountVisual = null;
    }
  }

  /** W6P3: M toggle — gate canMount (level/zone/tool/fishing), notify rõ lý do. */
  private toggleMount(): void {
    if (isGameplayBlocked()) return;
    const m = useMountStore.getState();
    const sel = useInventoryStore.getState().getSelectedSlot();
    const toolKind = sel ? getItem(sel.itemId)?.toolKind : undefined;
    const check = m.toggle({
      level: useProgressionStore.getState().level,
      zone: useWorldStore.getState().zone,
      holdingTool: !!toolKind,
      fishing: this.fishing !== null,
    });
    if (!check.ok) {
      const msg: Record<string, string> = {
        unknown: "Chưa chọn thú cưỡi",
        level: "Chưa đủ cấp",
        zone: "Không cưỡi được trong nhà",
        tool: "Đang cầm đồ dùng — chọn lại tay không",
        fishing: "Đang câu cá",
      };
      useUiStore.getState().notify(msg[check.reason ?? "unknown"] ?? "Không cưỡi được", "warn");
      return;
    }
    this.syncMountTexture();
    this.playLocomotionAnim();
    if (useMountStore.getState().mounted) {
      const def = mountById(useMountStore.getState().active ?? "");
      useUiStore.getState().notify(`${def?.icon ?? ""} Lên ${def?.name ?? ""}!`, "success");
    }
  }

  /** W6P3: xuống ngựa tự động (vào house / dùng tool / câu cá) — gọi rồi chạy tiếp flow. */
  private autoDismount(reason: string): void {
    const m = useMountStore.getState();
    if (!m.mounted) return;
    m.dismount();
    this.syncMountTexture();
    this.playLocomotionAnim();
    useUiStore.getState().notify(`Xuống ngựa (${reason})`, "info");
  }

  /** Chơi tool anim play-once theo action kind; khoá di chuyển ngắn. */
  private playToolAnim(kind: keyof typeof TOOL_ANIM_FOR_KIND): void {
    const spr = this.farmerSprite;
    const tool = TOOL_ANIM_FOR_KIND[kind];
    if (!spr || !tool || !this.anims) return;
    const dir = this.facing === "up" ? "u" : this.facing === "down" ? "d" : "a";
    const key = `farmer-tool-${tool}-${dir}`;
    spr.setFlipX(this.facing === "left");
    if (this.anims.exists(key)) {
      spr.play(key, true);
      // Lock = đúng thời lượng anim (frames / 12fps) để play-once chạy trọn vẹn —
      // lock cố định 420ms cắt ngang watering (8 frame = 667ms) ~250ms sớm.
      this.actionLockMs = Math.ceil((TOOL_SHEET_FRAMES[tool] / 12) * 1000);
    }
  }

  /** W5P3: vung kiếm — anim play-once sheet Sword (10f/12fps ≈ 833ms lock). */
  private playSwordSwing(): void {
    const spr = this.farmerSprite;
    if (!spr || !this.anims) return;
    const dir = this.facing === "up" ? "u" : this.facing === "down" ? "d" : "a";
    const key = `farmer-tool-sword-${dir}`;
    spr.setFlipX(this.facing === "left");
    if (this.anims.exists(key)) {
      spr.play(key, true);
      this.actionLockMs = Math.ceil((TOOL_SHEET_FRAMES.sword / 12) * 1000);
    } else {
      this.actionLockMs = 500; // sheet thiếu — lock ngắn fallback
    }
  }

  private playLocomotionAnim(): void {
    const spr = this.farmerSprite;
    if (!spr || !this.anims) return;
    const dir = this.loco.facing === "up" ? "u" : this.loco.facing === "down" ? "d" : "a";
    spr.setFlipX(this.loco.facing === "left");
    const m = useMountStore.getState();
    if (m.mounted && m.active) {
      this.syncMountTexture();
      const key = `mount-${m.active}-${this.loco.anim}-${dir}`;
      if (spr.anims?.currentAnim?.key !== key && this.anims.exists(key)) spr.play(key, true);
      return;
    }
    const key = farmerAnimKey(this.loco.anim, this.loco.facing);
    if (spr.anims?.currentAnim?.key !== key && this.anims.exists(key)) spr.play(key, true);
  }

  // ── Wave 1 P4: câu cá (session authority nằm ở scene, pure logic ở lib/fishing) ──

  /** Vùng nước gần nhất trong bán kính câu (W1P5 branch fry/thu ao dùng). */
  private nearWaterType(px: number, py: number): string | null {
    const layout = getZone(useWorldStore.getState().zone);
    const tile = nearestWaterTile({
      zone: layout.id,
      x: px,
      y: py,
      terrainAt: (x, y) =>
        x >= 0 && y >= 0 && x < layout.cols && y < layout.rows
          ? layout.terrain[y * layout.cols + x]
          : T.WATER + 999,
    });
    if (!tile) return null;
    return waterTypeAt(layout.id, tile.x, tile.y);
  }

  /** Thử bắt đầu câu tại vị trí player — pre-check V4 (kho đầy chặn từ đầu). */
  private tryStartFishingAt(px: number, py: number): void {
    const layout = getZone(useWorldStore.getState().zone);
    const game = useGameStore.getState();
    const farm = useFarmStore.getState();
    const inv = useInventoryStore.getState();
    const level = useProgressionStore.getState().level;
    const r = tryStartFishing({
      zone: layout.id,
      x: px,
      y: py,
      terrainAt: (x, y) =>
        x >= 0 && y >= 0 && x < layout.cols && y < layout.rows
          ? layout.terrain[y * layout.cols + x]
          : T.WATER + 999, // ngoài map ≠ nước
      energy: game.energy,
      siloFull: siloUsed(farm.silo) >= siloCapacity(level),
      bagFull: !inv.slots.some((s) => !s),
      modalOpen: isGameplayBlocked(),
    });
    const ui = useUiStore.getState();
    if (!r.ok) {
      if (r.reason === "no-water") ui.notify("Đứng gần bờ nước để câu cá", "warn");
      else if (r.reason === "energy") ui.notify("Hết năng lượng — cần nghỉ ngơi", "warn");
      else if (r.reason === "full") ui.notify("Kho và túi đều đầy — bán bớt đã", "warn");
      playSfx("error");
      return;
    }
    const rodEnergy = getItem("fishing_rod")?.toolEnergy ?? 2;
    if (!game.spendEnergy(rodEnergy)) return;
    game.recordToolUse();
    setFishingWaterLabel(r.waterType);
    this.fishing = nextFishing(
      idleSession(),
      { type: "cast", now: performance.now(), zone: r.waterType, level },
      fishingRng,
    );
    // Bobber trên ô nước gần nhất (scene-guard: nearestWaterTile luôn tìm được
    // vì tryStartFishing vừa ok — fallback không đặt bobber nếu race).
    const tile = nearestWaterTile({
      zone: layout.id,
      x: px,
      y: py,
      terrainAt: (x, y) => layout.terrain[y * layout.cols + x],
    });
    if (tile) {
      this.fishingBobber = this.add
        .ellipse(tile.x * TILE_SIZE + TILE_SIZE / 2, tile.y * TILE_SIZE + TILE_SIZE / 2, 12, 7, 0xe3452f)
        .setDepth(tile.y * TILE_SIZE + 4);
    }
    playSfx("cast");
    this.playFishingAnim("cast");
    useFishingStore.getState().setFromSession(this.fishing);
  }

  /** Tick session mỗi frame — gọi từ update() khi đang câu. */
  /** W3P4: vẽ con trỏ decor (rect xanh/đỏ theo hợp lệ) + preview sprite mờ. */
  private updateDecorCursor(): void {
    const d = useDecorModeStore.getState();
    if (!d.active) {
      this.decorCursorGfx?.destroy();
      this.decorCursorGfx = undefined;
      this.decorPreviewImg?.destroy();
      this.decorPreviewImg = undefined;
      return;
    }
    const def = d.defId ? decorById(d.defId) : null;
    const fp = def
      ? footprintOf(def, d.rot)
      : { w: 1, h: 1 };
    const valid = def ? canPlaceAtCursor() : !!d.uid;
    if (!this.decorCursorGfx) {
      this.decorCursorGfx = this.add.graphics().setDepth(1_000_000);
    }
    const g = this.decorCursorGfx;
    g.clear();
    g.lineStyle(3, valid ? 0x4ade80 : 0xef4444, 0.9);
    g.strokeRect(
      d.cursorTx * TILE_SIZE,
      d.cursorTy * TILE_SIZE,
      fp.w * TILE_SIZE,
      fp.h * TILE_SIZE,
    );
    g.fillStyle(valid ? 0x4ade80 : 0xef4444, 0.15);
    g.fillRect(
      d.cursorTx * TILE_SIZE,
      d.cursorTy * TILE_SIZE,
      fp.w * TILE_SIZE,
      fp.h * TILE_SIZE,
    );
    // Preview sprite mờ theo item đang cầm (đổi texture khi đổi def/rot).
    if (def) {
      if (!this.decorPreviewImg) {
        this.decorPreviewImg = this.add
          .image(0, 0, "__DEFAULT")
          .setOrigin(0.5, 1)
          .setDepth(999_999)
          .setAlpha(0.75);
      }
      const img = this.decorPreviewImg;
      const frameName = `decor-preview-${def.id}`;
      if (ensureFrame(this, def.manifestKey, frameName, def.frame.x, def.frame.y, def.frame.w, def.frame.h)) {
        if (img.texture.key !== def.manifestKey || img.frame.name !== frameName) {
          img.setTexture(def.manifestKey, frameName);
        }
        img.setScale(SCALE);
        img.setAngle(d.rot);
        img.setFlipX(d.flip);
        img.setPosition(
          (d.cursorTx + fp.w / 2) * TILE_SIZE,
          (d.cursorTy + fp.h) * TILE_SIZE,
        );
        img.setTint(valid ? 0xffffff : 0xff8888);
        img.setVisible(true);
      } else {
        img.setVisible(false);
      }
    } else if (this.decorPreviewImg) {
      this.decorPreviewImg.setVisible(false);
    }
    // Camera bám con trỏ để đặt xa vẫn thấy.
    this.cameras.main.centerOn(
      (d.cursorTx + fp.w / 2) * TILE_SIZE,
      (d.cursorTy + fp.h / 2) * TILE_SIZE,
    );
  }

  private updateFishing(clampedMs: number, dt: number): void {
    const f = this.fishing;
    if (!f) return;
    const ui = useFishingStore.getState();
    if (ui.cancelRequested) {
      ui.reset();
      this.endFishing();
      useUiStore.getState().notify("Đã thu cần câu", "info");
      return;
    }
    const prev = f.phase;
    this.fishing = nextFishing(f, { type: "tick", now: performance.now(), dt, holding: ui.holding }, fishingRng);
    if (this.fishing.phase !== prev) this.syncFishingPhaseFx();
    // Reel snapshot → overlay (throttle 100ms, phase-change đẩy ngay ở trên).
    this.fishingUiThrottle -= clampedMs;
    // Guard: tick vừa rồi có thể đã kết thúc session (endFishing set null) —
    // đọc .phase sau đó = TypeError 1 frame (bắt gặp khi chụp screenshot W1P6).
    if (this.fishing && this.fishing.phase === "reel" && this.fishingUiThrottle <= 0) {
      useFishingStore.getState().setFromSession(this.fishing);
      this.fishingUiThrottle = 100;
    }
  }

  /** FX theo phase mới (sfx + anim + kết thúc session). */
  private syncFishingPhaseFx(): void {
    const f = this.fishing;
    if (!f) return;
    switch (f.phase) {
      case "wait":
        this.playFishingAnim("wait");
        break;
      case "bite":
        playSfx("bite");
        this.playFishingAnim("bite");
        this.fishingBobber?.setFillStyle(0xffffff);
        break;
      case "reel":
        playSfx("reel");
        this.playFishingAnim("reel");
        break;
      case "caught":
        // SFX fishcatch phát trong gameActions.catchFish (review fix — tránh double chime)
        this.playFishingAnim("catch");
        if (f.fishId) gameActions.catchFish(f.fishId);
        this.endFishing();
        break;
      case "escaped":
        useUiStore.getState().notify("Cá tuột mất rồi!", "warn");
        this.endFishing();
        break;
      default:
        break;
    }
    useFishingStore.getState().setFromSession(f);
  }

  /** Dọn session + bobber; giữ catch-anim hiện thêm 650ms qua actionLock. */
  private endFishing(): void {
    this.fishingBobber?.destroy();
    this.fishingBobber = undefined;
    this.fishing = null;
    this.actionLockMs = 650;
    this.time?.delayedCall?.(650, () => {
      // Guard: nếu player đã cast session mới trong 650ms thì không reset overlay (review fix)
      if (!this.fishing) useFishingStore.getState().reset();
    });
  }

  /** Chơi anim sheet fishing theo stage + facing (d/u/s — s = hàng 3 side-wide). */
  private playFishingAnim(stage: FishingStage): void {
    const spr = this.farmerSprite;
    if (!spr || !this.anims) return;
    this.ensureFishingFrames();
    const row = this.facing === "up" ? "u" : this.facing === "down" ? "d" : "s";
    const key = `farmer-fish-${stage}-${row}`;
    spr.setFlipX(this.facing === "left");
    if (this.anims.exists(key)) spr.play(key, true);
  }

  /** Slice frames 64×48 (hàng d=0, u=1, s=3) + tạo anims cho 5 stage. */
  private ensureFishingFrames(): void {
    const rows: Array<{ letter: "d" | "u" | "s"; index: number }> = [
      { letter: "d", index: 0 },
      { letter: "u", index: 1 },
      { letter: "s", index: 3 },
    ];
    for (const [stage, cfg] of Object.entries(FISHING_SHEETS) as [FishingStage, (typeof FISHING_SHEETS)[FishingStage]][]) {
      if (!textureHas(this, cfg.key)) continue;
      for (const { letter, index } of rows) {
        for (let col = 0; col < cfg.cols; col++) {
          ensureFrame(this, cfg.key, `fish-${stage}-${letter}-${col}`, col * 64, index * 48, 64, 48);
        }
        const key = `farmer-fish-${stage}-${letter}`;
        if (!this.anims.exists(key)) {
          this.anims.create({
            key,
            frames: Array.from({ length: cfg.cols }, (_, i) => ({ key: cfg.key, frame: `fish-${stage}-${letter}-${i}` })),
            frameRate: cfg.fps,
            repeat: -1,
          });
        }
      }
    }
  }

  /**
   * Render terrain — chung cho create() + rerender (till/water/season).
   * Bug audit: rerender trước đây gọi terrainRenderer.render() mà không check
   * return; render() luôn destroy() trước → nếu sheet thiếu (boot race) trả
   * false → toàn bộ tile biến mất, KHÔNG fallback rects. Ngược lại nếu create()
   * fallback rects mà rerender thành công → rects + sprites overlap (2 lớp).
   * renderTerrain() giữ 1 trong 2 path active: texture path khi có sheet,
   * fallback rects khi chưa (cả 2 đều destroy cái trước).
   */
  private renderTerrain(terrain: number[][], season: typeof this.currentSeason): void {
    const rendered = this.terrainRenderer.render(
      this,
      terrain,
      season,
      useWorldStore.getState().zone,
    );
    if (rendered) {
      // Texture path active — destroy fallback rects (nếu đang có từ create()).
      if (this.terrainLayer) {
        for (const row of this.terrainLayer) for (const r of row) r.destroy();
        this.terrainLayer = undefined;
      }
    } else {
      // Sheets thiếu — fallback rects. destroy trước (idempotent) tránh overlap
      // khi render() lần đầu thành công ở create() nhưng season swap thiếu sheet.
      this.drawTerrain(terrain);
    }
  }

  private rebuildWorld(teleport: boolean): void {
    const world = useWorldStore.getState();
    const layout = getZone(world.zone);
    this.zoneCols = layout.cols;
    this.zoneRows = layout.rows;
    const terrain =
      world.zone === "farm"
        ? useFarmStore.getState().terrain
        : layout.terrain;
    this.renderTerrain(this.terrainTo2D(terrain, layout.cols, layout.rows), this.currentSeason);
    // W8: ngày lễ (13/24) → làng trang trí balloons + carts (§2 festival).
    const gs = useGameStore.getState();
    enableVillageFestival(world.zone === "village" && isFestivalDay(gs.season, gs.day) !== null);
    this.sceneryRenderer.render(this, world.zone, this.currentSeason, {
      reducedMotion: this.reduceMotion,
      worldWidth: this.zoneCols * TILE_SIZE,
      worldHeight: this.zoneRows * TILE_SIZE,
      wellRepaired: world.wellRepaired,
    });
    // W3P3: decor đã đặt (zone hiện tại — farm hoặc house).
    this.decorRenderer.render(this, world.zone);
    this.applySeasonChrome();
    this.cropRenderer.render(
      this,
      world.zone === "farm" ? useFarmStore.getState().crops : {},
    );
    const npcs = layout.npcs.filter((n) => {
      if (n.id === "elyria" && !world.wellRepaired) return false;
      return true;
    });
    this.npcs = npcs.map((n) => ({ id: n.id, tx: n.x, ty: n.y }));
    this.entityRenderer.render(
      this,
      npcs.map((n) => {
        const def = NPCS[n.id];
        return {
          id: n.id,
          tx: n.x,
          ty: n.y,
          color: def?.color ?? "#7a5230",
          glyph: def?.name ?? n.id,
        };
      }),
    );
    this.cameras.main.setBounds(0, 0, layout.cols * TILE_SIZE, layout.rows * TILE_SIZE);
    // W5: quái + pickups theo zone (deepforest spawn; zone khác dọn — cozy §4).
    if (!this.combat) {
      this.combat = new CombatController(this, {
        solidAtPx: (x, y) => {
          const tx = Math.floor(x / TILE_SIZE);
          const ty = Math.floor(y / TILE_SIZE);
          return useWorldStore.getState().isSolid(tx, ty);
        },
        getPlayer: () => (this.player ? { x: this.player.x, y: this.player.y } : null),
        getFacing: () => this.facing,
        onKillXp: (amount) => {
          const g = useGameStore.getState();
          useProgressionStore
            .getState()
            .addXp(Math.round(amount * xpMultiplier(g.buffs, g.day, g.timeMinutes)));
        },
        onFaint: () => this.faintFromCombat(),
      });
    }
    this.combat.syncZone(world.zone);
    // W6P3: warp vào nhà → xuống ngựa tự động (house cấm mount).
    if (world.zone === "house" && useMountStore.getState().mounted) {
      this.autoDismount("vào nhà");
    }
    if (teleport) this.applyPendingSpawn();
    this.warpCooldown = 450;
  }

  /** W5P4: ngất ở rừng sâu — về nhà + phạt nhẹ (cozy-death, pure logic ở lib). */
  private faintFromCombat(): void {
    const game = useGameStore.getState();
    const p = faintPenalty(game.gold, game.maxEnergy);
    game.addGold(-p.goldLoss);
    useUiStore.getState().notify(`Bạn ngất ở rừng sâu… −${p.goldLoss}g`, "error");
    useWorldStore.getState().enterZone("farm", COZY_DEATH.respawnTile);
    useGameStore.getState().setEnergy(p.respawnEnergy);
  }

  private applySeasonChrome(): void {
    const hex = SEASON_THEME[this.currentSeason].ground.replace("#", "");
    this.cameras.main.setBackgroundColor(parseInt(hex, 16));
  }

  private applyPendingSpawn(): void {
    const world = useWorldStore.getState();
    const spawn = world.pendingSpawn ?? getZone(world.zone).spawn;
    if (!this.player) return;
    this.player.x = spawn.x * TILE_SIZE + TILE_SIZE / 2;
    this.player.y = spawn.y * TILE_SIZE + TILE_SIZE / 2;
    this.playerAvatar?.setPosition(this.player.x, this.player.y).setDepth(this.player.y + 8);
    this.snapCameraAfterMove();
  }

  /** Convert 1D terrain → number[][] rows for the renderer. */
  private terrainTo2D(terrain: number[], cols: number, rows: number): number[][] {
    const out: number[][] = [];
    for (let r = 0; r < rows; r++) {
      const start = r * cols;
      const row: number[] = [];
      for (let c = 0; c < cols; c++) {
        const tile = terrain[start + c];
        row.push(typeof tile === "number" && Number.isFinite(tile) ? tile : T.GRASS);
      }
      out.push(row);
    }
    return out;
  }

  /** Tile the player is facing (facing-adjusted). */
  private getFacingTile(px: number, py: number): { x: number; y: number } {
    let fx = px;
    let fy = py;
    if (this.facing === "up") fy = py - 1;
    else if (this.facing === "down") fy = py + 1;
    else if (this.facing === "left") fx = px - 1;
    else if (this.facing === "right") fx = px + 1;
    return { x: fx, y: fy };
  }

  private drawTerrain(terrain: number[][]): void {
    // Destroy rects cũ (idempotent) — fallback→fallback season swap không overlap.
    if (this.terrainLayer) {
      for (const row of this.terrainLayer) for (const r of row) r.destroy();
    }
    this.terrainLayer = [];
    for (let r = 0; r < terrain.length; r++) {
      const row: Phaser.GameObjects.Rectangle[] = [];
      for (let c = 0; c < terrain[r].length; c++) {
        const color = TILE_COLOR[terrain[r][c]] ?? 0x6fb84a;
        // ponytail: phase 3 thay bằng Tilemap + sprite; rects = placeholder.
        const rect = this.add.rectangle(
          c * TILE_SIZE + TILE_SIZE / 2,
          r * TILE_SIZE + TILE_SIZE / 2,
          TILE_SIZE,
          TILE_SIZE,
          color,
        );
        row.push(rect);
      }
      this.terrainLayer.push(row);
    }
  }

  update(_time: number, deltaMs: number): void {
    if (!this.player || !this.actions) return;
    // Clamp delta — tab hidden lâu (browser pause RAF) → Phaser gửi delta lớn
    // (vài phút) → tick() advance timeMinutes += delta/700 → time-skip nửa ngày.
    // GameEngine.ts:237 đã clamp Math.min(50, …); FarmScene trước đây KHÔNG.
    const clampedMs = Math.min(50, deltaMs);
    // Ambient track theo zone + giờ (Task 12). Đặt TRƯỚC overlay/raid gate:
    // ambient (giống music) vẫn chạy khi modal mở — clock bị gate đóng băng nên
    // track hiếm khi đổi trong lúc overlay, nhưng fast-travel đổi zone cần
    // switch ngay. Gọi mỗi frame an toàn — early-return khi track không đổi.
    this.ambientDirector.update(
      useWorldStore.getState().zone,
      useGameStore.getState().timeMinutes,
    );
    // Overlay/raid gate (ADR-015): khi overlay mở (shop/dialogue/gift/start/panel)
    // HOẶC raid full-screen KHÔNG cho di chuyển/interact/tick xuyên qua. Raid phase
    // trước đây không được gate → WASD di chuyển player ẩn sau raid backdrop +
    // in-game clock advance trong lúc raid. Dùng shared gate (ui-gate).
    if (isGameplayBlocked()) {
      endFrame(this.actions);
      return;
    }
    // W5: quái deepforest tick (di chuyển/chase/chạm player + nhặt pickup).
    this.combat?.update(performance.now(), clampedMs);
    // Knockback từ combat: impulse px → px/s (×8: v₀≈√(2·braking·tile)≈390 với
    // braking 1600 px/s² và knockbackPx ~48 — văng đúng ~1 tile rồi phanh).
    const kb = this.combat?.lastKnockback;
    if (kb && this.combat) {
      this.combat.lastKnockback = null;
      this.pvx += kb.x * 8;
      this.pvy += kb.y * 8;
    }
    // Time progression — same as GameEngine: advance in-game clock, then consume
    // needsSleep → endDay (2am collapse) so the Phaser default path can progress
    // past Day 1. Without this the simulation stays frozen at 6:00 forever.
    const g = useGameStore.getState();
    if (!g.paused) g.tick(clampedMs);
    if (g.needsSleep) {
      // Critical fix (audit): trước đây clear needsSleep SYNC trước khi endDay
      // (dynamic import) resolve → race: modal mở giữa check và import → endDay
      // bail (guard modal trong actions.ts) nhưng needsSleep đã clear → không
      // retry → clock freeze 2AM vĩnh viễn (soft-lock). Static import gameActions
      // (không cycle — actions không import scenes) cho phép endDay sync ngay
      // trong frame này; modal mở giữa gated-check và endDay sync không xảy ra
      // (single-threaded, không await). Pattern khớp GameEngine gated condition.
      useUiStore.getState().notify("Bạn kiệt sức ngã gục! Tự động đi ngủ...", "warn");
      gameActions.endDay(true);
      useGameStore.getState().clearNeedsSleep();
    }
    // Overlay ngày/đêm theo clock (đọc SAU tick/endDay để khớp timeMinutes mới
    // nhất — endDay reset về sáng). Ambient chậm, không phải motion → giữ active
    // cho cả reduced-motion users.
    const light = dayLightAt(useGameStore.getState().timeMinutes);
    // Cave luôn mờ tối (floor alpha 0.45, tint xanh đêm sâu) — hang sâu không
    // theo chu kỳ ngày/đêm; các zone khác giữ nguyên overlay dayLightAt.
    if (useWorldStore.getState().zone === "cave") {
      this.nightOverlay?.setFillStyle(0x10162e, Math.max(light.alpha, 0.45));
    } else {
      this.nightOverlay?.setFillStyle(light.tint, light.alpha);
    }
    const dt = clampedMs / 1000;
    // ADR-014: gameplay đọc InputAction map, không raw key codes.
    // Input dir thô (chưa normalize) — kinetics lo normalize + accel/braking.
    let dx = 0;
    let dy = 0;
    if (this.actions.pressed.has(InputAction.MoveLeft)) dx -= 1;
    if (this.actions.pressed.has(InputAction.MoveRight)) dx += 1;
    if (this.actions.pressed.has(InputAction.MoveUp)) dy -= 1;
    if (this.actions.pressed.has(InputAction.MoveDown)) dy += 1;
    // W3P4: DecorMode — player đứng yên (con trỏ di chuyển qua keydown riêng).
    const decorModeOn = useDecorModeStore.getState().active;
    if (decorModeOn) {
      this.updateDecorCursor();
      dx = 0;
      dy = 0;
    }
    // Action lock: đang chơi tool anim play-once → zero input dir (kinetics lo
    // braking còn lại). PHẢI đặt trước advanceVelocity để velocity đi về 0.
    // Dùng clampedMs (không phải deltaMs thô) — cùng discipline với warpCooldown.
    if (this.actionLockMs > 0) {
      this.actionLockMs -= clampedMs;
      dx = 0;
      dy = 0;
    }
    // W1P4: đang câu → khoá di chuyển; nhấn phím di chuyển = thu cần (cancel).
    if (this.fishing) {
      if (dx !== 0 || dy !== 0) {
        const f = this.fishing;
        this.fishing = null;
        this.fishingBobber?.destroy();
        this.fishingBobber = undefined;
        useFishingStore.getState().reset();
        useUiStore.getState().notify("Đã thu cần câu", "info");
        void f;
      } else {
        this.updateFishing(clampedMs, dt);
      }
      dx = 0;
      dy = 0;
    }
    const running = this.actions.pressed.has(InputAction.Run);
    // W2: buff speed (món nấu) — nhân kinetics, KHÔNG áp trong nhà (house chật).
    const gameS = useGameStore.getState();
    const spdMult = speedMultiplier(gameS.buffs, gameS.day, gameS.timeMinutes);
    // W6: cưỡi — nhân kinetics mount; buff speed (nếu có) stack tiếp lên trên.
    const mSt = useMountStore.getState();
    const mDef = mSt.mounted && mSt.active ? mountById(mSt.active) : undefined;
    const baseK = mDef ? mountKinetics(mDef.walkMult, mDef.runMult) : DEFAULT_KINETICS;
    const kinetics =
      spdMult > 1 && useWorldStore.getState().zone !== "house"
        ? scaleKinetics(baseK, spdMult)
        : baseK;
    const v = advanceVelocity(this.pvx, this.pvy, dx, dy, running, kinetics, dt);
    this.pvx = v.vx;
    this.pvy = v.vy;
    // Facing theo input dir (không theo velocity) — đổi hướng ngay khi nhập liệu,
    // kể cả khi đang brake (velocity cũ còn lớn).
    if (dx || dy) {
      if (Math.abs(dx) > Math.abs(dy)) this.facing = dx > 0 ? "right" : "left";
      else this.facing = dy > 0 ? "down" : "up";
    }
    // Slide one axis at a time (GameEngine pattern). Applying both first then
    // reverting the *old* axis embeds the body inside the wall and freezes WASD.
    const moved = slideMove(this.player.x, this.player.y, this.pvx * dt, this.pvy * dt, (x, y) => this.collidesAt(x, y));
    this.player.x = moved.x;
    this.player.y = moved.y;
    // Clamp world bounds.
    this.player.x = Math.max(8, Math.min(this.zoneCols * TILE_SIZE - 8, this.player.x));
    this.player.y = Math.max(8, Math.min(this.zoneRows * TILE_SIZE - 8, this.player.y));
    this.playerAvatar?.setPosition(this.player.x, this.player.y).setDepth(this.player.y + 8);
    this.loco = nextLocomotion(this.loco, Math.hypot(this.pvx, this.pvy), this.facing);
    // Tool anim đang chơi → KHÔNG update locomotion anim: dx/dy đã zero → speed 0
    // → nextLocomotion flip sang idle → playLocomotionAnim stomp tool anim
    // play-once ngay frame sau. Skip hết lock window để anim chạy trọn vẹn.
    // W1P4: session câu cũng giữ anim fishing (wait/bite/reel) không bị stomp.
    if (this.actionLockMs <= 0 && !this.fishing) this.playLocomotionAnim();
    this.tryStepWarp();

    // Interact (Space/E): consume justPressed edge — Phaser path trước đây chỉ
    // feed keyboard vào action map nhưng KHÔNG đọc Interact → Space/E không làm gì
    // (core mechanic hỏng trên default path). Legacy engine có handler riêng.
    if (this.actions.justPressed.has(InputAction.Interact)) {
      this.doInteract();
    }

    // W3P5-fix: decor mode camera bám CON TRỎ (updateDecorCursor đã centerOn).
    // Nếu vẫn chạy khối follow bên dưới, nó ghi đè mỗi frame → cursor chạy
    // ra ngoài màn hình (đặt decor mù).
    if (decorModeOn) {
      if (this.interactCooldown > 0) this.interactCooldown -= deltaMs;
      if (this.warpCooldown > 0) this.warpCooldown -= clampedMs;
      endFrame(this.actions);
      return;
    }

    this.trauma = Math.max(0, this.trauma - 0.45 * dt);
    this.cam = updateCamera(this.cam, this.player.x, this.player.y, this.pvx, this.pvy, dt);
    const amp = this.trauma > 0 ? this.trauma * 28 : 0;
    const final = cameraFinalPos(
      this.cam,
      amp > 0 ? amp * this.shakeNoiseX : 0,
      amp > 0 ? amp * this.shakeNoiseY : 0,
    );
    const view = this.cameras.main;
    const clamped = clampCamera(
      final.x,
      final.y,
      this.zoneCols * TILE_SIZE,
      this.zoneRows * TILE_SIZE,
      view.width,
      view.height,
      view.zoom,
    );
    view.centerOn(quantizeForZoom(clamped.x, view.zoom), quantizeForZoom(clamped.y, view.zoom));
    if (this.interactCooldown > 0) this.interactCooldown -= deltaMs;
    if (this.warpCooldown > 0) this.warpCooldown -= clampedMs;
    // ADR-014: clear justPressed edge-state at end of frame.
    endFrame(this.actions);
  }

  /** Teleport/spawn: ghim cam vào player + xóa lookahead. */
  private snapCameraAfterMove(): void {
    if (!this.player) return;
    this.cam.x = this.player.x;
    this.cam.y = this.player.y;
    this.cam.lookaheadX = 0;
    this.cam.lookaheadY = 0;
    const view = this.cameras.main;
    if (view) view.centerOn(this.cam.x, this.cam.y);
  }

  /** Walk onto a labeled warp tile to change zones — Space still works as a backup. */
  private tryStepWarp(): void {
    if (this.warpCooldown > 0 || !this.player) return;
    const tx = Math.floor(this.player.x / TILE_SIZE);
    const ty = Math.floor(this.player.y / TILE_SIZE);
    const warp = findWarp(getZone(useWorldStore.getState().zone), tx, ty);
    if (!warp) return;
    this.warpCooldown = 450;
    useWorldStore.getState().enterZone(warp.to, warp.spawn);
    useUiStore.getState().notify(`→ ${warp.label}`, "info");
  }

  /** Pixel pos có va vào tile solid/building không? Check center + 4 góc (bbox). */
  private collidesAt(px: number, py: number): boolean {
    const half = 8;
    const checks = [
      [px - half, py - half],
      [px + half, py - half],
      [px - half, py + half],
      [px + half, py + half],
      [px, py],
    ];
    const world = useWorldStore.getState();
    for (const [cx, cy] of checks) {
      const tx = Math.floor(cx / TILE_SIZE);
      const ty = Math.floor(cy / TILE_SIZE);
      if (tx < 0 || ty < 0 || tx >= this.zoneCols || ty >= this.zoneRows) return true;
      if (world.isSolid(tx, ty)) return true;
    }
    const hit = TILE_SIZE * 0.35;
    for (const npc of this.npcs) {
      const nx = npc.tx * TILE_SIZE + TILE_SIZE / 2;
      const ny = npc.ty * TILE_SIZE + TILE_SIZE / 2;
      if (Math.abs(nx - px) < hit && Math.abs(ny - py) < hit) return true;
    }
    return false;
  }
}
