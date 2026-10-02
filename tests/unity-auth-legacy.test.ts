import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;

const fake = vi.hoisted(() => {
  const users = new Map<string, Row>();
  const farms = new Map<string, Row>();
  const credentials = new Map<string, Row>();
  const progression = new Map<string, Row>();
  const hooks: { beforeCredentialCreate?: () => void; transactions: number } = { transactions: 0 };
  const conflict = () => Object.assign(new Error("Unique constraint failed"), { code: "P2002" });

  const client = {
    user: {
      findUnique: async ({ where }: { where: { id: string } }) => users.get(where.id) ?? null,
      create: async ({ data }: { data: Row & { id: string } }) => {
        if (users.has(data.id)) throw conflict();
        users.set(data.id, { ...data });
      },
      upsert: async ({ where, create }: { where: { id: string }; create: Row }) => {
        if (!users.has(where.id)) users.set(where.id, { ...create });
      },
    },
    farm: {
      findUnique: async ({ where }: { where: { ownerId: string } }) => farms.get(where.ownerId) ?? null,
      create: async ({ data }: { data: Row & { ownerId: string } }) => {
        if (farms.has(data.ownerId)) throw conflict();
        farms.set(data.ownerId, { id: data.ownerId, ...data });
      },
      upsert: async ({ where, create }: { where: { ownerId: string }; create: Row & { ownerId: string } }) => {
        if (!farms.has(where.ownerId)) farms.set(where.ownerId, { id: create.ownerId, ...create });
      },
    },
    unityCredential: {
      findUnique: async ({ where }: { where: { userId?: string; username?: string } }) =>
        where.userId !== undefined
          ? credentials.get(where.userId) ?? null
          : [...credentials.values()].find(c => c.username === where.username) ?? null,
      create: async ({ data }: { data: Row & { userId: string } }) => {
        hooks.beforeCredentialCreate?.();
        if (credentials.has(data.userId)) throw conflict();
        credentials.set(data.userId, { ...data });
      },
    },
  };

  const db = {
    ...client,
    $transaction: async <T>(fn: (tx: typeof client & { $queryRaw: () => Promise<unknown[]> }) => Promise<T>) => {
      hooks.transactions++;
      const snapshot = [users, farms, credentials].map(m => new Map([...m].map(([k, v]) => [k, structuredClone(v)])));
      try {
        return await fn({ ...client, $queryRaw: async () => [{ locked: "" }] });
      } catch (err) {
        [users, farms, credentials].forEach((m, i) => { m.clear(); snapshot[i].forEach((v, k) => m.set(k, v)); });
        throw err;
      }
    },
  };
  return { users, farms, credentials, progression, hooks, db };
});

vi.mock("@/lib/db", () => ({ db: fake.db }));

import { POST } from "@/app/api/unity/auth/login/route";

function login(username: string, password: string, legacyVerified = false, token = "test-bridge") {
  return POST(new Request("http://localhost/api/unity/auth/login", {
    method: "POST",
    headers: { "x-bridge-token": token },
    body: JSON.stringify({ username, password, ...(legacyVerified ? { legacyVerified: true } : {}) }),
  }));
}

function seedLegacy(id: string) {
  const user = { id, displayName: id, characterSetupRequired: false, characterGender: "female", coins: 4321 };
  const farm = { id: `farm-${id}`, ownerId: id, crops: { "3,4": { cropId: "wheat", stage: 2 } }, gameMeta: { version: 7 } };
  fake.users.set(id, structuredClone(user));
  fake.farms.set(id, structuredClone(farm));
  fake.progression.set(id, { userId: id, level: 12, xp: 900 });
  return { user, farm };
}

function expectNoWrites() {
  expect(fake.users.size).toBe(0);
  expect(fake.farms.size).toBe(0);
  expect(fake.credentials.size).toBe(0);
}

beforeEach(() => {
  fake.users.clear();
  fake.farms.clear();
  fake.credentials.clear();
  fake.progression.clear();
  fake.hooks.beforeCredentialCreate = undefined;
  fake.hooks.transactions = 0;
  process.env.BRIDGE_TOKEN = "test-bridge";
});

describe("Unity credential rollout", () => {
  it("creates a fresh account and requires character setup", async () => {
    const response = await login("newplayer", "secret");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, playerId: "newplayer", message: "Account created" });
    expect(fake.users.get("newplayer")?.characterSetupRequired).toBe(true);
    expect(fake.farms.has("newplayer")).toBe(true);
    expect(fake.credentials.has("newplayer")).toBe(true);
  });

  it.each(["new-player", "o'brien", "john smith", "averylongname_2019"])(
    "rejects unverified registration of %j outside the username rule without writes",
    async username => {
      const response = await login(username, "secret");
      expect(response.status).toBe(400);
      expect((await response.json()).code).toBe("INVALID_USERNAME");
      expect(fake.hooks.transactions).toBe(0);
      expectNoWrites();
    },
  );

  it.each([
    ["wrong token", "nope"],
    ["missing token", ""],
  ])("rejects a legacyVerified claim with %s before any lookup or write", async (_label, token) => {
    const { user, farm } = seedLegacy("o'brien");
    const response = await login("o'brien", "attacker", true, token);
    expect(response.status).toBe(401);
    expect(fake.hooks.transactions).toBe(0);
    expect(fake.credentials.size).toBe(0);
    expect(fake.users.get("o'brien")).toEqual(user);
    expect(fake.farms.get("o'brien")).toEqual(farm);
  });

  it("rejects a legacyVerified claim when BRIDGE_TOKEN is unset", async () => {
    delete process.env.BRIDGE_TOKEN;
    expect((await login("legacy", "secret", true, "")).status).toBe(401);
    expectNoWrites();
  });

  it("does not claim an existing User/Farm without local proof", async () => {
    const { user, farm } = seedLegacy("orphan");
    const response = await login("orphan", "attacker-password");
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("ACCOUNT_RECOVERY_REQUIRED");
    expect(fake.credentials.has("orphan")).toBe(false);
    expect(fake.users.get("orphan")).toEqual(user);
    expect(fake.farms.get("orphan")).toEqual(farm);
  });

  it("rejects a partial existing account without local proof", async () => {
    fake.users.set("partial", { id: "partial", characterSetupRequired: false });
    expect((await login("partial", "attacker-password")).status).toBe(409);
    expect(fake.farms.has("partial")).toBe(false);
    expect(fake.credentials.has("partial")).toBe(false);
  });

  it.each(["legacy", "o'brien", "john smith", "averylongname_2019"])(
    "migrates locally verified legacy player %j without touching farm or progression",
    async id => {
      const { user, farm } = seedLegacy(id);
      const response = await login(id, "old-password", true);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ ok: true, playerId: id, message: "Login success" });
      expect(fake.users.get(id)).toEqual(user);
      expect(fake.farms.get(id)).toEqual(farm);
      expect(fake.progression.get(id)).toEqual({ userId: id, level: 12, xp: 900 });
      expect(fake.credentials.has(id)).toBe(true);
      expect((await login(id, "wrong")).status).toBe(401);
      expect((await login(id, "old-password")).status).toBe(200);
      expect(fake.farms.get(id)).toEqual(farm);
    },
  );

  it.each(["local-only", "o'neil", "mary jane", "legacy_long_name"])(
    "creates cloud rows for verified local-only player %j as an existing player",
    async id => {
      const response = await login(id, "old-password", true);
      expect(response.status).toBe(200);
      expect((await response.json()).message).toBe("Login success");
      expect(fake.users.get(id)?.characterSetupRequired).toBe(false);
      expect(fake.farms.has(id)).toBe(true);
      expect(fake.credentials.has(id)).toBe(true);
    },
  );

  it("normalizes legacy IDs the same way UnityServer does", async () => {
    seedLegacy("john smith");
    const response = await login("  John Smith ", "old-password", true);
    expect(response.status).toBe(200);
    expect((await response.json()).playerId).toBe("john smith");
  });

  it("rejects a registration race instead of claiming a newly created credential", async () => {
    const transaction = fake.db.$transaction;
    fake.db.$transaction = (async fn => {
      fake.credentials.set("racing", { userId: "racing", salt: "aa", hash: "bb" });
      return transaction(fn);
    }) as typeof transaction;
    try {
      const response = await login("racing", "attacker-password");
      expect(response.status).toBe(409);
      expect((await response.json()).code).toBe("ACCOUNT_ALREADY_EXISTS");
      expect(fake.users.has("racing")).toBe(false);
      expect(fake.farms.has("racing")).toBe(false);
    } finally {
      fake.db.$transaction = transaction;
    }
  });

  it("rolls back User/Farm when the credential write conflicts", async () => {
    fake.hooks.beforeCredentialCreate = () => { throw Object.assign(new Error("dup"), { code: "P2002" }); };
    const response = await login("o'brien", "old-password", true);
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("ACCOUNT_ALREADY_EXISTS");
    expectNoWrites();
  });

  it("rolls back a fresh registration on an unexpected failure", async () => {
    fake.hooks.beforeCredentialCreate = () => { throw new Error("db down"); };
    vi.spyOn(console, "error").mockImplementationOnce(() => {});
    expect((await login("newplayer", "secret")).status).toBe(500);
    expectNoWrites();
  });

  it("keeps existing password and Google-only credentials authoritative", async () => {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.scryptSync("correct", Buffer.from(salt, "hex"), 64).toString("hex");
    fake.credentials.set("password", { userId: "password", salt, hash });
    fake.credentials.set("google", { userId: "google", salt: null, hash: null, email: "google@example.com" });
    expect((await login("password", "correct", true)).status).toBe(200);
    expect((await login("password", "wrong", true)).status).toBe(401);
    expect((await login("google", "anything", true)).status).toBe(401);
    expect(fake.hooks.transactions).toBe(0);
  });
});
