// Unity bridge end-to-end against real Postgres: drives the actual
// src/app/api/unity/farm/route.ts handlers. All rows use the `bridge_it_` prefix
// and are removed per test, so no global cleanDb is needed.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { GET, POST } from "@/app/api/unity/farm/route";
import {
  adaptUnityFarmSave,
  adaptUnityInventory,
  adaptUnityFarmPull,
  type UnityFarmSaveDTO,
} from "@/lib/game/unity-adapter";

const P = "bridge_it_";
const ID = `${P}alice`;
const TOKEN = "bridge-it-token";
const TILE = (x: number, y: number) => y * 60 + x;
const CONSTRAINT = "bridge_it_reject_stone";
const FARMS_PATH = path.resolve(import.meta.dirname, "../../../.playtest-data/vps-unity-farms.json");

async function post(farmId: string, farm: UnityFarmSaveDTO) {
  const res = await POST(new Request("http://bridge.test/api/unity/farm", {
    method: "POST",
    headers: { "x-bridge-token": TOKEN, "content-type": "application/json" },
    body: JSON.stringify({ farmId, farm }),
  }));
  return { status: res.status, body: await res.json() };
}

async function get(farmId: string) {
  const res = await GET(new Request(`http://bridge.test/api/unity/farm?farmId=${farmId}`, {
    headers: { "x-bridge-token": TOKEN },
  }));
  return { status: res.status, body: await res.json() };
}

async function state(farmId: string) {
  const farm = await db.farm.findUnique({ where: { ownerId: farmId } });
  const inventory = await db.inventory.findMany({
    where: { userId: farmId },
    orderBy: { itemId: "asc" },
    select: { itemId: true, qty: true },
  });
  return { farm, inventory: Object.fromEntries(inventory.map((i) => [i.itemId, i.qty])) };
}

const snap = async (farmId: string) => (await state(farmId)).farm?.unitySnapshot as unknown as UnityFarmSaveDTO;

function dto(
  version: number | undefined,
  inventory: [string, number][],
  timestamp = (version ?? 1) * 1000,
  playerId = ID,
): UnityFarmSaveDTO {
  const stage = Math.min(version ?? 1, 6);
  return {
    Profile: {
      PlayerId: playerId,
      PlayerName: "Bridge IT",
      Gold: 500,
      UnlockedRowCount: 4,
      LastSaveTimestamp: timestamp,
      ...(version === undefined ? {} : { FarmVersion: version }),
    },
    Tiles: [
      { CellX: 5, CellY: 6, Status: 3, PlantedCropId: "crop_tomato", CropStageIndex: stage },
      { CellX: 9, CellY: 9 + stage, Status: 1, PlantedCropId: "", CropStageIndex: 0 },
    ],
    Inventory: inventory.map(([ItemId, Quantity], SlotIndex) => ({ SlotIndex, ItemId, Quantity })),
    Storages: [{ StorageDataId: "chest_wood", CellX: 10, CellY: 11, Items: [] }],
  };
}

async function cleanup() {
  await db.raidSession.deleteMany({
    where: { OR: [{ ownerId: { startsWith: P } }, { thiefId: { startsWith: P } }] },
  });
  await db.user.deleteMany({ where: { id: { startsWith: P } } });
}

const dropConstraint = () =>
  db.$executeRawUnsafe(`ALTER TABLE "Inventory" DROP CONSTRAINT IF EXISTS ${CONSTRAINT}`);

beforeAll(async () => {
  process.env.BRIDGE_TOKEN = TOKEN;
  await dropConstraint();
});
beforeEach(async () => {
  vi.restoreAllMocks();
  await cleanup();
});
afterAll(async () => {
  await dropConstraint();
  await cleanup();
});

describe("POST /api/unity/farm (real Postgres)", () => {
  it("persists snapshot, derived web farm and absolute whitelisted inventory", async () => {
    const save = dto(1, [["tool_hoe", 1], ["seed_tomato", 5], ["item_wood", 2000]]);
    expect(await post(ID, save)).toEqual({
      status: 200,
      body: { ok: true, version: 1, migratedInventory: [{ itemId: "hoe", qty: 1 }, { itemId: "tomato_seed", qty: 5 }, { itemId: "wood", qty: 999 }] },
    });

    const { farm, inventory } = await state(ID);
    expect(farm?.version).toBe(1);
    expect((farm?.terrain as number[])[TILE(5, 6)]).toBe(5); // T.TILLED_WET
    expect((farm?.terrain as number[])[TILE(9, 10)]).toBe(4); // T.TILLED
    expect(farm?.crops).toMatchObject({ [String(TILE(5, 6))]: { cropId: "tomato", stage: 1, watered: true } });
    expect(farm?.objects).toMatchObject({ [String(TILE(10, 11))]: { type: "shipping_box" } });
    expect(inventory).toEqual({ hoe: 1, tomato_seed: 5, wood: 999 });

    const pulled = await get(ID);
    expect(pulled.status).toBe(200);
    expect(pulled.body.hasUnitySnapshot).toBe(true);
    expect(pulled.body.farm).toStrictEqual(save);
  });

  it("stored JSONB is key-reordered yet structurally equal; identical versioned retry changes nothing", async () => {
    const save = dto(3, [["item_wood", 4]]);
    await post(ID, save);

    const [{ text }] = await db.$queryRaw<{ text: string }[]>`
      SELECT "unitySnapshot"::text AS text FROM "Farm" WHERE "ownerId" = ${ID}`;
    const stored = JSON.parse(text);
    expect(Object.keys(stored)).not.toEqual(Object.keys(save));
    expect(Object.keys(stored.Profile)).not.toEqual(Object.keys(save.Profile!));
    expect(isDeepStrictEqual(stored, save)).toBe(true);

    await db.inventory.update({ where: { userId_itemId: { userId: ID, itemId: "wood" } }, data: { qty: 99 } });
    const before = await state(ID);
    const retry = await post(ID, structuredClone(save));
    expect(retry).toEqual({ status: 200, body: { ok: true, version: 1, migratedInventory: [{ itemId: "wood", qty: 4 }] } });
    expect(await state(ID)).toEqual(before);
  });

  it.each([
    ["equal version, different content", 4],
    ["older version", 3],
  ])("%s → 409 and snapshot, derived web farm and inventory are preserved", async (_label, version) => {
    await post(ID, dto(4, [["item_wood", 4], ["item_stone", 2]]));
    const before = await state(ID);
    const res = await post(ID, dto(version, [["item_wood", 8]]));
    expect(res).toEqual({ status: 409, body: { ok: false, error: "STALE_UNITY_SNAPSHOT" } });
    expect(await state(ID)).toEqual(before);
  });

  it("newer version: absolute qty, omitted whitelisted items zeroed, non-Unity items preserved", async () => {
    await post(ID, dto(1, [["item_wood", 50], ["item_stone", 20]]));
    await db.inventory.create({ data: { userId: ID, itemId: "gem_shard", qty: 7 } });

    const res = await post(ID, dto(2, [["item_wood", 10], ["item_wood", 5]]));
    expect(res).toEqual({ status: 200, body: { ok: true, version: 2, migratedInventory: [{ itemId: "wood", qty: 15 }] } });
    expect((await state(ID)).inventory).toEqual({ gem_shard: 7, stone: 0, wood: 15 });
    expect((await snap(ID)).Profile?.FarmVersion).toBe(2);
  });

  it("concurrent pushes for one farm serialize and the highest version wins", async () => {
    const versions = [3, 7, 1, 8, 5, 2, 6, 4];
    const results = await Promise.all(versions.map((v) => post(ID, dto(v, [["item_wood", v]]))));

    expect(results.every((r) => r.status === 200 || r.status === 409)).toBe(true);
    expect(results[versions.indexOf(8)].status).toBe(200);
    const applied = results.filter((r) => r.status === 200).map((r) => r.body.version as number).sort((a, b) => a - b);
    expect(applied).toEqual(applied.map((_, i) => i + 1)); // one row-version bump per applied push

    const { farm, inventory } = await state(ID);
    expect(farm?.version).toBe(applied.length);
    expect(farm?.unitySnapshot).toStrictEqual(dto(8, [["item_wood", 8]]));
    expect((farm?.crops as Record<string, { stage: number }>)[String(TILE(5, 6))].stage).toBe(6);
    expect(inventory).toEqual({ wood: 8 });
  });

  it("rolls back farm, snapshot and earlier inventory writes on an injected inventory constraint failure", async () => {
    await post(ID, dto(1, [["item_wood", 4]]));
    const before = await state(ID);
    vi.spyOn(console, "error").mockImplementation(() => {});
    await db.$executeRawUnsafe(
      `ALTER TABLE "Inventory" ADD CONSTRAINT ${CONSTRAINT} CHECK (NOT (starts_with("userId", '${P}') AND "itemId" = 'stone')) NOT VALID`,
    );
    try {
      const res = await post(ID, dto(2, [["item_wood", 9], ["item_stone", 3]]));
      expect(res.status).toBe(500);
      expect(await state(ID)).toEqual(before);
    } finally {
      await dropConstraint();
    }
    const [{ n }] = await db.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM pg_constraint WHERE conname = ${CONSTRAINT}`;
    expect(n).toBe(BigInt(0));
  });

  it("rolls back everything while a raid is active", async () => {
    await post(ID, dto(1, [["item_wood", 4]]));
    const before = await state(ID);
    await db.user.create({ data: { id: `${P}thief` } });
    await db.raidSession.create({
      data: { farmId: before.farm!.id, ownerId: ID, thiefId: `${P}thief`, status: "active" },
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await post(ID, dto(2, [["item_wood", 9]]));
    expect(res).toEqual({ status: 409, body: { ok: false, error: "farm locked: raid active" } });
    expect(await state(ID)).toEqual(before);
  });

  it("legacy timestamp ordering and the legacy → versioned transition", async () => {
    const legacyTs = async (ts: number, wood: number) => (await post(ID, dto(undefined, [["item_wood", wood]], ts))).status;

    expect(await legacyTs(1000, 1)).toBe(200); // first legacy copy
    expect(await legacyTs(2000, 2)).toBe(200); // newer timestamp replaces
    expect(await legacyTs(1500, 3)).toBe(409); // older timestamp rejected
    expect((await state(ID)).inventory).toEqual({ wood: 2 });

    // FarmVersion 0 is treated as versionless.
    expect((await post(ID, dto(0, [["item_wood", 4]], 1800))).status).toBe(409);

    // First versioned copy beats a legacy copy even with an older timestamp.
    expect((await post(ID, dto(1, [["item_wood", 5]], 500))).status).toBe(200);
    expect((await snap(ID)).Profile?.FarmVersion).toBe(1);

    // Once versioned, a versionless push never replaces it, however new.
    const before = await state(ID);
    expect(await legacyTs(9_999_999, 6)).toBe(409);
    expect(await state(ID)).toEqual(before);
    expect(before.inventory).toEqual({ wood: 5 });
  });
});

describe.skipIf(!existsSync(FARMS_PATH))("replay of all VPS Unity farm copies under synthetic IDs", () => {
  it("preserves every snapshot field except identity/version, all four bag rows, derived farm and inventory", async () => {
    const farms = Object.values(JSON.parse(readFileSync(FARMS_PATH, "utf8")).farms) as UnityFarmSaveDTO[];
    expect(farms).toHaveLength(59);

    for (const [i, original] of farms.entries()) {
      const id = `${P}replay_${String(i).padStart(2, "0")}`;
      const save: UnityFarmSaveDTO = {
        ...structuredClone(original),
        Profile: { ...structuredClone(original.Profile), PlayerId: id, PlayerName: `Replay ${i}`, FarmVersion: 1 },
      };
      expect(await post(id, save), id).toMatchObject({ status: 200, body: { ok: true, version: 1 } });

      const { farm, inventory } = await state(id);
      const stored = farm?.unitySnapshot as unknown as UnityFarmSaveDTO;
      expect(stored, id).toStrictEqual(save);
      const { PlayerId: _a, PlayerName: _b, FarmVersion: _c, ...restStored } = stored.Profile!;
      const { PlayerId: _d, PlayerName: _e, FarmVersion: _f, ...restOriginal } = original.Profile!;
      expect(restStored, id).toStrictEqual(restOriginal);
      for (const key of Object.keys(original) as (keyof UnityFarmSaveDTO)[]) {
        if (key !== "Profile") expect(stored[key], `${id}.${key}`).toStrictEqual(original[key]);
      }
      expect(stored.Profile?.UnlockedRowCount, id).toBe(4);

      expect(farm?.terrain, id).toEqual(adaptUnityFarmSave(save).terrain);
      expect(inventory, id).toEqual(Object.fromEntries(adaptUnityInventory(save).map((r) => [r.itemId, r.qty])));
      expect((await get(id)).body.farm, id).toStrictEqual(save);

      // Identical retry of real-world JSON (jsonb key order differs) is a no-op.
      const before = await state(id);
      expect((await post(id, structuredClone(save))).body.version, id).toBe(1);
      expect(await state(id), id).toEqual(before);
    }
  });
});

describe("adaptUnityFarmPull (fallback, no snapshot)", () => {
  it("builds a Unity DTO from web rows", () => {
    const pulled = adaptUnityFarmPull(
      { ownerId: "web_only", displayName: "Web Guy", gold: 1200, defenseXp: 30, terrain: Array.from({ length: 3600 }, () => 0) },
      [{ itemId: "wood", qty: 10 }, { itemId: "tomato_seed", qty: 3 }, { itemId: "not_a_thing", qty: 9 }],
    );
    expect(pulled.Tiles?.length ?? 0).toBe(0);
    expect(pulled.Profile).toMatchObject({ PlayerId: "web_only", PlayerName: "Web Guy", Gold: 1200, DefenseXP: 30 });
    const ids = (pulled.Inventory ?? []).map((i) => i.ItemId);
    expect(ids).toContain("item_wood");
    expect(ids).toContain("seed_tomato");
    expect(ids).not.toContain("not_a_thing");
  });
});
