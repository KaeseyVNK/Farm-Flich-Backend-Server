import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/db", () => ({ db: {} }));
import { confirmDeposit, depositConfig, verifyDepositTransaction, type ParsedTransaction } from "../src/lib/unity/deposit";
import { db } from "../src/lib/db";
import { validateWalletAddress } from "../src/lib/unity/wallet";
import { GET as walletGet, POST as walletPost } from "../src/app/api/unity/wallet/route";
import { POST as depositPost } from "../src/app/api/unity/deposit/confirm/route";

const wallet = "11111111111111111111111111111111";
const treasury = "22222222222222222222222222222222";
const mint = "33333333333333333333333333333333";
const source = "44444444444444444444444444444444";
const destination = "55555555555555555555555555555555";
const config = { enabled: true, rpc: "https://rpc.invalid", mint, treasuryAddress: treasury, treasuryTokenAccount: destination, network: "test", decimals: 6, rate: 10, minUsdt: 1, commitment: "finalized" as const };
function transaction(amount = "1234567"): ParsedTransaction {
  return {
    meta: { err: null, preTokenBalances: [{ accountIndex: 1, mint, owner: wallet }], postTokenBalances: [{ accountIndex: 2, mint, owner: treasury, uiTokenAmount: { amount, decimals: 6 } }] },
    transaction: { message: { accountKeys: [{ pubkey: wallet, signer: true }, { pubkey: source, signer: false }, { pubkey: destination, signer: false }], instructions: [{ programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", parsed: { type: "transferChecked", info: { source, destination, mint, authority: wallet, tokenAmount: { amount, decimals: 6 } } } }] } },
  };
}
describe("TC-WALLET/DEPOSIT canonical verification", () => {
  it("TC-DEP-01 keeps 3 decimal Cash and floors sub-milli fractions", () => {
    expect(verifyDepositTransaction(transaction(), wallet, config)).toEqual({ amountRaw: BigInt(1234567), creditedMilli: BigInt(12345) });
  });
  it("TC-DEP-02 requires explicit configuration", () => {
    vi.stubEnv("DEPOSIT_SOL_RPC_URL", "");
    expect(depositConfig().enabled).toBe(false);
    vi.unstubAllEnvs();
  });
  it("TC-DEP-03 rejects unrelated wallet's transaction", () => {
    const tx = transaction(); tx.transaction.message.accountKeys[0].signer = false;
    expect(() => verifyDepositTransaction(tx, wallet, config)).toThrow("must sign");
  });
  it("TC-DEP-04 rejects failed or missing metadata", () => {
    const tx = transaction(); tx.meta!.err = { failure: true };
    expect(() => verifyDepositTransaction(tx, wallet, config)).toThrow("failed");
    tx.meta = null;
    expect(() => verifyDepositTransaction(tx, wallet, config)).toThrow("failed");
  });
  it("TC-DEP-05 requires source ownership and authority", () => {
    const tx = transaction(); tx.meta!.preTokenBalances![0].owner = treasury;
    expect(() => verifyDepositTransaction(tx, wallet, config)).toThrow("ownership");
    const delegated = transaction(); delegated.transaction.message.instructions[0].parsed!.info!.authority = treasury;
    expect(() => verifyDepositTransaction(delegated, wallet, config)).toThrow("ownership");
  });
  it("TC-DEP-06 rejects wrong program, destination, mint or decimals", () => {
    for (const field of ["program", "destination", "mint", "decimals"]) {
      const tx = transaction(); const instruction = tx.transaction.message.instructions[0];
      if (field === "program") instruction.programId = wallet;
      if (field === "destination") instruction.parsed!.info!.destination = source;
      if (field === "mint") instruction.parsed!.info!.mint = source;
      if (field === "decimals") instruction.parsed!.info!.tokenAmount!.decimals = 9;
      expect(() => verifyDepositTransaction(tx, wallet, config)).toThrow();
    }
  });
  it("TC-DEP-07 rejects wrong treasury owner and too-small amount", () => {
    const tx = transaction(); tx.meta!.postTokenBalances![0].owner = wallet;
    expect(() => verifyDepositTransaction(tx, wallet, config)).toThrow("ownership");
    expect(() => verifyDepositTransaction(transaction("999999"), wallet, config)).toThrow("at least");
  });
  it("TC-DEP-08 supports multiple checked transfers including inner instructions", () => {
    const tx = transaction("1000000");
    tx.meta!.innerInstructions = [{ instructions: structuredClone(tx.transaction.message.instructions) }];
    tx.meta!.postTokenBalances![0].uiTokenAmount!.amount = "2000000";
    expect(verifyDepositTransaction(tx, wallet, config).creditedMilli).toBe(BigInt(20000));
  });
  it("TC-DEP-09 rejects overflow and malformed amount", () => {
    expect(() => verifyDepositTransaction(transaction("9999999999999999999999999"), wallet, config)).toThrow();
    expect(() => verifyDepositTransaction(transaction("-1"), wallet, config)).toThrow();
  });
  it("TC-DEP-11 rejects transfers that do not increase treasury balance", () => {
    const tx = transaction(); tx.meta!.preTokenBalances!.push({ accountIndex: 2, mint, owner: treasury, uiTokenAmount: { amount: "1234567", decimals: 6 } });
    expect(() => verifyDepositTransaction(tx, wallet, config)).toThrow("receive the full");
  });
  it("TC-WALLET-01 rejects invalid address", () => {
    expect(() => validateWalletAddress("invalid" )).toThrow();
    expect(() => validateWalletAddress(wallet)).not.toThrow();
  });
  it("TC-DEP-10 credits once and returns current balance after spending; foreign claims reject", async () => {
    const values = { DEPOSIT_SOL_RPC_URL: "https://rpc.invalid", DEPOSIT_USDT_MINT: mint, DEPOSIT_TREASURY_ADDRESS: treasury, DEPOSIT_TREASURY_ATA: destination, DEPOSIT_NETWORK: "test", DEPOSIT_USDT_DECIMALS: "6" };
    for (const [key, value] of Object.entries(values)) vi.stubEnv(key, value);
    let balance = BigInt(0);
    let receipt: Record<string, unknown> | null = null;
    let credits = 0;
    const fake = {
      unityWallet: { findUnique: async () => ({ userId: "player", address: wallet }) },
      cashDeposit: { findUnique: async () => receipt, create: async ({ data }: { data: Record<string, unknown> }) => { receipt = data; } },
      user: {
        findUnique: async () => ({ cashMilli: balance }),
        update: async ({ data }: { data: { cashMilli: { increment: bigint } } }) => { credits++; balance += data.cashMilli.increment; return { cashMilli: balance }; },
      },
      $queryRaw: async () => [],
    };
    Object.assign(db, fake, { $transaction: async (run: (tx: typeof fake) => unknown) => run(fake) });
    const rpc = vi.fn(async () => Response.json({ result: transaction("1000000") })) as unknown as typeof fetch;
    const signature = "1".repeat(88);
    try {
      expect(await confirmDeposit("player", signature, rpc)).toMatchObject({ creditedMilliCash: 10000, balanceMilliCash: 10000, alreadyCredited: false });
      balance = BigInt(3500); // A legitimate purchase after credit must not cause replay credit.
      expect(await confirmDeposit("player", signature, rpc)).toMatchObject({ balanceMilliCash: 3500, alreadyCredited: true });
      await expect(confirmDeposit("other", signature, rpc)).rejects.toMatchObject({ code: "TX_ALREADY_CREDITED" });
      expect(credits).toBe(1);
      expect(rpc).toHaveBeenCalledTimes(1);
    } finally { vi.unstubAllEnvs(); }
  });
  it("TC-WALLET-02 preserves legacy balance contract and protects all bridge writes", async () => {
    vi.stubEnv("BRIDGE_TOKEN", "isolated-test-token");
    try {
      const headers = { "x-bridge-token": "isolated-test-token" };
      Object.assign(db, { user: { findUnique: async () => ({ cashMilli: BigInt(29684) }) } });
      const response = await walletGet(new Request("http://localhost/api/unity/wallet?userId=CASHDEMO", { headers }));
      expect(await response.json()).toEqual({ ok: true, playerId: "cashdemo", balanceMilliCash: 29684 });
      expect((await walletGet(new Request("http://localhost/api/unity/wallet?userId=cashdemo"))).status).toBe(401);
      expect((await walletPost(new Request("http://localhost/api/unity/wallet", { method: "POST", body: "{}" }))).status).toBe(401);
      expect((await depositPost(new Request("http://localhost/api/unity/deposit/confirm", { method: "POST", body: "{}" }))).status).toBe(401);
      expect((await walletPost(new Request("http://localhost/api/unity/wallet", { method: "POST", headers, body: "not-json" }))).status).toBe(400);
    } finally { vi.unstubAllEnvs(); }
  });
});
