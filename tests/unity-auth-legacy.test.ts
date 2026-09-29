import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => {
  const users = new Map<string, { id: string; characterSetupRequired: boolean }>();
  const farms = new Map<string, { id: string; ownerId: string; marker?: string }>();
  const credentials = new Map<string, { userId: string; salt: string | null; hash: string | null; email?: string | null }>();
  const db = {
    user: {
      findUnique: async ({ where }: { where: { id: string } }) => users.get(where.id) ?? null,
      create: ({ data }: { data: { id: string; characterSetupRequired: boolean } }) => () => {
        if (users.has(data.id)) throw { code: "P2002" };
        users.set(data.id, data);
      },
      upsert: ({ where, create }: { where: { id: string }; create: { id: string; characterSetupRequired: boolean } }) => () => {
        if (!users.has(where.id)) users.set(where.id, create);
      },
    },
    farm: {
      findUnique: async ({ where }: { where: { ownerId: string } }) => farms.get(where.ownerId) ?? null,
      create: ({ data }: { data: { ownerId: string } }) => () => {
        if (farms.has(data.ownerId)) throw { code: "P2002" };
        farms.set(data.ownerId, { id: data.ownerId, ownerId: data.ownerId });
      },
      upsert: ({ where, create }: { where: { ownerId: string }; create: { ownerId: string } }) => () => {
        if (!farms.has(where.ownerId)) farms.set(where.ownerId, { id: create.ownerId, ownerId: create.ownerId });
      },
    },
    unityCredential: {
      findUnique: async ({ where }: { where: { userId: string } }) => credentials.get(where.userId) ?? null,
      create: ({ data }: { data: { userId: string; salt: string; hash: string } }) => () => {
        if (credentials.has(data.userId)) throw { code: "P2002" };
        credentials.set(data.userId, data);
      },
    },
    $transaction: async (operations: Array<() => void>) => {
      for (const operation of operations) operation();
    },
  };
  return { users, farms, credentials, db };
});

vi.mock("@/lib/db", () => ({ db: fake.db }));

import { POST } from "@/app/api/unity/auth/login/route";

function login(username: string, password: string, legacyVerified = false) {
  return POST(new Request("http://localhost/api/unity/auth/login", {
    method: "POST",
    headers: { "x-bridge-token": "test-bridge" },
    body: JSON.stringify({ username, password, ...(legacyVerified ? { legacyVerified: true } : {}) }),
  }));
}

beforeEach(() => {
  fake.users.clear();
  fake.farms.clear();
  fake.credentials.clear();
  process.env.BRIDGE_TOKEN = "test-bridge";
});

describe("Unity credential rollout", () => {
  it("creates a fresh account and requires character setup", async () => {
    const response = await login("new-player", "secret");
    expect(response.status).toBe(200);
    expect((await response.json()).message).toBe("Account created");
    expect(fake.users.get("new-player")?.characterSetupRequired).toBe(true);
    expect(fake.farms.has("new-player")).toBe(true);
    expect(fake.credentials.has("new-player")).toBe(true);
  });

  it("does not claim an existing User/Farm without local proof", async () => {
    fake.users.set("orphan", { id: "orphan", characterSetupRequired: false });
    fake.farms.set("orphan", { id: "orphan", ownerId: "orphan", marker: "preserve" });
    const response = await login("orphan", "attacker-password");
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("ACCOUNT_RECOVERY_REQUIRED");
    expect(fake.credentials.has("orphan")).toBe(false);
    expect(fake.farms.get("orphan")?.marker).toBe("preserve");
  });

  it("migrates a locally verified legacy player without replacing the farm", async () => {
    fake.users.set("legacy", { id: "legacy", characterSetupRequired: false });
    fake.farms.set("legacy", { id: "legacy", ownerId: "legacy", marker: "preserve" });
    const response = await login("legacy", "old-password", true);
    expect(response.status).toBe(200);
    expect((await response.json()).message).toBe("Login success");
    expect(fake.farms.get("legacy")?.marker).toBe("preserve");
    expect(fake.users.get("legacy")?.characterSetupRequired).toBe(false);
    expect(fake.credentials.has("legacy")).toBe(true);
    expect((await login("legacy", "wrong")).status).toBe(401);
    expect((await login("legacy", "old-password")).status).toBe(200);
  });

  it("migrates a local-only account as an existing player", async () => {
    const response = await login("local-only", "old-password", true);
    expect(response.status).toBe(200);
    expect((await response.json()).message).toBe("Login success");
    expect(fake.users.get("local-only")?.characterSetupRequired).toBe(false);
  });

  it("rejects a partial existing account without local proof", async () => {
    fake.users.set("partial", { id: "partial", characterSetupRequired: false });
    expect((await login("partial", "attacker-password")).status).toBe(409);
    expect(fake.farms.has("partial")).toBe(false);
    expect(fake.credentials.has("partial")).toBe(false);
  });

  it("rejects a registration race instead of claiming a newly created user", async () => {
    const transaction = fake.db.$transaction;
    fake.db.$transaction = async operations => {
      fake.users.set("racing", { id: "racing", characterSetupRequired: false });
      return transaction(operations);
    };
    try {
      const response = await login("racing", "attacker-password");
      expect(response.status).toBe(409);
      expect((await response.json()).code).toBe("ACCOUNT_ALREADY_EXISTS");
      expect(fake.credentials.has("racing")).toBe(false);
    } finally {
      fake.db.$transaction = transaction;
    }
  });

  it("keeps existing password and Google-only credentials authoritative", async () => {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.scryptSync("correct", Buffer.from(salt, "hex"), 64).toString("hex");
    fake.credentials.set("password", { userId: "password", salt, hash });
    fake.credentials.set("google", { userId: "google", salt: null, hash: null, email: "google@example.com" });
    expect((await login("password", "correct", true)).status).toBe(200);
    expect((await login("password", "wrong", true)).status).toBe(401);
    expect((await login("google", "anything", true)).status).toBe(401);
  });
});
