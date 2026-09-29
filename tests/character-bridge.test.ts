import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { GET, POST } from "@/app/api/unity/character/route";
import { POST as passwordLogin } from "@/app/api/unity/auth/login/route";

const character = { gender: "female", skinIndex: 2, clothesId: "Farm/Green", eyesId: "Female/Blue", hairId: "Fawn/Black", accId: "" };

function request(method: "GET" | "POST", playerId: string, body?: unknown, token = process.env.BRIDGE_TOKEN) {
  return new Request(`http://localhost/api/unity/character?playerId=${playerId}`, {
    method, headers: { "x-bridge-token": token ?? "", "Content-Type": "application/json" },
    ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
  });
}

describe("Unity character bridge", () => {
  it("saves once, accepts an identical retry, and rejects conflicting or invalid writes", async () => {
    const playerId = `character-test-${randomUUID()}`;
    await db.user.create({ data: { id: playerId, characterSetupRequired: true } });
    try {
      expect((await GET(request("GET", playerId, undefined, "wrong"))).status).toBe(401);
      const pending = await GET(request("GET", playerId));
      expect((await pending.json()).needsCharacterSetup).toBe(true);
      const invalid = await POST(request("POST", playerId, { playerId, character: { ...character, eyesId: "Male/Blue" } }));
      expect(invalid.status).toBe(400);
      expect((await db.user.findUniqueOrThrow({ where: { id: playerId } })).characterSetupRequired).toBe(true);
      const saved = await POST(request("POST", playerId, { playerId, character }));
      expect(saved.status).toBe(200);
      expect((await GET(request("GET", playerId))).status).toBe(200);
      expect((await POST(request("POST", playerId, { playerId, character }))).status).toBe(200);
      expect((await POST(request("POST", playerId, { playerId, character: { ...character, skinIndex: 3 } }))).status).toBe(409);
      const row = await db.user.findUniqueOrThrow({ where: { id: playerId } });
      expect(row.characterSetupRequired).toBe(false);
      expect(row.characterGender).toBe("female");
      expect(row.characterAppearance).toEqual({ skinIndex: 2, clothesId: "Farm/Green", eyesId: "Female/Blue", hairId: "Fawn/Black", accId: "" });
    } finally {
      await db.user.delete({ where: { id: playerId } });
    }
  });

  it("marks a newly registered password account pending while legacy users stay complete", async () => {
    const playerId = `character-login-${randomUUID()}`;
    const legacyId = `character-legacy-${randomUUID()}`;
    await db.user.create({ data: { id: legacyId } });
    try {
      const legacy = await GET(request("GET", legacyId));
      expect((await legacy.json()).needsCharacterSetup).toBe(false);
      const login = await passwordLogin(request("POST", playerId, { username: playerId, password: "test-secret" }));
      expect(login.status).toBe(200);
      const pending = await GET(request("GET", playerId));
      expect((await pending.json()).needsCharacterSetup).toBe(true);
    } finally {
      await db.user.deleteMany({ where: { id: { in: [playerId, legacyId] } } });
    }
  });
});
