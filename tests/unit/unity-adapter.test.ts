// Unity FarmSaveDTO → farm-filch adapter (bridge): mapping coverage.
import { describe, expect, it } from "vitest";
import {
  adaptUnityFarmSave,
  adaptUnityInventory,
  soilStatusToTerrain,
  UNITY_CROP_MAP,
} from "@/lib/game/unity-adapter";
import { MAP_COLS, MAP_ROWS, T } from "@/lib/game/constants";

const PLOT_INDEX = (x: number, y: number) => y * MAP_COLS + x;

describe("soilStatusToTerrain", () => {
  it("maps Unity soil Status to farm-filch tile codes", () => {
    expect(soilStatusToTerrain(0)).toBe(T.GRASS); // untilled
    expect(soilStatusToTerrain(1)).toBe(T.TILLED); // tilled
    expect(soilStatusToTerrain(2)).toBe(T.TILLED); // planted (dry soil)
    expect(soilStatusToTerrain(3)).toBe(T.TILLED_WET); // watered
  });
});

describe("adaptUnityFarmSave", () => {
  it("overlays tiles/crops onto a full-size terrain array", () => {
    const dto = {
      Profile: { PlayerId: "unity1", PlayerName: "Unity", Gold: 500 },
      Tiles: [
        { CellX: 5, CellY: 6, Status: 3, PlantedCropId: "crop_tomato", CropStageIndex: 2 },
        { CellX: 7, CellY: 8, Status: 1, PlantedCropId: "" },
      ],
      Inventory: [],
      Storages: [],
    };
    const out = adaptUnityFarmSave(dto);
    expect(out.terrain).toHaveLength(MAP_COLS * MAP_ROWS);
    expect(out.terrain[PLOT_INDEX(5, 6)]).toBe(T.TILLED_WET);
    expect(out.terrain[PLOT_INDEX(7, 8)]).toBe(T.TILLED);
    expect(out.crops[String(PLOT_INDEX(5, 6))]).toMatchObject({ cropId: "tomato", stage: 2, watered: true });
  });

  it("drops out-of-bounds tiles (custom Unity grid vs 60×60)", () => {
    const dto = {
      Profile: { PlayerId: "unity1" },
      Tiles: [
        { CellX: -1, CellY: 0, Status: 1, PlantedCropId: "crop_tomato" },
        { CellX: 999, CellY: 999, Status: 1, PlantedCropId: "crop_tomato" },
      ],
      Inventory: [],
      Storages: [],
    };
    const out = adaptUnityFarmSave(dto);
    const planted = Object.values(out.crops);
    expect(planted.length).toBe(0);
  });

  it("drops unknown crop ids", () => {
    const dto = {
      Profile: { PlayerId: "unity1" },
      Tiles: [{ CellX: 3, CellY: 3, Status: 2, PlantedCropId: "crop_not_a_crop" }],
      Inventory: [],
      Storages: [],
    };
    const out = adaptUnityFarmSave(dto);
    expect(Object.values(out.crops).length).toBe(0);
  });

  it("maps a chest storage to a shipping_box object", () => {
    const dto = {
      Profile: { PlayerId: "unity1" },
      Tiles: [],
      Inventory: [],
      Storages: [
        { StorageDataId: "chest_wood", CellX: 10, CellY: 11 },
        { StorageDataId: "safe_box", CellX: 12, CellY: 13 },
      ],
    };
    const out = adaptUnityFarmSave(dto);
    expect(out.objects[String(PLOT_INDEX(10, 11))]).toEqual({ type: "shipping_box" });
    // safe_box is not part of the PlacedObject model → not mapped.
    expect(out.objects[String(PLOT_INDEX(12, 13))]).toBeUndefined();
  });

  it("UNITY_CROP_MAP covers the whitelisted Unity crops", () => {
    expect(UNITY_CROP_MAP.crop_tomato).toBe("tomato");
    expect(UNITY_CROP_MAP.crop_beetroot).toBe("beetroot");
    expect(UNITY_CROP_MAP.crop_parsnip).toBe("parsnip");
  });
});

describe("adaptUnityInventory", () => {
  it("maps + aggregates whitelisted slots, caps qty 999", () => {
    const dto = {
      Profile: { PlayerId: "unity1" },
      Inventory: [
        { SlotIndex: 0, ItemId: "tool_hoe", Quantity: 1 },
        { SlotIndex: 1, ItemId: "seed_tomato", Quantity: 5 },
        { SlotIndex: 2, ItemId: "seed_tomato", Quantity: 7 },
        { SlotIndex: 3, ItemId: "item_wood", Quantity: 2000 }, // cap → 999
        { SlotIndex: 4, ItemId: "crop_tomato_yield", Quantity: 3 },
        { SlotIndex: 5, ItemId: "item_not_a_real_id", Quantity: 99 }, // drop
      ],
      Tiles: [],
      Storages: [],
    };
    const out = adaptUnityInventory(dto);
    const byId = Object.fromEntries(out.map((i) => [i.itemId, i.qty]));
    expect(byId).toMatchObject({ hoe: 1, tomato_seed: 12, wood: 999, tomato: 3 });
    expect(byId["item_not_a_real_id"]).toBeUndefined();
  });

  it("returns [] for empty / junk inventory", () => {
    expect(adaptUnityInventory({ Profile: { PlayerId: "u" }, Inventory: [] })).toEqual([]);
    expect(
      adaptUnityInventory({ Profile: { PlayerId: "u" }, Inventory: [{ SlotIndex: 0, ItemId: "??", Quantity: -5 }] }),
    ).toEqual([]);
  });
});