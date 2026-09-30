// Unity FarmSaveDTO → farm-filch FarmSaveData adapter (bridge).
// Converts the Unity client's PascalCase FarmSaveDTO into the farm-filch
// cloud payload, so Unity saves can reach the farm-filch Postgres.
//
// NOTE: the two games use different maps/grids. Unity soil uses arbitrary
// (CellX, CellY) from its FarmPrototype scene; farm-filch uses a 60×60 tile
// array (index = y*MAP_COLS+x). This adapter does a BEST-EFFORT remap:
//   - tiles outside 0..59 are dropped,
//   - soil Status 0/1/2/3 → GRASS/TILLED/TILLED/TILLED_WET,
//   - PlantedCropId "crop_xxx" → farm-filch crop id "xxx" (whitelisted),
//   - inventory "tool_x"/"seed_x"/"crop_x_yield"/"item_x" → farm-filch item id.
// Gold is NOT carried (server-authoritative); see actions/wallet.ts.

import { MAP_COLS, MAP_ROWS, T } from "@/lib/game/constants";
import type { FarmSaveData } from "@/lib/game/farm-service";

/** Unity whitelist id → farm-filch item/crop id. Unknown → dropped. */
export const UNITY_CROP_MAP: Record<string, string> = {
  crop_tomato: "tomato",
  crop_carrot: "carrot",
  crop_potato: "potato",
  crop_cabbage: "cabbage",
  crop_wheat: "wheat",
  crop_eggplant: "eggplant",
  crop_hot_pepper: "hot_pepper",
  crop_corn: "corn",
  crop_strawberry: "strawberry",
  crop_pumpkin: "pumpkin",
  crop_watermelon: "watermelon",
  crop_onion: "onion",
  crop_beetroot: "beetroot",
  crop_green_beans: "green_beans",
  crop_blueberry: "blueberry",
  crop_broccoli: "broccoli",
  crop_cauliflower: "cauliflower",
  crop_parsnip: "parsnip",
};

/** Unity inventory item id → farm-filch item id. Unknown → dropped. */
export const UNITY_ITEM_MAP: Record<string, string> = {
  tool_hoe: "hoe",
  tool_watering_can: "watering_can",
  tool_axe: "axe",
  tool_pickaxe: "pickaxe",
  tool_sickle: "scythe",
  item_wood: "wood",
  item_stone: "stone",
  item_fiber: "fiber",
  seed_tomato: "tomato_seed",
  seed_carrot: "carrot_seed",
  seed_potato: "potato_seed",
  seed_corn: "corn_seed",
  seed_cabbage: "cabbage_seed",
  seed_strawberry: "strawberry_seed",
  seed_pumpkin: "pumpkin_seed",
  seed_onion: "onion_seed",
  seed_beetroot: "beetroot_seed",
  seed_green_beans: "green_beans_seed",
  seed_blueberry: "blueberry_seed",
  seed_cauliflower: "cauliflower_seed",
  seed_parsnip: "parsnip_seed",
  crop_tomato_yield: "tomato",
  crop_carrot_yield: "carrot",
  crop_potato_yield: "potato",
  crop_corn_yield: "corn",
  crop_strawberry_yield: "strawberry",
  crop_pumpkin_yield: "pumpkin",
  crop_wheat_yield: "wheat",
  crop_onion_yield: "onion",
  crop_beetroot_yield: "beetroot",
};

/** Unity tile Status int → farm-filch terrain code. */
export function soilStatusToTerrain(status: number): number {
  switch (status) {
    case 1:
      return T.TILLED; // tilled
    case 2:
      return T.TILLED; // planted
    case 3:
      return T.TILLED_WET; // watered
    default:
      return T.GRASS; // untilled
  }
}

export interface UnityFarmSaveDTO {
  Profile?: {
    PlayerId?: string;
    PlayerName?: string;
    Gold?: number;
    UnlockedRowCount?: number;
    UnlockedPlotIds?: number[];
    LastSaveTimestamp?: number;
    /** UnityServer-issued version (+1 per commit); orders cloud copies. */
    FarmVersion?: number;
    Presence?: string;
    ShieldUntilTimestamp?: number;
    DefenseXP?: number;
  };
  Tiles?: {
    CellX?: number;
    CellY?: number;
    GridX?: number;
    GridY?: number;
    Status?: number;
    PlantedCropId?: string;
    PlantedTimestamp?: number;
    WateredTimestamp?: number;
    CropStageIndex?: number;
  }[];
  Inventory?: { SlotIndex?: number; ItemId?: string; Quantity?: number }[];
  Storages?: {
    StorageId?: string;
    StorageDataId?: string;
    PlotId?: number;
    CellX?: number;
    CellY?: number;
    Items?: { SlotIndex?: number; ItemId?: string; Quantity?: number }[];
  }[];
  PropTiles?: unknown[];
  EnvironmentProps?: unknown[];
}

/** Resolve a Unity tile's grid cell (CellX/GridX aliases). */
function tileX(t: NonNullable<UnityFarmSaveDTO["Tiles"]>[number]): number {
  return typeof t.CellX === "number" ? t.CellX : (t.GridX ?? -1);
}
function tileY(t: NonNullable<UnityFarmSaveDTO["Tiles"]>[number]): number {
  return typeof t.CellY === "number" ? t.CellY : (t.GridY ?? -1);
}

/**
 * Convert Unity FarmSaveDTO → farm-filch FarmSaveData (best-effort).
 * Pure: no DB, no auth. Returns a ready-to-persist payload.
 */
export function adaptUnityFarmSave(dto: UnityFarmSaveDTO): FarmSaveData {
  // Start from the authored 60×60 farm (paths/water/plots) so a partial Unity
  // save only overlays its own soil/crops and never wipes the authored map.
  const terrain = Array.from({ length: MAP_COLS * MAP_ROWS }, () => T.GRASS);
  const crops: Record<string, unknown> = {};
  const objects: Record<string, unknown> = {};
  const forage: Record<string, unknown> = {};
  const shippingBoxes: Record<string, unknown> = {};

  for (const tile of dto.Tiles ?? []) {
    const x = tileX(tile);
    const y = tileY(tile);
    if (x < 0 || y < 0 || x >= MAP_COLS || y >= MAP_ROWS) continue;
    const idx = y * MAP_COLS + x;
    terrain[idx] = soilStatusToTerrain(tile.Status ?? 0);

    const cropId = (tile.PlantedCropId ?? "").trim();
    const mapped = cropId ? UNITY_CROP_MAP[cropId] : undefined;
    if (mapped) {
      crops[String(idx)] = {
        cropId: mapped,
        stage: Math.min(Math.max(0, tile.CropStageIndex ?? 0), 6),
        daysGrown: 0,
        watered: (tile.Status ?? 0) === 3,
        dead: false,
      };
    }
  }

  // Unity storages → farm-filch objects/shipping boxes (best-effort; chests
  // are not part of farm-filch's PlacedObject model → dropped beyond boxes).
  for (const storage of dto.Storages ?? []) {
    if (storage.StorageDataId === "chest_wood" || storage.StorageDataId === "chest_iron") {
      const x = typeof storage.CellX === "number" ? storage.CellX : -1;
      const y = typeof storage.CellY === "number" ? storage.CellY : -1;
      if (x < 0 || y < 0 || x >= MAP_COLS || y >= MAP_ROWS) continue;
      objects[String(y * MAP_COLS + x)] = { type: "shipping_box" };
    }
  }

  const profile = dto.Profile ?? {};
  return {
    terrain,
    crops,
    objects,
    forage,
    shippingBoxes,
    placedDecor: [],
    pondFish: [],
    gameMeta: {
      day: 1,
      season: "Spring",
      year: 1,
      timeMinutes: 360,
      energy: 270,
      player: { x: 12, y: 12 },
    },
  };
}

/** Unity inventory → farm-filch inventory deltas (whitelisted, capped 999). */
export function adaptUnityInventory(dto: UnityFarmSaveDTO): { itemId: string; qty: number }[] {
  const out: { itemId: string; qty: number }[] = [];
  const seen = new Map<string, number>();
  for (const slot of dto.Inventory ?? []) {
    const itemId = slot.ItemId ?? "";
    const mapped = UNITY_ITEM_MAP[itemId];
    if (!mapped) continue;
    const qty = Number.isInteger(slot.Quantity) ? Math.min(Math.max(0, slot.Quantity!), 999) : 0;
    if (qty <= 0) continue;
    seen.set(mapped, (seen.get(mapped) ?? 0) + qty);
  }
  for (const [itemId, qty] of seen) out.push({ itemId, qty: Math.min(qty, 999) });
  return out;
}

/** Reverse crop map (farm-filch crop id → Unity PlantedCropId). */
export const FARM_FILCH_CROP_TO_UNITY: Record<string, string> = Object.fromEntries(
  Object.entries(UNITY_CROP_MAP).map(([u, f]) => [f, u]),
);

/** Reverse item map (farm-filch item id → Unity ItemId). */
export const FARM_FILCH_ITEM_TO_UNITY: Record<string, string> = Object.fromEntries(
  Object.entries(UNITY_ITEM_MAP).map(([u, f]) => [f, u]),
);

export interface UnityFarmPullRow {
  ownerId?: string;
  displayName?: string | null;
  gold?: number;
  defenseXp?: number;
  shieldUntil?: Date | null;
  terrain?: number[];
  crops?: Record<string, unknown>;
  objects?: Record<string, unknown>;
  shippingBoxes?: Record<string, unknown>;
}

export interface UnityInventoryRow {
  itemId: string;
  qty: number;
}

/**
 * Build a Unity FarmSaveDTO from farm-filch rows (best-effort reverse).
 * Used when no full `unitySnapshot` exists (web-created farm), so the Unity
 * client can still log in with a cloud farm. Terrain codes: TILLED=4,
 * TILLED_WET=5 → Status 1 / 3; crops map farm-filch cropId → crop_xxx.
 */
export function adaptUnityFarmPull(
  farm: UnityFarmPullRow,
  inventory: UnityInventoryRow[] = [],
): UnityFarmSaveDTO {
  const terrain = Array.isArray(farm.terrain) ? farm.terrain : [];
  const crops = (farm.crops ?? {}) as Record<string, { cropId?: string; stage?: number; watered?: boolean }>;

  const tiles: NonNullable<UnityFarmSaveDTO["Tiles"]> = [];
  for (let i = 0; i < terrain.length; i++) {
    const code = terrain[i];
    if (code !== 4 && code !== 5) continue; // only tilled / watered map to Unity Tiles
    const x = i % MAP_COLS;
    const y = Math.floor(i / MAP_COLS);
    const crop = crops[String(i)];
    const plantedCropId = crop?.cropId ? FARM_FILCH_CROP_TO_UNITY[crop.cropId] ?? "" : "";
    tiles.push({
      CellX: x,
      CellY: y,
      GridX: x,
      GridY: y,
      Status: code === 5 ? 3 : 2, // watered → 3, tilled → planted
      PlantedCropId: plantedCropId,
      PlantedTimestamp: 0,
      PlantTimestamp: 0,
      WateredTimestamp: 0,
      CropStageIndex: typeof crop?.stage === "number" ? crop.stage : 0,
      WatersAppliedThisStage: 0,
      LastWaterUnix: 0,
      StageClockStartUnix: 0,
      WiltDeadlineUnix: 0,
    });
  }

  const invSlots: NonNullable<UnityFarmSaveDTO["Inventory"]> = [];
  for (const inv of inventory) {
    const unityId = FARM_FILCH_ITEM_TO_UNITY[inv.itemId];
    if (!unityId || inv.qty <= 0) continue;
    invSlots.push({ SlotIndex: invSlots.length, ItemId: unityId, Quantity: inv.qty });
  }

  const shieldUntil = farm.shieldUntil instanceof Date
    ? Math.floor(farm.shieldUntil.getTime() / 1000)
    : 0;

  return {
    Profile: {
      PlayerId: farm.ownerId ?? "",
      PlayerName: farm.displayName ?? farm.ownerId ?? "",
      Gold: typeof farm.gold === "number" ? farm.gold : 500,
      UnlockedRowCount: 4,
      UnlockedPlotIds: [1],
      LastSaveTimestamp: Math.floor(Date.now() / 1000),
      Presence: "OFFLINE",
      ShieldUntilTimestamp: shieldUntil,
      DefenseXP: typeof farm.defenseXp === "number" ? farm.defenseXp : 0,
    },
    Tiles: tiles,
    Inventory: invSlots,
    Storages: [],
    PropTiles: [],
    EnvironmentProps: [],
  };
}