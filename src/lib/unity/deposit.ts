import { db } from "@/lib/db";
import { WalletError } from "./wallet";

const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const MAX = BigInt(Number.MAX_SAFE_INTEGER);
export function depositConfig() {
  const rpc = process.env.DEPOSIT_SOL_RPC_URL || "";
  const mint = process.env.DEPOSIT_USDT_MINT || "";
  const treasury = process.env.DEPOSIT_TREASURY_ADDRESS || "";
  const treasuryTokenAccount = process.env.DEPOSIT_TREASURY_ATA || "";
  const network = process.env.DEPOSIT_NETWORK || "";
  const decimals = Number(process.env.DEPOSIT_USDT_DECIMALS || "6");
  let safeRpc = false;
  try { safeRpc = new URL(rpc).protocol === "https:"; } catch { /* disabled */ }
  return { enabled: safeRpc && ADDRESS.test(mint) && ADDRESS.test(treasury) && ADDRESS.test(treasuryTokenAccount) && !!network && decimals === 6,
    rpc, mint, treasuryAddress: treasury, treasuryTokenAccount, network, decimals,
    rate: 10, minUsdt: 1, commitment: "finalized" as const };
}
type Config = ReturnType<typeof depositConfig>;
type Balance = { accountIndex: number; mint: string; owner?: string; uiTokenAmount?: { amount?: string; decimals?: number } };
type Instruction = { programId?: string; parsed?: { type?: string; info?: { source?: string; destination?: string; mint?: string; authority?: string; tokenAmount?: { amount?: string; decimals?: number } } } };
export type ParsedTransaction = {
  meta: { err: unknown; preTokenBalances?: Balance[]; postTokenBalances?: Balance[]; innerInstructions?: { instructions: Instruction[] }[] } | null;
  transaction: { message: { accountKeys: { pubkey: string; signer: boolean }[]; instructions: Instruction[] } };
};
export function verifyDepositTransaction(tx: ParsedTransaction | null, wallet: string, config: Config) {
  if (!tx?.meta || tx.meta.err !== null) throw new WalletError("TX_NOT_SUCCESSFUL", "Transaction is missing or failed.");
  const keys = tx.transaction?.message?.accountKeys;
  if (!Array.isArray(keys) || !keys.some(key => key.pubkey === wallet && key.signer === true)) {
    throw new WalletError("TX_WRONG_OWNER", "Linked wallet must sign the transaction.");
  }
  const instructions = [...(tx.transaction.message.instructions || []), ...(tx.meta.innerInstructions || []).flatMap(group => group.instructions || [])];
  let amountRaw = BigInt(0);
  for (const instruction of instructions) {
    const info = instruction.parsed?.info;
    if (instruction.programId !== TOKEN_PROGRAM || instruction.parsed?.type !== "transferChecked" || !info || info.destination !== config.treasuryTokenAccount || info.mint !== config.mint) continue;
    const index = keys.findIndex(key => key.pubkey === info.source);
    const source = tx.meta.preTokenBalances?.find(balance => balance.accountIndex === index && balance.mint === config.mint);
    const destinationIndex = keys.findIndex(key => key.pubkey === info.destination);
    const destination = tx.meta.postTokenBalances?.find(balance => balance.accountIndex === destinationIndex && balance.mint === config.mint);
    if (info.authority !== wallet || source?.owner !== wallet || destination?.owner !== config.treasuryAddress || info.tokenAmount?.decimals !== config.decimals || !/^[0-9]+$/.test(info.tokenAmount?.amount || "")) {
      throw new WalletError("TX_WRONG_OWNER", "Token transfer ownership or currency does not match.");
    }
    amountRaw += BigInt(info.tokenAmount!.amount!);
  }
  const scale = BigInt(10) ** BigInt(config.decimals);
  const creditedMilli = amountRaw * BigInt(10000) / scale;
  if (amountRaw < scale || creditedMilli <= BigInt(0) || creditedMilli > MAX) throw new WalletError("TX_INVALID_AMOUNT", "Deposit must be at least 1 USDT and within the supported amount.");
  const treasuryIndex = keys.findIndex(key => key.pubkey === config.treasuryTokenAccount);
  const before = tx.meta.preTokenBalances?.find(balance => balance.accountIndex === treasuryIndex && balance.mint === config.mint);
  const after = tx.meta.postTokenBalances?.find(balance => balance.accountIndex === treasuryIndex && balance.mint === config.mint);
  if (!after?.uiTokenAmount || after.uiTokenAmount.decimals !== config.decimals || !/^[0-9]+$/.test(after.uiTokenAmount.amount || "") || (before && (!before.uiTokenAmount || !/^[0-9]+$/.test(before.uiTokenAmount.amount || ""))) || BigInt(after.uiTokenAmount.amount!) - BigInt(before?.uiTokenAmount?.amount || "0") < amountRaw) {
    throw new WalletError("TX_INVALID_AMOUNT", "Treasury must receive the full deposit amount.");
  }
  return { amountRaw, creditedMilli };
}

export async function confirmDeposit(playerId: string, signature: string, fetchImpl: typeof fetch = fetch) {
  const config = depositConfig();
  if (!config.enabled) throw new WalletError("DEPOSIT_DISABLED", "Cash deposits are not configured.", 503);
  if (typeof signature !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(signature)) throw new WalletError("INVALID_SIGNATURE", "Invalid transaction signature.");
  const wallet = await db.unityWallet.findUnique({ where: { userId: playerId } });
  if (!wallet) throw new WalletError("WALLET_REQUIRED", "Link a verified wallet first.", 409);
  const unique = { network: config.network, signature };
  const prior = await db.cashDeposit.findUnique({ where: { network_signature: unique } });
  let verified: { amountRaw: bigint; creditedMilli: bigint } | undefined;
  if (!prior) {
    const response = await fetchImpl(config.rpc, { method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(15000), body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getTransaction", params: [signature, { encoding: "jsonParsed", commitment: "finalized", maxSupportedTransactionVersion: 0 }] }) });
    if (!response.ok) throw new WalletError("RPC_UNAVAILABLE", "Chain verification is unavailable.", 503);
    const data = await response.json();
    if (data.error || !data.result) throw new WalletError("TX_NOT_FINALIZED", "Transaction is not finalized yet.", 409);
    verified = verifyDepositTransaction(data.result, wallet.address, config);
  }
  return db.$transaction(async tx => {
    // The signature lock handles concurrent claims by different users; the row
    // lock also serializes credits with Cash purchases on this account.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${config.network + ":" + signature}))::text AS locked`;
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${playerId} FOR UPDATE`;
    const user = await tx.user.findUnique({ where: { id: playerId }, select: { cashMilli: true } });
    if (!user) throw new WalletError("PLAYER_NOT_FOUND", "Player does not exist.", 404);
    const existing = await tx.cashDeposit.findUnique({ where: { network_signature: unique } });
    if (existing) {
      if (existing.userId !== playerId) throw new WalletError("TX_ALREADY_CREDITED", "Transaction belongs to another player.", 409);
      return { ok: true, signature, cashCredited: Number(existing.creditedMilli) / 1000, creditedMilliCash: Number(existing.creditedMilli), balanceMilliCash: Number(user.cashMilli), alreadyCredited: true };
    }
    if (!verified || user.cashMilli + verified.creditedMilli > MAX) throw new WalletError("BALANCE_LIMIT", "Cash balance limit reached.", 409);
    await tx.cashDeposit.create({ data: { ...unique, userId: playerId, walletAddress: wallet.address, ...verified } });
    const updated = await tx.user.update({ where: { id: playerId }, data: { cashMilli: { increment: verified.creditedMilli } }, select: { cashMilli: true } });
    return { ok: true, signature, cashCredited: Number(verified.creditedMilli) / 1000, creditedMilliCash: Number(verified.creditedMilli), balanceMilliCash: Number(updated.cashMilli), alreadyCredited: false };
  });
}
