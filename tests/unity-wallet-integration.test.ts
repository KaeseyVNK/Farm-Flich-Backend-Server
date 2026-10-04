import { randomBytes } from "node:crypto";
import { describe, it, expect, vi } from "vitest";
import { db } from "../src/lib/db";
import { bindWallet, getWallet } from "../src/lib/unity/wallet";
import { confirmDeposit } from "../src/lib/unity/deposit";
import { topByGold, topByLevel, getLeaderboardMetadata } from "../src/lib/game/leaderboard-service";

describe("TC-WALLET local PostgreSQL transactions", () => {
  it("TC-WALLET-DB-01 preserves identity, rejects hijacking and credits concurrently once", async () => {
    const host = new URL(process.env.DATABASE_URL!).hostname;
    if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) throw new Error("Local database required.");
    const name = "w" + randomBytes(4).toString("hex");
    const other = "w" + randomBytes(4).toString("hex");
    const address = "1" + randomBytes(20).toString("hex").replace(/0/g, "1");
    const mint = "3".repeat(32), treasury = "4".repeat(32), ata = "5".repeat(32), source = "6".repeat(32);
    const signature = "2".repeat(32) + randomBytes(24).toString("hex").replace(/0/g, "1");
    for (const [key, value] of Object.entries({ DEPOSIT_SOL_RPC_URL: "https://rpc.invalid", DEPOSIT_NETWORK: "isolated-test", DEPOSIT_USDT_MINT: mint, DEPOSIT_TREASURY_ADDRESS: treasury, DEPOSIT_TREASURY_ATA: ata })) vi.stubEnv(key, value);
    const rpc = vi.fn(async () => Response.json({ result: {
      meta: { err: null, preTokenBalances: [{ accountIndex: 1, mint, owner: address }], postTokenBalances: [{ accountIndex: 2, mint, owner: treasury, uiTokenAmount: { amount: "1234567", decimals: 6 } }] },
      transaction: { message: { accountKeys: [{ pubkey: address, signer: true }, { pubkey: source, signer: false }, { pubkey: ata, signer: false }], instructions: [{ programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", parsed: { type: "transferChecked", info: { source, destination: ata, mint, authority: address, tokenAmount: { amount: "1234567", decimals: 6 } } } }] } },
    } })) as unknown as typeof fetch;
    try {
      await db.user.create({ data: { id: other, gold: 999 } });
      await expect(bindWallet({ action: "claim", address, name: other })).rejects.toMatchObject({ code: "USERNAME_TAKEN" });
      expect((await db.user.findUnique({ where: { id: other } }))?.gold).toBe(999);
      expect(await bindWallet({ action: "claim", address, name })).toMatchObject({ playerId: name, address });
      expect((await db.user.findUnique({ where: { id: name } }))?.characterSetupRequired).toBe(true);
      expect((await db.unityCredential.findUnique({ where: { userId: name } }))?.hash).toBeNull();
      expect(await getWallet({ address })).toMatchObject({ playerId: name });
      await expect(bindWallet({ action: "link", address, playerId: other })).rejects.toMatchObject({ code: "WALLET_ALREADY_LINKED" });
      const results = await Promise.all([confirmDeposit(name, signature, rpc), confirmDeposit(name, signature, rpc)]);
      expect(results.filter(result => !result.alreadyCredited)).toHaveLength(1);
      expect((await db.user.findUnique({ where: { id: name } }))?.cashMilli).toBe(BigInt(12345));
      expect(await db.cashDeposit.count({ where: { userId: name } })).toBe(1);
      await db.user.update({ where: { id: name }, data: { cashMilli: BigInt(2000) } });
      expect(await confirmDeposit(name, signature, rpc)).toMatchObject({ alreadyCredited: true, balanceMilliCash: 2000 });
      await db.user.updateMany({ where: { id: { in: [name, other] } }, data: { gold: 2147483647 } });
      const goldEntries = await topByGold(100);
      const metadata = await getLeaderboardMetadata("gold", name);
      expect(metadata.myRank).toBe(goldEntries.findIndex(entry => entry.userId === name) + 1);
      const tied = goldEntries.filter(entry => entry.userId === name || entry.userId === other).map(entry => entry.userId);
      expect(tied).toEqual([name, other].sort());
      expect(metadata.totalUsers).toBe(await db.user.count());
      await db.userProgression.createMany({ data: [{ userId: name, level: 999, totalXp: 1 }, { userId: other, level: 999, totalXp: 1 }] });
      const levelEntries = await topByLevel(100);
      expect((await getLeaderboardMetadata("level", name)).myRank).toBe(levelEntries.findIndex(entry => entry.userId === name) + 1);
      expect((await getLeaderboardMetadata("level", "no-such-player")).myRank).toBeNull();
    } finally {
      await db.user.deleteMany({ where: { id: { in: [name, other] } } });
      await db.$disconnect();
      vi.unstubAllEnvs();
    }
  });
});
