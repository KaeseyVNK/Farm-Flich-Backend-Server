import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { db } from "@/lib/db";

/**
 * Unity bridge — centralized credential store (scrypt, same format as
 * UnityServer authStore so an existing local hash can be migrated).
 *
 * POST /api/unity/auth/login
 *   Body: { "username": "string", "password": "string", "legacyVerified"?: true }
 *   Auth: `x-bridge-token` header === BRIDGE_TOKEN (server-to-server).
 *
 * Behavior (mirrors UnityServer authRoutes semantics):
 *   - unknown user  → create UnityCredential + public.User + Farm, message "Account created"
 *   - known user    → verify scrypt; ok "Login success" / 401 on wrong password
 *   - farm row is ensured so the farm bridge can proceed afterwards.
 */

const SCRYPT_KEYLEN = 64;
const MIN_PASSWORD_LENGTH = 4;

function scryptHash(password: string, salt: Buffer): string {
  return crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
}

function unauthorized() {
  return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
}

export async function POST(req: Request) {
  const token = req.headers.get("x-bridge-token");
  if (!token || token !== process.env.BRIDGE_TOKEN) return unauthorized();

  let body: { username?: string; password?: string; legacyVerified?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = body?.password;
  if (!username || typeof username !== "string") {
    return NextResponse.json({ ok: false, error: "Username is required." }, { status: 400 });
  }
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { ok: false, error: `Password is required and must be at least ${MIN_PASSWORD_LENGTH} characters.` },
      { status: 400 },
    );
  }

  try {
    const existing = await db.unityCredential.findUnique({ where: { userId: username } })
      ?? await db.unityCredential.findUnique({ where: { username } });

    if (!existing) {
      // Legacy IDs predate the username rule; UnityServer sends legacyVerified only after local scrypt proof.
      const legacyVerified = body.legacyVerified === true;
      if (!legacyVerified && !/^[a-z0-9_]{1,10}$/.test(username)) {
        return NextResponse.json({ ok: false, code: "INVALID_USERNAME", error: "Username must be 1–10 letters, numbers or underscores." }, { status: 400 });
      }
      const salt = crypto.randomBytes(16);
      const hash = scryptHash(password, salt);
      const registration = await db.$transaction(async tx => {
        // Alias claims and first password registration share this lock. A lookup
        // before the lock alone cannot prevent two distinct owners of one name.
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${username}))::text AS locked`;
        const [credentialNow, aliasNow, user, farm] = await Promise.all([
          tx.unityCredential.findUnique({ where: { userId: username } }),
          tx.unityCredential.findUnique({ where: { username } }),
          tx.user.findUnique({ where: { id: username }, select: { id: true } }),
          tx.farm.findUnique({ where: { ownerId: username }, select: { id: true } }),
        ]);
        if (credentialNow || aliasNow) return { ok: false, code: "ACCOUNT_ALREADY_EXISTS", error: "Account changed during sign-in. Please retry." };
        if ((user || farm) && !legacyVerified) return { ok: false, code: "ACCOUNT_RECOVERY_REQUIRED", error: "Account recovery required. Contact support." };
        if (legacyVerified) {
          await tx.user.upsert({ where: { id: username }, create: { id: username, displayName: username, characterSetupRequired: false }, update: {} });
          await tx.farm.upsert({ where: { ownerId: username }, create: {
            ownerId: username, terrain: new Array(3600).fill(0),
            crops: {}, objects: {}, forage: {}, shippingBoxes: {}, gameMeta: {},
          }, update: {} });
        } else {
          await tx.user.create({ data: { id: username, displayName: username, characterSetupRequired: true } });
          await tx.farm.create({ data: {
            ownerId: username, terrain: new Array(3600).fill(0),
            crops: {}, objects: {}, forage: {}, shippingBoxes: {}, gameMeta: {},
          } });
        }
        await tx.unityCredential.create({ data: { userId: username, salt: salt.toString("hex"), hash } });
        return { ok: true, playerId: username, message: legacyVerified ? "Login success" : "Account created" };
      });
      return NextResponse.json(registration, { status: registration.ok ? 200 : 409 });
    }

    if (!existing.salt || !existing.hash) {
      return NextResponse.json({ ok: false, error: "Please sign in with Google." }, { status: 401 });
    }
    const actualBytes = Buffer.from(scryptHash(password, Buffer.from(existing.salt, "hex")), "hex");
    const expectedBytes = Buffer.from(existing.hash, "hex");
    const ok =
      actualBytes.length === expectedBytes.length &&
      crypto.timingSafeEqual(actualBytes, expectedBytes);

    if (!ok) {
      return NextResponse.json({ ok: false, error: "Invalid username or password." }, { status: 401 });
    }

    return NextResponse.json({ ok: true, playerId: existing.userId, username: existing.username || (existing.userId.includes("@") ? null : existing.userId), email: existing.email, message: "Login success", needsUsernameSetup: false });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      return NextResponse.json(
        { ok: false, code: "ACCOUNT_ALREADY_EXISTS", error: "Account changed during sign-in. Please retry." },
        { status: 409 },
      );
    }
    console.error("[unity-auth] login failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "login failed" },
      { status: 500 },
    );
  }
}
