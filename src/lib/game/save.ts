// Save / Load system backed by IndexedDB (with localStorage fallback).
// Supports 3 save slots, a versioned schema, migration from older versions,
// and corrupt-save detection with friendly error reporting.

import { SEASONS, MAX_ENERGY } from "@/lib/game/constants";
import { mountById } from "@/lib/game/mounts/mount-catalog";
import { TUTORIAL_ORDER } from "@/lib/game/tutorial/tutorial-catalog";

const TUTORIAL_STEP_IDS = new Set<string>(TUTORIAL_ORDER);

const DB_NAME = "harvest-hollow";
const DB_VERSION = 1;
const STORE_NAME = "saves";
const LEGACY_LS_KEY = "stardew-clone-save-v1"; // pre-IndexedDB localStorage key

// Bump SAVE_SCHEMA_VERSION when the SaveData shape changes; add a migrate step.
// Phase 6: 2 → 3 (add progression block). Coord rescale ×1.5 đã phase 3 (coordVersion).
// Orders fix: 5 → 6 (add farm.filledOrders). W1P5: 6 → 7 (add farm.pondFish — nuôi cá ao).
// W2P3: 7 → 8 (add game.buffs — speed/xp theo phút tuyệt đối).
// W3P2: 8 → 9 (add farm.placedDecor + farm.decorOwned — decor không-thể-trộm §7).
// W8P3: 10 → 11 (add game.catchLog — cá hôm nay cho fishing derby)
// W6P2: 9 → 10 (add mounts {owned, active} top-level — của NGƯỜI CHƠI, không farm-block;
// mounted KHÔNG persist — load luôn xuống ngựa).
// W9P3: 11 → 12 (RETIRE story block; quests + tutorialStep/tutorialClaimed — chuỗi
// tutorial tuyến tính thay 5-chapter demo. Save cũ story → drop. Fresh day-1
// tutorial {0, []}; veteran day>=3 hoặc level>=3 skip full chain).
export const SAVE_SCHEMA_VERSION = 12;

export type SaveSlot = "slot1" | "slot2" | "slot3";

export interface SaveMeta {
  slot: SaveSlot;
  exists: boolean;
  savedAt: number;
  preview: {
    day: number;
    season: string;
    year: number;
    gold: number;
    farmName: string;
  } | null;
}

export interface SaveData {
  version: number; // schema version
  savedAt: number;
  slot: SaveSlot;
  /**
   * Coord-format version. 2 = tile coords (current). Field kept for backwards read
   * compat; không còn rescale — tile coords là dimensionless, không đổi khi TILE_SIZE đổi.
   */
  coordVersion?: 1 | 2;
  game: {
    day: number;
    season: string;
    seasonIndex: number;
    year: number;
    timeMinutes: number;
    gold: number;
    energy: number;
    maxEnergy?: number;
    collapsed?: boolean;
    totalEarned?: number;
    toolsUsed?: number;
    /** W2 (schema 8): buff speed/xp — {speedUntilAbs?, xpUntilAbs?} phút tuyệt đối. */
    buffs?: { speedUntilAbs?: number; xpUntilAbs?: number };
    /** W8 (schema 11): cá bắt hôm nay — derby điểm, endDay clear. */
    catchLog?: string[];
  };
  player: {
    x: number; // tile coords (dimensionless — không đổi khi TILE_SIZE đổi)
    y: number;
    facing?: string;
  };
  inventory: {
    slots: ({ itemId: string; qty: number } | null)[];
    selectedSlot: number;
  };
  farm: {
    terrain: number[];
    crops: Record<number, unknown>;
    objects: Record<number, unknown>;
    forage: Record<number, string>;
    shippingBoxes?: Record<number, unknown>;
    /** Phase 5 (schema 5): kho nông sản — migrate từ v4 default {}. */
    silo?: Record<string, number>;
    /** Orders fix (schema 6): order id đã giao hôm nay — migrate default []. */
    filledOrders?: string[];
    /** W1P5 (schema 7): cá bột nuôi ao — migrate default []. */
    pondFish?: { fishId: string; daysGrown: number }[];
    /** W3P2 (schema 9): decor đã đặt — migrate default []. */
    placedDecor?: {
      uid: string;
      defId: string;
      zone: "farm" | "house";
      tx: number;
      ty: number;
      rot: number;
      flip: boolean;
    }[];
    /** W3P2 (schema 9): kho decor đã mua — migrate default {}. */
    decorOwned?: Record<string, number>;
  };
  npc: {
    friendship: Record<string, number>;
    talkedToday: Record<string, boolean>;
    giftedToday: Record<string, boolean>;
    metNpcs?: Record<string, boolean>;
  };
  quests?: {
    completed: Record<string, boolean>;
    shipped: Record<string, number>;
    shippedGold: number;
    daysPlayed: number;
    /** W9 (schema 12): bước tutorial hiện tại (0-based; 14 = xong chuỗi). */
    tutorialStep?: number;
    /** W9 (schema 12): các bước đã claim (đúng thứ tự TUTORIAL_ORDER). */
    tutorialClaimed?: string[];
  };
  /** Phase 6: RPG progression (level/xp/skillPoints/perkAllocations). */
  progression?: {
    level: number;
    xp: number;
    totalXp: number;
    skillPoints: number;
    perkAllocations: { farming: number; combat: number; social: number };
  };
  /** Phase 7: story position (save-anywhere, không checkpoint-only). */
  story?: {
    chapterId: string;
    nodeId: string;
    visitedNodes: string[];
    flags: Record<string, number>;
    /** Ending đã resolve (redemption/tyranny/sacrifice). Null đến khi ch5 resolve.
     *  Trước đây omit → ending reset null mỗi reload (xóa completion state). */
    ending?: "redemption" | "tyranny" | "sacrifice" | null;
  };
  world?: {
    zone: string;
    wellRepaired: boolean;
    waterCharges: number;
    minedRocks: Record<string, boolean>;
    defeatedSlimes: Record<string, boolean>;
  };
  /** W6 (schema 10): mount của người chơi — owned/active; mounted ephemeral. */
  mounts?: {
    owned: string[];
    active: string | null;
  };
  animals?: {
    animals: Array<{
      id: string;
      kind: string;
      tx: number;
      ty: number;
      fedToday: boolean;
      hasProduct: boolean;
    }>;
  };
}

// ---------- IndexedDB helpers ----------

// Module-scoped connection cache — trước đây mỗi idbPut/Get mở conn mới + close,
// thrash khi autosave 2s debounce (migrateLegacySave mở 2×). Cache reuse; reopen
// khi null (sau versionchange/close ở tab khác).
let dbCache: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbCache) return Promise.resolve(dbCache);
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "slot" });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      // Invalidate cache khi tab khác bump version (tránh Blocked).
      db.onversionchange = () => {
        dbCache = null;
      };
      dbCache = db;
      resolve(db);
    };
    req.onerror = () => reject(req.error ?? new Error("IDB open failed"));
    req.onblocked = () => reject(new Error("IDB open blocked (close other tabs)"));
  });
}

function idbPut(slot: SaveSlot, data: SaveData): Promise<void> {
  return openDB().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(data);
        tx.oncomplete = () => {
          resolve();
        };
        tx.onerror = () => {
          reject(tx.error ?? new Error("IDB put failed"));
        };
      }),
  );
}

function idbGet(slot: SaveSlot): Promise<SaveData | null> {
  return openDB().then(
    (db) =>
      new Promise<SaveData | null>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const req = tx.objectStore(STORE_NAME).get(slot);
        req.onsuccess = () => {
          resolve((req.result as SaveData) ?? null);
        };
        req.onerror = () => {
          reject(req.error ?? new Error("IDB get failed"));
        };
      }),
  );
}

function idbDelete(slot: SaveSlot): Promise<void> {
  return openDB().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).delete(slot);
        tx.oncomplete = () => {
          resolve();
        };
        tx.onerror = () => {
          reject(tx.error ?? new Error("IDB delete failed"));
        };
      }),
  );
}

function idbGetAllKeys(): Promise<SaveSlot[]> {
  return openDB().then(
    (db) =>
      new Promise<SaveSlot[]>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const req = tx.objectStore(STORE_NAME).getAllKeys();
        req.onsuccess = () => {
          resolve((req.result as SaveSlot[]) ?? []);
        };
        req.onerror = () => {
          reject(req.error ?? new Error("IDB getAllKeys failed"));
        };
      }),
  );
}

// ---------- localStorage fallback ----------

function lsKey(slot: SaveSlot): string {
  return `hh-save-${slot}`;
}

function lsPut(slot: SaveSlot, data: SaveData): void {
  localStorage.setItem(lsKey(slot), JSON.stringify(data));
}

function lsGet(slot: SaveSlot): SaveData | null {
  try {
    const raw = localStorage.getItem(lsKey(slot));
    if (!raw) return null;
    return JSON.parse(raw) as SaveData;
  } catch {
    return null;
  }
}

function lsDelete(slot: SaveSlot): void {
  localStorage.removeItem(lsKey(slot));
}

function idbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

// ---------- Migration ----------

/**
 * Migrate an older save payload to the current SAVE_SCHEMA_VERSION.
 * Exported cho test full-chain (v1 → v2 → v3). Phase 6: bump 2→3 (progression block).
 * Player coords luôn tile (collectSaveData lưu getPlayerTile). Tile coords dimensionless
 * → KHÔNG rescale khi TILE_SIZE đổi (rescale ×1.5 cũ đã corrupt: teleport ra map).
 */
/** W8: catchLog untrusted — chỉ string[], cap 500 (chống phình save). */
function sanitizeCatchLog(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string").slice(0, 500);
}

/** W6: mounts untrusted (save cũ/hack local) — lọc về catalog hợp lệ. */
function sanitizeMounts(m: SaveData["mounts"] | undefined): SaveData["mounts"] {
  const owned = Array.isArray(m?.owned)
    ? m!.owned.filter((id): id is string => typeof id === "string" && !!mountById(id))
    : [];
  const active = typeof m?.active === "string" && owned.includes(m.active) ? m.active : null;
  return { owned, active };
}

export function migrate(raw: unknown): SaveData | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Partial<SaveData> & { version?: number };
  const ver = data.version ?? 1;
  if (ver > SAVE_SCHEMA_VERSION) return null;
  // Cozy farm demo: no migration from raid-era saves (v1–v3). New Game wipes.
  if (ver < 4) return null;
  // v1 → v2: add player position default, ensure quests object exists
  // Audit #5: field-level guards thay vì as-cast {} (tránh NaN terrain.length).
  const inGame = (data.game ?? {}) as Record<string, unknown>;
  const inFarm = (data.farm ?? {}) as Record<string, unknown>;
  const inNpc = (data.npc ?? {}) as Record<string, unknown>;
  const inInv = (data.inventory ?? {}) as Record<string, unknown>;
  // Invariant: season === SEASONS[seasonIndex]. Khi seasonIndex thiếu (save v1),
  // derive từ season thay vì mặc định 0 (Spring) — tránh load "Winter" → next
  // sleep về Summer do index lệch.
  const migratedSeason = (inGame.season as string) ?? "Spring";
  const migratedSeasonIndex =
    inGame.seasonIndex !== undefined
      ? (inGame.seasonIndex as number)
      : Math.max(0, SEASONS.indexOf(migratedSeason as (typeof SEASONS)[number]));
  const migrated: SaveData = {
    version: SAVE_SCHEMA_VERSION,
    savedAt: data.savedAt ?? Date.now(),
    slot: (data.slot ?? "slot1") as SaveSlot,
    game: {
      day: (inGame.day as number) ?? 1,
      season: migratedSeason,
      seasonIndex: migratedSeasonIndex,
      year: (inGame.year as number) ?? 1,
      timeMinutes: (inGame.timeMinutes as number) ?? 360,
      gold: (inGame.gold as number) ?? 0,
      energy: (inGame.energy as number) ?? MAX_ENERGY,
      maxEnergy:
        typeof inGame.maxEnergy === "number" && inGame.maxEnergy > 0
          ? (inGame.maxEnergy as number)
          : MAX_ENERGY,
      collapsed: inGame.collapsed as boolean | undefined,
      totalEarned: inGame.totalEarned as number | undefined,
      toolsUsed: inGame.toolsUsed as number | undefined,
      // v11 (W8): catchLog — save cũ rỗng (mất 1 ngày derby khi upgrade, chấp nhận).
      catchLog: sanitizeCatchLog(inGame.catchLog),
      // v8 (W2): buffs — save cũ migrate rỗng (buff ngắn hạn, mất khi tải cũng ổn).
      buffs:
        inGame.buffs && typeof inGame.buffs === "object"
          ? (inGame.buffs as Record<string, number>)
          : {},
    },
    player: (data as { player?: SaveData["player"] }).player ?? { x: 19, y: 20, facing: "up" },
    inventory: {
      slots: (inInv.slots as SaveData["inventory"]["slots"]) ?? [],
      selectedSlot: (inInv.selectedSlot as number) ?? 0,
    },
    farm: {
      terrain: (inFarm.terrain as number[]) ?? [],
      crops: (inFarm.crops as SaveData["farm"]["crops"]) ?? {},
      objects: (inFarm.objects as SaveData["farm"]["objects"]) ?? {},
      forage: (inFarm.forage as SaveData["farm"]["forage"]) ?? {},
      shippingBoxes: inFarm.shippingBoxes as SaveData["farm"]["shippingBoxes"] | undefined,
      // v4 → v5: silo chưa tồn tại → default {} (farmStore.hydrate sanitize qty).
      silo: (inFarm.silo as Record<string, number> | undefined) ?? {},
      // v5 → v6: filledOrders chưa tồn tại → default [] (chưa giao đơn nào).
      filledOrders: (inFarm.filledOrders as string[] | undefined) ?? [],
      // v6 → v7: pondFish chưa tồn tại → default [] (ao trống).
      pondFish: (inFarm.pondFish as { fishId: string; daysGrown: number }[] | undefined) ?? [],
      // v8 → v9: decor chưa tồn tại → default [] / {} (farmStore.hydrate sanitize).
      placedDecor: (inFarm.placedDecor as SaveData["farm"]["placedDecor"] | undefined) ?? [],
      decorOwned: (inFarm.decorOwned as Record<string, number> | undefined) ?? {},
    },
    npc: {
      friendship: (inNpc.friendship as Record<string, number>) ?? {},
      talkedToday: (inNpc.talkedToday as Record<string, boolean>) ?? {},
      giftedToday: (inNpc.giftedToday as Record<string, boolean>) ?? {},
      metNpcs: inNpc.metNpcs as Record<string, boolean> | undefined,
    },
    quests: (() => {
      const rawQ = data.quests;
      const inDay = typeof inGame.day === "number" && Number.isFinite(inGame.day) ? inGame.day : 1;
      const prog = (data as { progression?: SaveData["progression"] }).progression;
      const inLevel = typeof prog?.level === "number" && Number.isFinite(prog.level) ? prog.level : 1;
      const veteran = inDay >= 3 || inLevel >= 3;
      const tutorialSkip = {
        tutorialStep: TUTORIAL_ORDER.length,
        tutorialClaimed: [...TUTORIAL_ORDER],
      };
      const tutorialFresh = { tutorialStep: 0, tutorialClaimed: [] as string[] };
      if (!rawQ) {
        return {
          completed: {},
          shipped: {},
          shippedGold: 0,
          daysPlayed: 1,
          ...(veteran ? tutorialSkip : tutorialFresh),
        };
      }
      const q = rawQ as NonNullable<SaveData["quests"]>;
      const hasTutorialField =
        typeof q.tutorialStep === "number" || Array.isArray(q.tutorialClaimed);
      const claimed = Array.isArray(q.tutorialClaimed)
        ? (q.tutorialClaimed as string[]).filter(
            (id) => typeof id === "string" && TUTORIAL_STEP_IDS.has(id),
          )
        : [];
      const tutorial = !hasTutorialField && veteran
        ? tutorialSkip
        : {
            tutorialStep: claimed.length,
            tutorialClaimed: claimed,
          };
      return {
        completed: q.completed ?? {},
        shipped: q.shipped ?? {},
        shippedGold: q.shippedGold ?? 0,
        daysPlayed: q.daysPlayed ?? 1,
        ...tutorial,
      };
    })(),
    progression: (data as { progression?: SaveData["progression"] }).progression ?? {
      level: 1,
      xp: 0,
      totalXp: 0,
      skillPoints: 0,
      perkAllocations: { farming: 0, combat: 0, social: 0 },
    },
    // W9P3 (v12): story block RETIRED — save cũ giữ nguyên nhưng không còn được
    // đọc/write (questStore migrate từ completed; blood-moon day-hash thuần).
    //story: (data as { story?: SaveData["story"] }).story,
    world: (data as { world?: SaveData["world"] }).world,
    animals: (data as { animals?: SaveData["animals"] }).animals,
    // W6 (v10): mounts — passthrough khi có, default rỗng khi save cũ. Sanitize
    // ở mountStore.hydrate (owned ⊆ catalog) — đây chỉ shape.
    mounts: sanitizeMounts((data as { mounts?: SaveData["mounts"] }).mounts),
  };
  // Player coords = tile (dimensionless). Không rescale khi TILE_SIZE đổi —
  // rescale ×1.5 cũ corrupt vì collectSaveData luôn lưu tile, không phải pixel.
  migrated.coordVersion = 2;
  return migrated;
}

// ---------- Public API ----------

/** Save game data to a slot (IndexedDB, fallback localStorage). Returns true on success. */
export async function saveGame(
  slot: SaveSlot,
  data: Omit<SaveData, "version" | "savedAt" | "slot">,
): Promise<boolean> {
  const payload: SaveData = {
    version: SAVE_SCHEMA_VERSION,
    savedAt: Date.now(),
    slot,
    coordVersion: 2,
    ...data,
  };
  try {
    if (idbAvailable()) {
      await idbPut(slot, payload);
    } else {
      lsPut(slot, payload);
    }
    return true;
  } catch (e) {
    console.error("Failed to save game:", e);
    // last-resort fallback to localStorage
    try {
      lsPut(slot, payload);
      return true;
    } catch {
      return false;
    }
  }
}

/** Synchronous save (localStorage only). Kept for backwards compat with old callers. */
export function saveGameSync(
  slot: SaveSlot,
  data: Omit<SaveData, "version" | "savedAt" | "slot">,
): boolean {
  const payload: SaveData = {
    version: SAVE_SCHEMA_VERSION,
    savedAt: Date.now(),
    slot,
    coordVersion: 2,
    ...data,
  };
  try {
    lsPut(slot, payload);
    return true;
  } catch (e) {
    console.error("Failed to save game (sync):", e);
    return false;
  }
}

/** Load a save slot, with migration + corrupt-save detection. */
export async function loadGame(slot: SaveSlot): Promise<SaveData | null> {
  try {
    let raw: SaveData | null = null;
    if (idbAvailable()) {
      raw = await idbGet(slot);
    }
    if (!raw) raw = lsGet(slot);
    if (!raw) return null;
    // Validate shape (corrupt-save detection)
    if (!raw || typeof raw !== "object" || !raw.game || !raw.inventory) {
      throw new Error("Save data is corrupted or incomplete");
    }
    const migrated = migrate(raw);
    if (!migrated) {
      // Phân biệt downgrade (save mới hơn client) vs corruption khác. migrate trả
      // null khi ver > SAVE_SCHEMA_VERSION — PWA cache cũ load save từ build mới.
      const ver = (raw as { version?: number })?.version ?? 1;
      if (ver > SAVE_SCHEMA_VERSION) {
        throw new Error("Save newer than this client — refresh/update app");
      }
      throw new Error("Save data could not be migrated");
    }
    return migrated;
  } catch (e) {
    console.error("Failed to load game:", e);
    throw e; // re-throw so callers can show a friendly toast
  }
}

/** Synchronous load (localStorage only). Kept for backwards compat. */
export function loadGameSync(slot: SaveSlot): SaveData | null {
  try {
    const raw = lsGet(slot);
    if (!raw) return null;
    if (!raw || typeof raw !== "object" || !raw.game || !raw.inventory) return null;
    return migrate(raw);
  } catch {
    return null;
  }
}

/** Check if a slot has a save. */
export async function hasSave(slot: SaveSlot): Promise<boolean> {
  try {
    if (idbAvailable()) {
      const data = await idbGet(slot);
      if (data) return true;
    }
    return !!lsGet(slot);
  } catch {
    return false;
  }
}

/** Synchronous hasSave (localStorage only). */
export function hasSaveSync(slot: SaveSlot): boolean {
  try {
    return !!lsGet(slot);
  } catch {
    return false;
  }
}

/** Delete a save slot. */
export async function deleteSave(slot: SaveSlot): Promise<void> {
  try {
    if (idbAvailable()) await idbDelete(slot);
    lsDelete(slot);
  } catch (e) {
    console.error("Failed to delete save:", e);
  }
}

/** List all save slots with metadata (for the slot-picker UI). */
export async function listSaves(): Promise<SaveMeta[]> {
  const slots: SaveSlot[] = ["slot1", "slot2", "slot3"];
  const results: SaveMeta[] = [];
  for (const slot of slots) {
    let data: SaveData | null = null;
    try {
      if (idbAvailable()) data = await idbGet(slot);
      if (!data) data = lsGet(slot);
    } catch {
      data = null;
    }
    if (data && data.game) {
      results.push({
        slot,
        exists: true,
        savedAt: data.savedAt,
        preview: {
          day: data.game.day ?? 1,
          season: data.game.season ?? "Spring",
          year: data.game.year ?? 1,
          gold: data.game.gold ?? 0,
          farmName: "Harvest Hollow",
        },
      });
    } else {
      results.push({ slot, exists: false, savedAt: 0, preview: null });
    }
  }
  return results;
}

/** Migrate the legacy localStorage single-save key to slot1 (one-time). */
export async function migrateLegacySave(): Promise<void> {
  try {
    const legacy = localStorage.getItem(LEGACY_LS_KEY);
    if (!legacy) return;
    const raw = JSON.parse(legacy);
    if (!raw || !raw.game) return;
    // Only migrate if slot1 is empty
    const slot1Exists = await hasSave("slot1");
    if (slot1Exists) return;
    const migrated = migrate(raw);
    if (migrated) {
      migrated.slot = "slot1";
      await saveGame("slot1", migrated);
      localStorage.removeItem(LEGACY_LS_KEY);
      console.info("[save] Migrated legacy save to slot1");
    }
  } catch {
    /* noop */
  }
}
