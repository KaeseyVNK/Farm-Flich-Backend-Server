// POST /api/unity/farm against an in-memory transactional fake of `db`
// (no Postgres): version ordering, idempotent retry, rollback, absolute inventory.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UnityFarmSaveDTO } from "@/lib/game/unity-adapter";

interface State {
  farm: { id: string; version: number; unitySnapshot: unknown } | null;
  inventory: Map<string, number>;
  raidActive: boolean;
  failInventory: boolean;
  farmWrites: number;
}

const fake = vi.hoisted(() => {
  const s = {
    state: null as unknown as State,
    makeTx(st: State) {
      return {
        user: { createMany: async () => ({ count: 0 }) },
        farm: {
          createMany: async () => {
            if (!st.farm) st.farm = { id: "farm-1", version: 0, unitySnapshot: {} };
            return { count: 1 };
          },
          update: async ({ data }: { data: Record<string, unknown> }) => {
            st.farmWrites++;
            if (data.version) st.farm!.version++;
            if ("unitySnapshot" in data) st.farm!.unitySnapshot = JSON.parse(JSON.stringify(data.unitySnapshot));
            return { version: st.farm!.version };
          },
        },
        inventory: {
          upsert: async ({ where, update }: { where: { userId_itemId: { itemId: string } }; update: { qty: number } }) => {
            if (st.failInventory) throw new Error("inventory write failed");
            st.inventory.set(where.userId_itemId.itemId, update.qty);
          },
          updateMany: async ({ where, data }: { where: { itemId: { in: string[] } }; data: { qty: number } }) => {
            for (const id of where.itemId.in) if (st.inventory.has(id)) st.inventory.set(id, data.qty);
          },
        },
        $queryRaw: async (sql: TemplateStringsArray) => {
          const text = sql.join("?");
          if (text.includes('"RaidSession"')) return st.raidActive ? [{ id: "raid-1" }] : [];
          if (text.includes('FROM "Farm"') && text.includes("FOR UPDATE")) {
            return [{ id: st.farm!.id, version: st.farm!.version, unitySnapshot: structuredClone(st.farm!.unitySnapshot) }];
          }
          throw new Error(`unexpected raw query: ${text}`);
        },
      };
    },
  };
  const db = {
    // Commit-on-success: writes go to a draft that is dropped if the callback throws.
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
      const draft = structuredClone(s.state);
      const result = await fn(s.makeTx(draft));
      s.state = draft;
      return result;
    },
  };
  return { s, db };
});

vi.mock("@/lib/db", () => ({ db: fake.db }));

const { POST } = await import("@/app/api/unity/farm/route");

const TOKEN = "test-bridge-token";

function dto(version: number, inventory: [string, number][], extra: Partial<NonNullable<UnityFarmSaveDTO["Profile"]>> = {}): UnityFarmSaveDTO {
  return {
    Profile: { PlayerId: "alice", PlayerName: "Alice", Gold: 100, FarmVersion: version, LastSaveTimestamp: version * 1000, ...extra },
    Tiles: [{ CellX: 5, CellY: 6, Status: 1, PlantedCropId: "" }],
    Inventory: inventory.map(([ItemId, Quantity], SlotIndex) => ({ SlotIndex, ItemId, Quantity })),
    Storages: [],
  };
}

async function post(farm: UnityFarmSaveDTO) {
  const res = await POST(new Request("http://test/api/unity/farm", {
    method: "POST",
    headers: { "x-bridge-token": TOKEN, "content-type": "application/json" },
    body: JSON.stringify({ farmId: "alice", farm }),
  }));
  return { status: res.status, body: await res.json() };
}

const snapshot = () => structuredClone(fake.s.state);

beforeEach(() => {
  process.env.BRIDGE_TOKEN = TOKEN;
  fake.s.state = {
    farm: null,
    inventory: new Map([["gem_shard", 7]]), // non-Unity item: must survive every sync
    raidActive: false,
    failInventory: false,
    farmWrites: 0,
  };
});

describe("POST /api/unity/farm", () => {
  it("creates then applies a newer version with absolute whitelisted inventory", async () => {
    const first = await post(dto(1, [["item_wood", 50], ["item_stone", 20]]));
    expect(first).toEqual({
      status: 200,
      body: { ok: true, version: 1, migratedInventory: [{ itemId: "wood", qty: 50 }, { itemId: "stone", qty: 20 }] },
    });

    const second = await post(dto(2, [["item_wood", 10], ["item_wood", 5]]));
    expect(second).toEqual({ status: 200, body: { ok: true, version: 2, migratedInventory: [{ itemId: "wood", qty: 15 }] } });

    const st = fake.s.state;
    expect(st.inventory.get("wood")).toBe(15); // absolute, not 50 + 15
    expect(st.inventory.get("stone")).toBe(0); // absent Unity item zeroed
    expect(st.inventory.get("gem_shard")).toBe(7); // non-Unity preserved
    expect((st.farm!.unitySnapshot as UnityFarmSaveDTO).Profile!.FarmVersion).toBe(2);
  });

  it("treats an identical versioned retry as success with no writes or version bump", async () => {
    const save = dto(3, [["item_wood", 4]]);
    await post(save);
    // Stored jsonb may reorder keys; equality is structural.
    const { Storages, Inventory, Tiles, Profile } = fake.s.state.farm!.unitySnapshot as UnityFarmSaveDTO;
    fake.s.state.farm!.unitySnapshot = { Storages, Inventory, Tiles, Profile };
    fake.s.state.inventory.set("wood", 99); // would be reset to 4 if the retry wrote
    const before = snapshot();

    const retry = await post(structuredClone(save));
    expect(retry).toEqual({ status: 200, body: { ok: true, version: 1, migratedInventory: [{ itemId: "wood", qty: 4 }] } });
    expect(fake.s.state).toEqual(before);
  });

  it("rejects an equal-version payload with different content (409, no writes)", async () => {
    await post(dto(4, [["item_wood", 4]]));
    const before = snapshot();
    const res = await post(dto(4, [["item_wood", 8]]));
    expect(res).toEqual({ status: 409, body: { ok: false, error: "STALE_UNITY_SNAPSHOT" } });
    expect(fake.s.state).toEqual(before);
  });

  it("rejects an older version (409, no writes)", async () => {
    await post(dto(5, [["item_wood", 4]]));
    const before = snapshot();
    const res = await post(dto(4, [["item_wood", 1]]));
    expect(res.status).toBe(409);
    expect(fake.s.state).toEqual(before);
  });

  it("rolls back everything when a raid is active", async () => {
    await post(dto(1, [["item_wood", 4]]));
    fake.s.state.raidActive = true;
    const before = snapshot();
    const res = await post(dto(2, [["item_wood", 9]]));
    expect(res).toEqual({ status: 409, body: { ok: false, error: "farm locked: raid active" } });
    expect(fake.s.state).toEqual(before);
  });

  it("rolls back the farm + snapshot write when the inventory write fails", async () => {
    await post(dto(1, [["item_wood", 4]]));
    fake.s.state.failInventory = true;
    const before = snapshot();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await post(dto(2, [["item_wood", 9]]));
    expect(res.status).toBe(500);
    expect(fake.s.state).toEqual(before);
    expect(fake.s.state.farm!.version).toBe(1);
  });
});
