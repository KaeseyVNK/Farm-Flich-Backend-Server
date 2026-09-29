// Unity bridge login (UnityCredential): register + verify + reject.
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { cleanDb } from "../helpers";

import { POST } from "@/app/api/unity/auth/login/route";

function authRequest(body: Record<string, unknown>, token?: string) {
  const req = {
    headers: new Headers({ "x-bridge-token": token ?? process.env.BRIDGE_TOKEN ?? "" }),
    json: async () => body,
  } as unknown as Request;
  return POST(req);
}

beforeEach(async () => {
  await cleanDb();
  process.env.BRIDGE_TOKEN = "test-bridge-secret";
});

describe("POST /api/unity/auth/login", () => {
  it("rejects missing/wrong bridge token", async () => {
    const r = await authRequest({ username: "u", password: "secret1" }, "wrong");
    expect(r.status).toBe(401);
  });

  it("creates UnityCredential + User + Farm on first login", async () => {
    const r = await authRequest({ username: "alice", password: "secret1" });
    expect(r.status).toBe(200);
    const body = (await r.json()) as { ok: boolean; playerId: string; message: string };
    expect(body.ok).toBe(true);
    expect(body.playerId).toBe("alice");
    expect(body.message).toBe("Account created");

    const cred = await db.unityCredential.findUnique({ where: { userId: "alice" } });
    expect(cred).not.toBeNull();
    expect(cred?.salt.length).toBe(32); // 16 bytes hex
    expect(cred?.hash.length).toBe(128); // 64 bytes hex
    const user = await db.user.findUnique({ where: { id: "alice" } });
    expect(user).not.toBeNull();
    const farm = await db.farm.findUnique({ where: { ownerId: "alice" } });
    expect(farm).not.toBeNull();
  });

  it("verifies correct password on re-login", async () => {
    await authRequest({ username: "bob", password: "secret1" });
    const r = await authRequest({ username: "bob", password: "secret1" });
    expect(r.status).toBe(200);
    const body = (await r.json()) as { message: string };
    expect(body.message).toBe("Login success");
  });

  it("rejects wrong password with 401", async () => {
    await authRequest({ username: "bob", password: "secret1" });
    const r = await authRequest({ username: "bob", password: "wrongpw" });
    expect(r.status).toBe(401);
  });

  it("rejects short password / missing username", async () => {
    const short = await authRequest({ username: "c", password: "abc" });
    expect(short.status).toBe(400);
    const noUser = await authRequest({ password: "secret1" });
    expect(noUser.status).toBe(400);
  });
});