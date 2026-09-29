// Unity bridge: FarmSaveDTO → adapter → farm-service + inventory (end-to-end,
// real docker postgres). Mirrors src/app/api/unity/farm/route.ts logic.
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { cleanDb } from "../helpers";
import { saveFarm, loadFarm } from "@/lib/game/farm-service";
import { updateInventory, getInventoryQty } from "@/lib/game/wallet-service";
import {
  adaptUnityFarmSave,
  adaptUnityInventory,
  adaptUnityFarmPull,
  type UnityFarmSaveDTO,
} from "@/lib/game/unity-adapter";

const UNITY_USER = "unity_playtest";
const TILE = (x: number, y: number) => y * 60 + x;

/** Same create path as the bridge route: User + Farm upsert then save. */
async function bridgeApply(farmId: string, dto: UnityFarmSaveDTO) {
  await db.user.upsert({
    where: { id: farmId },
    create: { id: farmId, displayName: dto.Profile?.PlayerName || farmId },
    update: {},
  });
  await db.farm.upsert({
    where: { ownerId: farmId },
    create: {
      ownerId: farmId,
      terrain: new Array(3600).fill(0),
      crops: {},
      objects: {},
      forage: {},
      shippingBoxes: {},
      gameMeta: {},
    },
    update: {},
  });
  const version = await saveFarm(farmId, adaptUnityFarmSave(dto));
  // Mirror route: store full Unity DTO for lossless pull-back.
  await db.farm.update({
    where: { ownerId: farmId },
    data: { unitySnapshot: dto as unknown as import("@prisma/client").Prisma.InputJsonValue },
  });
  const migrated: { itemId: string; qty: number }[] = [];
  for (const inv of adaptUnityInventory(dto)) {
    const r = await updateInventory(farmId, inv.itemId, inv.qty);
    migrated.push({ itemId: inv.itemId, qty: r.newQty });
  }
  return { version, migrated };
}

const DTO: UnityFarmSaveDTO = {
  Profile: { PlayerId: UNITY_USER, PlayerName: "Unity Tester", Gold: 500 },
  Tiles: [
    { CellX: 5, CellY: 6, Status: 3, PlantedCropId: "crop_tomato", CropStageIndex: 2 },
    { CellX: 9, CellY: 9, Status: 1, PlantedCropId: "crop_beetroot", CropStageIndex: 1 },
  ],
  Inventory: [
    { SlotIndex: 0, ItemId: "tool_hoe", Quantity: 1 },
    { SlotIndex: 1, ItemId: "seed_tomato", Quantity: 5 },
    { SlotIndex: 2, ItemId: "item_wood", Quantity: 2000 }, // capped 999
  ],
  Storages: [{ StorageDataId: "chest_wood", CellX: 10, CellY: 11 }],
};

describe("Unity bridge → farm-filch DB (end-to-end)", () => {
  beforeEach(async () => {
    await cleanDb();
  });

  it("persists adapted terrain/crops/objects + version bump", async () => {
    const { version } = await bridgeApply(UNITY_USER, DTO);
    expect(version).toBe(1);

    const farm = await loadFarm(UNITY_USER);
    expect(farm?.terrain[TILE(5, 6)]).toBe(5); // T.TILLED_WET
    expect(farm?.terrain[TILE(9, 9)]).toBe(4); // T.TILLED
    expect(farm?.crops).toMatchObject({
      [String(TILE(5, 6))]: { cropId: "tomato", stage: 2, watered: true },
      [String(TILE(9, 9))]: { cropId: "beetroot", stage: 1 },
    });
    expect(farm?.objects).toMatchObject({ [String(TILE(10, 11))]: { type: "shipping_box" } });
    expect(farm?.gameMeta).toBeDefined();

    // second save bumps version (LWW)
    const { version: v2 } = await bridgeApply(UNITY_USER, DTO);
    expect(v2).toBe(2);
  });

  it("writes whitelisted inventory (capped 999), gold NOT via farm", async () => {
    const { migrated } = await bridgeApply(UNITY_USER, DTO);
    const byId = Object.fromEntries(migrated.map((i) => [i.itemId, i.qty]));
    expect(byId).toMatchObject({ hoe: 1, tomato_seed: 5, wood: 999 });

    const wood = await getInventoryQty(UNITY_USER, "wood");
    expect(wood).toBe(999);

    // gold stays on User (server-authoritative), not lifted from Unity Profile.
    const u = await db.user.findUnique({ where: { id: UNITY_USER }, select: { gold: true } });
    expect(u?.gold).toBe(500);
  });

  it("rejects save while a raid is active (lock-check via farm-service)", async () => {
    await db.user.createMany({
      data: [{ id: UNITY_USER }, { id: "other_thief" }],
    });
    const f = await db.farm.create({
      data: { ownerId: UNITY_USER, terrain: new Array(3600).fill(0) },
    });
    await db.raidSession.create({
      data: { farmId: f.id, ownerId: UNITY_USER, thiefId: "other_thief", status: "active" },
    });
    await expect(bridgeApply(UNITY_USER, DTO)).rejects.toThrow(/locked: raid active/);
  });

  it("stores full unitySnapshot for lossless pull-back", async () => {
    await bridgeApply(UNITY_USER, DTO);
    const farm = await loadFarm(UNITY_USER);
    const snap = farm?.unitySnapshot as unknown as UnityFarmSaveDTO | undefined;
    expect(snap?.Profile?.Gold).toBe(500);
    expect(snap?.Tiles?.length).toBe(2);
    expect(snap?.Tiles?.[0]).toMatchObject({ PlantedCropId: "crop_tomato", Status: 3 });
    expect(snap?.Inventory?.length).toBe(3);
  });

  it("adaptUnityFarmPull builds a Unity DTO from web rows (fallback, no snapshot)", async () => {
    const dto = adaptUnityFarmPull(
      {
        ownerId: "web_only",
        displayName: "Web Guy",
        gold: 1200,
        defenseXp: 30,
        terrain: Array.from({ length: 3600 }, () => 0),
      },
      [{ itemId: "wood", qty: 10 }, { itemId: "tomato_seed", qty: 3 }, { itemId: "not_a_thing", qty: 9 }],
    );
    // terrain all 0 (GRASS) → no Tiles
    expect(dto.Tiles?.length ?? 0).toBe(0);
    expect(dto.Profile).toMatchObject({ PlayerId: "web_only", PlayerName: "Web Guy", Gold: 1200, DefenseXP: 30 });
    // whitelisted inventory only, reversed to Unity ids
    const ids = (dto.Inventory ?? []).map((i) => i.ItemId);
    expect(ids).toContain("item_wood");
    expect(ids).toContain("seed_tomato");
    expect(ids).not.toContain("not_a_thing");
  });
});