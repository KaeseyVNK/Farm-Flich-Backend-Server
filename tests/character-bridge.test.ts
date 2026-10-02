import { beforeAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
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
  beforeAll(() => { process.env.BRIDGE_TOKEN = "test-character-bridge"; });

  it("saves once, accepts an identical retry, and rejects conflicting or invalid writes", async () => {
    const playerId = `character-test-${randomUUID()}`;
    await db.user.create({ data: { id: playerId, characterSetupRequired: true } });
    try {
      expect((await GET(request("GET", playerId, undefined, "wrong"))).status).toBe(401);
      const pending = await GET(request("GET", playerId));
      expect(await pending.json()).toEqual({ ok: true, needsCharacterSetup: true, canChooseCharacter: true, character: null });
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

  it("lets an old account choose once and fills a configured user's missing character from a legacy outfit", async () => {
    const oldId = `character-old-choice-${randomUUID()}`;
    const raceId = `character-old-race-${randomUUID()}`;
    const legacyId = `character-legacy-fill-${randomUUID()}`;
    const pendingId = `character-legacy-pending-${randomUUID()}`;
    const outfit = { ...character, hairId: "Josh/Brown", accId: "Beard/Brown" };
    await db.user.createMany({ data: [{ id: oldId }, { id: raceId }, { id: legacyId }, { id: pendingId, characterSetupRequired: true }] });
    try {
      expect(await (await GET(request("GET", oldId))).json()).toEqual({ ok: true, needsCharacterSetup: false, canChooseCharacter: true, character: null });
      expect((await POST(request("POST", oldId, { playerId: oldId, character }))).status).toBe(200);
      expect((await POST(request("POST", oldId, { playerId: oldId, character: { ...character, skinIndex: 3 } }))).status).toBe(409);
      const raceChoices = [{ ...character, skinIndex: 1 }, { ...character, skinIndex: 4 }];
      const raceResults = await Promise.all(raceChoices.map(choice => POST(request("POST", raceId, { playerId: raceId, character: choice }))));
      expect(raceResults.map(result => result.status).sort()).toEqual([200, 409]);
      const storedRace = (await db.user.findUniqueOrThrow({ where: { id: raceId } })).characterAppearance;
      expect(raceChoices.map(({ gender, ...appearance }) => appearance)).toContainEqual(storedRace);
      expect((await POST(request("POST", pendingId, { playerId: pendingId, character, legacy: true }))).status).toBe(409);
      expect((await db.user.findUniqueOrThrow({ where: { id: pendingId } })).characterSetupRequired).toBe(true);
      const filled = await POST(request("POST", legacyId, { playerId: legacyId, character: outfit, legacy: true }));
      expect(filled.status).toBe(200);
      expect(await (await GET(request("GET", legacyId))).json()).toEqual({ ok: true, needsCharacterSetup: false, canChooseCharacter: false, character: outfit });
      expect((await POST(request("POST", legacyId, { playerId: legacyId, character: outfit, legacy: true }))).status).toBe(200);
      expect((await POST(request("POST", legacyId, { playerId: legacyId, character, legacy: true }))).status).toBe(409);
      const row = await db.user.findUniqueOrThrow({ where: { id: legacyId } });
      expect(row.characterSetupRequired).toBe(false);
      expect(row.characterAppearance).toEqual({ skinIndex: 2, clothesId: "Farm/Green", eyesId: "Female/Blue", hairId: "Josh/Brown", accId: "Beard/Brown" });
    } finally {
      await db.user.deleteMany({ where: { id: { in: [oldId, raceId, legacyId, pendingId] } } });
    }
  });

  it("legacy migration needs both gender and appearance empty (SQL or JSON null) and never touches a partial row", async () => {
    const partialId = `character-legacy-partial-${randomUUID()}`;
    const genderOnlyId = `character-legacy-gender-${randomUUID()}`;
    const jsonNullId = `character-legacy-jsonnull-${randomUUID()}`;
    const partial = { skinIndex: 4, clothesId: "Farm/Red" };
    await db.user.createMany({ data: [
      { id: partialId, characterAppearance: partial },
      { id: genderOnlyId, characterGender: "male" },
      { id: jsonNullId, characterAppearance: Prisma.JsonNull },
    ] });
    try {
      for (const id of [partialId, genderOnlyId]) {
        expect((await POST(request("POST", id, { playerId: id, character, legacy: true }))).status).toBe(409);
      }
      const partialRow = await db.user.findUniqueOrThrow({ where: { id: partialId } });
      expect([partialRow.characterGender, partialRow.characterAppearance]).toEqual([null, partial]);
      const genderRow = await db.user.findUniqueOrThrow({ where: { id: genderOnlyId } });
      expect([genderRow.characterGender, genderRow.characterAppearance]).toEqual(["male", null]);
      expect((await POST(request("POST", jsonNullId, { playerId: jsonNullId, character, legacy: true }))).status).toBe(200);
      expect(await (await GET(request("GET", jsonNullId))).json()).toEqual({ ok: true, needsCharacterSetup: false, canChooseCharacter: false, character });
    } finally {
      await db.user.deleteMany({ where: { id: { in: [partialId, genderOnlyId, jsonNullId] } } });
    }
  });

  it("marks a newly registered password account pending while legacy users stay complete", async () => {
    const playerId = randomUUID().replace(/-/g, "").slice(0, 10);
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
