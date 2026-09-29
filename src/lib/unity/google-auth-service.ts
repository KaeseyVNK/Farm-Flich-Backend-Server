type GoogleRecord = {
  userId: string;
  email: string | null;
  googleSub: string | null;
  salt: string | null;
  hash: string | null;
};

type GoogleDb = {
  unityCredential: {
    findUnique(args: { where: Record<string, string> }): Promise<GoogleRecord | null>;
    create(args: { data: GoogleRecord }): Promise<GoogleRecord>;
    update(args: { where: { userId: string }; data: Partial<GoogleRecord> }): Promise<GoogleRecord>;
  };
  user: {
    findUnique(args: { where: { id: string } }): Promise<{ id: string } | null>;
    create(args: { data: { id: string; displayName: string; characterSetupRequired: boolean; usernameSetupRequired: boolean } }): Promise<unknown>;
  };
  farm: {
    findUnique(args: { where: { ownerId: string } }): Promise<{ ownerId: string } | null>;
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
  $transaction<T>(work: (tx: GoogleDb) => Promise<T>): Promise<T>;
};

export type GoogleAuthResult =
  | { ok: true; playerId: string; email: string; message: "Account created" | "Login success" | "Google linked" }
  | { ok: false; code: string };

export function normalizeGoogleIdentity(email: unknown, googleSub: unknown): { email: string; googleSub: string } | null {
  if (typeof email !== "string" || typeof googleSub !== "string") return null;
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedSub = googleSub.trim();
  if (normalizedEmail.length > 254 || !/^[^\s:@]+@[^\s:@]+\.[^\s:@]+$/.test(normalizedEmail)) return null;
  if (!normalizedSub || normalizedSub.length > 255 || /[\u0000-\u001f]/.test(normalizedSub)) return null;
  return { email: normalizedEmail, googleSub: normalizedSub };
}

function isUniqueViolation(error: unknown): boolean {
  return !!error && typeof error === "object" && "code" in error && error.code === "P2002";
}

async function ensureCanonicalEmail(tx: GoogleDb, record: GoogleRecord, email: string): Promise<GoogleAuthResult> {
  if (record.email === email) return { ok: true, playerId: record.userId, email, message: "Login success" };
  const owner = await tx.unityCredential.findUnique({ where: { email } });
  if (owner && owner.userId !== record.userId) return { ok: false, code: "EMAIL_IN_USE" };
  const usernameOwner = await tx.unityCredential.findUnique({ where: { userId: email } });
  if (usernameOwner && usernameOwner.userId !== record.userId) return { ok: false, code: "EMAIL_IN_USE" };
  await tx.unityCredential.update({ where: { userId: record.userId }, data: { email } });
  return { ok: true, playerId: record.userId, email, message: "Login success" };
}

async function resolveByGoogleSub(tx: GoogleDb, email: string, googleSub: string): Promise<GoogleAuthResult | null> {
  const record = await tx.unityCredential.findUnique({ where: { googleSub } });
  return record ? ensureCanonicalEmail(tx, record, email) : null;
}

async function resolveGoogleLoginTx(tx: GoogleDb, email: string, googleSub: string): Promise<GoogleAuthResult> {
  const bySub = await resolveByGoogleSub(tx, email, googleSub);
  if (bySub) return bySub;

  const byEmail = await tx.unityCredential.findUnique({ where: { email } });
  if (byEmail) return { ok: false, code: byEmail.googleSub ? "GOOGLE_SUB_MISMATCH" : "ACCOUNT_LINK_REQUIRED" };

  const playerId = email;
  const [credential, user, farm] = await Promise.all([
    tx.unityCredential.findUnique({ where: { userId: playerId } }),
    tx.user.findUnique({ where: { id: playerId } }),
    tx.farm.findUnique({ where: { ownerId: playerId } }),
  ]);
  if (credential || user || farm) return { ok: false, code: "ACCOUNT_LINK_REQUIRED" };

  await tx.user.create({ data: { id: playerId, displayName: email.slice(0, email.indexOf("@")), characterSetupRequired: true, usernameSetupRequired: true } });
  await tx.farm.create({
    data: {
      ownerId: playerId,
      terrain: new Array(3600).fill(0),
      crops: {}, objects: {}, forage: {}, shippingBoxes: {}, gameMeta: {},
    },
  });
  await tx.unityCredential.create({
    data: { userId: playerId, email, googleSub, salt: null, hash: null },
  });
  return { ok: true, playerId, email, message: "Account created" };
}

export async function resolveGoogleLogin(db: GoogleDb, rawEmail: unknown, rawGoogleSub: unknown): Promise<GoogleAuthResult> {
  const identity = normalizeGoogleIdentity(rawEmail, rawGoogleSub);
  if (!identity) return { ok: false, code: "INVALID_IDENTITY" };
  try {
    return await db.$transaction(tx => resolveGoogleLoginTx(tx, identity.email, identity.googleSub));
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    // Concurrent first sign-in may have created this sub between our reads.
    try {
      const winner = await db.$transaction(tx => resolveByGoogleSub(tx, identity.email, identity.googleSub));
      if (winner) return winner;
    } catch { /* Return a conflict below; never bind to an unverified row. */ }
    return { ok: false, code: "GOOGLE_SUB_IN_USE" };
  }
}

async function resolveGoogleLinkTx(tx: GoogleDb, playerId: string, email: string, googleSub: string): Promise<GoogleAuthResult> {
  const player = await tx.unityCredential.findUnique({ where: { userId: playerId } });
  if (!player) return { ok: false, code: "PLAYER_NOT_FOUND" };
  if (player.googleSub && player.googleSub !== googleSub) return { ok: false, code: "GOOGLE_SUB_MISMATCH" };

  // Keep these unique lookups sequential so the subject and email ownership
  // checks stay independent before the credential update.
  const subOwner = await tx.unityCredential.findUnique({ where: { googleSub } });
  if (subOwner && subOwner.userId !== playerId) return { ok: false, code: "GOOGLE_SUB_IN_USE" };

  const emailOwner = await tx.unityCredential.findUnique({ where: { email } });
  if (emailOwner && emailOwner.userId !== playerId) return { ok: false, code: "EMAIL_IN_USE" };
  // Legacy password accounts may use their email as userId while email is null.
  const usernameOwner = await tx.unityCredential.findUnique({ where: { userId: email } });
  if (usernameOwner && usernameOwner.userId !== playerId) return { ok: false, code: "EMAIL_IN_USE" };

  if (player.googleSub === googleSub && player.email === email) {
    return { ok: true, playerId, email, message: "Google linked" };
  }
  await tx.unityCredential.update({ where: { userId: playerId }, data: { email, googleSub } });
  return { ok: true, playerId, email, message: "Google linked" };
}

export async function resolveGoogleLink(db: GoogleDb, rawPlayerId: unknown, rawEmail: unknown, rawGoogleSub: unknown): Promise<GoogleAuthResult> {
  const identity = normalizeGoogleIdentity(rawEmail, rawGoogleSub);
  if (!identity || typeof rawPlayerId !== "string" || !rawPlayerId.trim() || rawPlayerId.trim().length > 254) {
    return { ok: false, code: "INVALID_IDENTITY" };
  }
  const playerId = rawPlayerId.trim().toLowerCase();
  try {
    return await db.$transaction(tx => resolveGoogleLinkTx(tx, playerId, identity.email, identity.googleSub));
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, code: "EMAIL_IN_USE" };
    throw error;
  }
}
