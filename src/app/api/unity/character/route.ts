import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { parseCharacterSelection, parseLegacyCharacter, storedCharacter } from "@/lib/unity/character-selection";

function authorized(req: Request): boolean {
  const token = process.env.BRIDGE_TOKEN;
  return !!token && req.headers.get("x-bridge-token") === token;
}

function state(user: { characterSetupRequired: boolean; characterGender: string | null; characterAppearance: unknown }) {
  return {
    needsCharacterSetup: user.characterSetupRequired,
    canChooseCharacter: user.characterSetupRequired || (user.characterGender === null && user.characterAppearance === null),
    character: storedCharacter(user.characterGender, user.characterAppearance),
  };
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ ok: false, code: "AUTH_REQUIRED" }, { status: 401 });
  const playerId = new URL(req.url).searchParams.get("playerId")?.trim().toLowerCase();
  if (!playerId) return NextResponse.json({ ok: false, code: "PLAYER_NOT_FOUND" }, { status: 400 });
  try {
    const user = await db.user.findUnique({ where: { id: playerId }, select: {
      characterSetupRequired: true, characterGender: true, characterAppearance: true,
    } });
    if (!user) return NextResponse.json({ ok: false, code: "PLAYER_NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ ok: true, ...state(user) });
  } catch {
    return NextResponse.json({ ok: false, code: "CHARACTER_SAVE_UNAVAILABLE" }, { status: 503 });
  }
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ ok: false, code: "AUTH_REQUIRED" }, { status: 401 });
  let body: { playerId?: unknown; character?: unknown; legacy?: unknown };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, code: "INVALID_CHARACTER_SELECTION" }, { status: 400 }); }
  const playerId = body && typeof body.playerId === "string" ? body.playerId.trim().toLowerCase() : "";
  const legacy = body?.legacy === true;
  const character = legacy ? parseLegacyCharacter(body?.character) : parseCharacterSelection(body?.character);
  if (!playerId || !character) return NextResponse.json({ ok: false, code: "INVALID_CHARACTER_SELECTION" }, { status: 400 });
  try {
    const user = await db.user.findUnique({ where: { id: playerId }, select: {
      characterSetupRequired: true, characterGender: true, characterAppearance: true,
    } });
    if (!user) return NextResponse.json({ ok: false, code: "PLAYER_NOT_FOUND" }, { status: 404 });
    const { gender, ...appearance } = character;
    const oldAccountWithoutCharacter = !user.characterSetupRequired &&
      user.characterGender === null && user.characterAppearance === null;
    if (!legacy && (user.characterSetupRequired || oldAccountWithoutCharacter)) {
      const result = await db.user.updateMany({
        where: { id: playerId, OR: [
          { characterSetupRequired: true },
          { characterSetupRequired: false, characterGender: null, characterAppearance: { equals: Prisma.AnyNull } },
        ] },
        data: { characterSetupRequired: false, characterGender: gender, characterAppearance: appearance },
      });
      if (result.count === 1) return NextResponse.json({ ok: true, needsCharacterSetup: false, character });
    }
    // Prisma reads both SQL NULL and JSON null back as null.
    if (legacy && !user.characterSetupRequired && user.characterGender === null && user.characterAppearance === null) {
      const result = await db.user.updateMany({
        where: { id: playerId, characterSetupRequired: false, characterGender: null, characterAppearance: { equals: Prisma.AnyNull } },
        data: { characterGender: gender, characterAppearance: appearance },
      });
      if (result.count === 1) return NextResponse.json({ ok: true, needsCharacterSetup: false, character });
    }
    const current = await db.user.findUnique({ where: { id: playerId }, select: {
      characterSetupRequired: true, characterGender: true, characterAppearance: true,
    } });
    if (current && !current.characterSetupRequired && JSON.stringify(state(current).character) === JSON.stringify(character)) {
      return NextResponse.json({ ok: true, needsCharacterSetup: false, character });
    }
    return NextResponse.json({ ok: false, code: "CHARACTER_ALREADY_CONFIGURED" }, { status: 409 });
  } catch {
    return NextResponse.json({ ok: false, code: "CHARACTER_SAVE_UNAVAILABLE" }, { status: 503 });
  }
}
