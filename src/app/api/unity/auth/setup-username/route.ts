import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const expected = process.env.BRIDGE_TOKEN;
  if (!expected || req.headers.get("x-bridge-token") !== expected) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  let body: { playerId?: unknown; username?: unknown; password?: unknown };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, code: "INVALID_USERNAME" }, { status: 400 }); }
  const playerId = typeof body.playerId === "string" ? body.playerId.trim().toLowerCase() : "";
  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = body.password;
  if (!playerId || playerId.length > 254 || !/^[a-z0-9_]{1,10}$/.test(username)) {
    return NextResponse.json({ ok: false, code: "INVALID_USERNAME" }, { status: 400 });
  }
  if (typeof password !== "string" || password.length < 4) {
    return NextResponse.json({ ok: false, code: "INVALID_PASSWORD" }, { status: 400 });
  }

  try {
    const result = await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${username}))::text AS locked`;
      const credential = await tx.unityCredential.findUnique({ where: { userId: playerId } });
      const user = await tx.user.findUnique({ where: { id: playerId } });
      if (!credential || !user || !credential.googleSub) return { status: 404, code: "PLAYER_NOT_FOUND" };
      if (!user.usernameSetupRequired || credential.hash || credential.salt || credential.username) {
        if (credential.username === username && credential.hash && credential.salt && !user.usernameSetupRequired) {
          const actual = Buffer.from(crypto.scryptSync(password, Buffer.from(credential.salt, "hex"), 64));
          const expectedHash = Buffer.from(credential.hash, "hex");
          if (actual.length === expectedHash.length && crypto.timingSafeEqual(actual, expectedHash)) {
            return { status: 200, ok: true, playerId, username, needsUsernameSetup: false };
          }
        }
        return { status: 409, code: "USERNAME_ALREADY_CONFIGURED" };
      }
      const [byId, byAlias, byUser] = await Promise.all([
        tx.unityCredential.findUnique({ where: { userId: username } }),
        tx.unityCredential.findUnique({ where: { username } }),
        tx.user.findUnique({ where: { id: username } }),
      ]);
      if (byId || byAlias || byUser) return { status: 409, code: "USERNAME_IN_USE" };
      const salt = crypto.randomBytes(16);
      const hash = crypto.scryptSync(password, salt, 64).toString("hex");
      const claimed = await tx.unityCredential.updateMany({
        where: { userId: playerId, username: null, salt: null, hash: null },
        data: { username, salt: salt.toString("hex"), hash },
      });
      if (claimed.count !== 1) return { status: 409, code: "USERNAME_ALREADY_CONFIGURED" };
      await tx.user.update({ where: { id: playerId }, data: { usernameSetupRequired: false, displayName: username } });
      return { status: 200, ok: true, playerId, username, needsUsernameSetup: false };
    });
    return NextResponse.json(result, { status: result.status });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json({ ok: false, code: "USERNAME_IN_USE" }, { status: 409 });
    }
    console.error("[unity-auth] username setup failed:", error);
    return NextResponse.json({ ok: false, code: "SETUP_UNAVAILABLE" }, { status: 503 });
  }
}
