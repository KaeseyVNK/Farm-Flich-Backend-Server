import { db } from "@/lib/db";

export class WalletError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); }
}

export function validateWalletAddress(address: unknown): asserts address is string {
  if (typeof address !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    throw new WalletError("INVALID_ADDRESS", "Invalid Solana wallet address.");
  }
}

export async function getWallet(input: { address?: string; playerId?: string }) {
  const wallet = input.address
    ? await db.unityWallet.findUnique({ where: { address: input.address } })
    : await db.unityWallet.findUnique({ where: { userId: input.playerId! } });
  if (!wallet) return null;
  const credential = await db.unityCredential.findUnique({ where: { userId: wallet.userId } });
  return { address: wallet.address, playerId: wallet.userId, username: credential?.username || wallet.userId };
}

// Only the signed-nonce verifier in UnityServer may invoke this bridge operation.
export async function bindWallet(input: { action: string; address: string; playerId?: string; name?: string }) {
  if (!input || typeof input !== "object") throw new WalletError("INVALID_REQUEST", "Wallet request required.");
  validateWalletAddress(input.address);
  if (input.action !== "claim" && input.action !== "link") throw new WalletError("INVALID_ACTION", "Invalid wallet action.");
  const name = typeof input.name === "string" ? input.name.trim().toLowerCase() : undefined;
  if (input.action === "claim" && (!name || !/^[a-z0-9_]{1,10}$/.test(name))) {
    throw new WalletError("INVALID_USERNAME", "Username must be 1–10 letters, numbers or underscores.");
  }
  const playerId = input.action === "claim" ? name! : input.playerId;
  if (typeof playerId !== "string" || !playerId) throw new WalletError("INVALID_PLAYER", "Player identity is required.");
  try {
    await db.$transaction(async tx => {
      // Serialize with password registration and alias setup on the same name.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${playerId}))::text AS locked`;
      const existing = await tx.unityWallet.findUnique({ where: { address: input.address } });
      if (existing) {
        if (existing.userId === playerId) return;
        throw new WalletError("WALLET_ALREADY_LINKED", "Wallet is linked to another player.", 409);
      }
      if (await tx.unityWallet.findUnique({ where: { userId: playerId } })) {
        throw new WalletError("ACCOUNT_WALLET_EXISTS", "This player already has a wallet.", 409);
      }
      if (input.action === "claim") {
        const [user, alias, farm] = await Promise.all([
          tx.user.findUnique({ where: { id: playerId } }),
          tx.unityCredential.findUnique({ where: { username: name } }),
          tx.farm.findUnique({ where: { ownerId: playerId } }),
        ]);
        if (user || alias || farm) throw new WalletError("USERNAME_TAKEN", "Username is already in use.", 409);
        await tx.user.create({ data: { id: playerId, displayName: name, characterSetupRequired: true } });
        await tx.farm.create({ data: { ownerId: playerId, terrain: new Array(3600).fill(0), crops: {}, objects: {}, forage: {}, shippingBoxes: {}, gameMeta: {} } });
        await tx.unityCredential.create({ data: { userId: playerId, username: name } });
      } else if (!await tx.user.findUnique({ where: { id: playerId } })) {
        throw new WalletError("PLAYER_NOT_FOUND", "Player does not exist.", 404);
      }
      await tx.unityWallet.create({ data: { userId: playerId, address: input.address } });
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      throw new WalletError("WALLET_CONFLICT", "Wallet or username was claimed. Please retry.", 409);
    }
    throw error;
  }
  return getWallet({ playerId });
}
