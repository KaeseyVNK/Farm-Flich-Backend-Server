/**
 * Dựng lệnh chuyển USDT (SPL transferChecked) sang treasury — dùng chung bởi
 * cả 3 adapter (Privy lấy bytes serialize, Web3Auth lấy base64, Particles lấy
 * object). VersionedTransaction chưa ký serialize AN TOÀN: constructor zero-fill
 * sẵn phần signatures (verify offline 2026-10-01).
 *
 * Sửa 2026-10-02 (root-cause "The transaction was not sent"): treasury chưa có
 * token account USDT trên mainnet → transferChecked fail simulate 100%.
 * Transaction giờ MỘI idempotent create ATA đích (createAssociatedTokenAccount
 * IdempotentInstruction) — account đã tồn tại thì no-op, chưa thì người gửi trả
 * rent ~2,039,280 lamports. Kèm retry cho getLatestBlockhash (RPC public hay
 * 429 — flow chết trước cả khi popup Privy kịp mở).
 */
import {
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

/** Rent 1 token account SPL chuẩn (không extension) — người gửi trả khi create. */
export const ATA_RENT_LAMPORTS = 2_039_280;
/** Phí signature cơ bản. */
export const TX_FEE_LAMPORTS = 5_000;
/** Đệm cho blockhash/edge — cộng vào mốc chặn ở wallet-pay. */
export const SOL_BUFFER_LAMPORTS = 100_000;

/**
 * Mốc SOL tối thiểu người gửi cần (pure, test được): thiếu ATA đích thì phải
 * trả rent + phí + đệm; ATA có sẵn chỉ cần phí + đệm. `null` (RPC lỗi) →
 * coi như cần tạo (thất bại an toàn — hiện panel nạp SOL thay vì gửi hụt).
 */
export function requiredPayerLamports(treasuryAtaExists: boolean | null): number {
  return TX_FEE_LAMPORTS + SOL_BUFFER_LAMPORTS + (treasuryAtaExists ? 0 : ATA_RENT_LAMPORTS);
}

/** Parsed token account JSON (getAccountInfo encoding jsonParsed) → raw units. */
export function parseTokenAmountRaw(parsedInfo: unknown): bigint | null {
  const info = parsedInfo as { tokenAmount?: { amount?: string } } | null;
  const amount = info?.tokenAmount?.amount;
  if (typeof amount !== "string" || !/^\d+$/.test(amount)) return null;
  return BigInt(amount);
}

export async function buildUnsignedUsdtTransfer(
  payer: string,
  treasury: string,
  mint: string,
  rawAmount: bigint,
  rpcUrl: string,
): Promise<VersionedTransaction> {
  const connection = new Connection(rpcUrl);
  const payerPk = new PublicKey(payer);
  const mintPk = new PublicKey(mint);
  const treasuryPk = new PublicKey(treasury);
  const source = getAssociatedTokenAddressSync(mintPk, payerPk);
  const destination = getAssociatedTokenAddressSync(mintPk, treasuryPk);
  const instructions = [
    // Idempotent: destination đã tồn tại → no-op; chưa → payer trả rent tạo.
    createAssociatedTokenAccountIdempotentInstruction(
      payerPk, destination, treasuryPk, mintPk, TOKEN_PROGRAM_ID,
    ),
    createTransferCheckedInstruction(
      source, mintPk, destination, payerPk, rawAmount, 6, [], TOKEN_PROGRAM_ID,
    ),
  ];
  const { blockhash } = await getLatestBlockhashWithRetry(connection);
  const message = new TransactionMessage({
    instructions,
    recentBlockhash: blockhash,
    payerKey: payerPk,
  }).compileToV0Message();
  return new VersionedTransaction(message);
}
/** bytes → base64 (Web3Auth JRPC `solana_sendTransaction` bắt buộc base64). */
export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/**
 * Số dư SOL (lamports) của ví — pre-check phí trước khi dựng lệnh chuyển.
 * Lỗi RPC trả null cho caller tự degrade (vẫn cho thử gửi, ví sẽ tự báo
 * thiếu phí). Quyết định 2026-10-02: user trả toàn bộ phí — không có gas-gift.
 */
export async function getSolLamports(payer: string, rpcUrl: string): Promise<number | null> {
  try {
    const connection = new Connection(rpcUrl);
    return await connection.getBalance(new PublicKey(payer));
  } catch {
    return null;
  }
}

/**
 * Snapshot token account `owner`+`mint`: tồn tại chưa + số dư raw units.
 * Trả null khi RPC lỗi → caller degrade (không chặn gửi vì dữ liệu thiếu).
 */
export async function getTokenAccountSnapshot(
  owner: string,
  mint: string,
  rpcUrl: string,
): Promise<{ exists: boolean; rawAmount: bigint | null } | null> {
  try {
    const connection = new Connection(rpcUrl);
    const ata = getAssociatedTokenAddressSync(new PublicKey(mint), new PublicKey(owner));
    const account = await connection.getAccountInfo(ata);
    if (!account) return { exists: false, rawAmount: null };
    // getAccountInfo encoding mặc định → data là Buffer 165 byte theo layout
    // SPL token: amount = u64 little-endian tại offset 64.
    const raw = account.data as Uint8Array;
    if (raw.length < 72) return { exists: true, rawAmount: null };
    let amount = BigInt(0);
    for (let i = 0; i < 8; i += 1) amount |= BigInt(raw[64 + i]) << BigInt(8 * i);
    return { exists: true, rawAmount: amount };
  } catch {
    return null;
  }
}

/**
 * getLatestBlockhash với 1 retry — RPC public (api.mainnet-beta.solana.com)
 * hay 429/timeout; chết ở đây = không popup xác nhận nào của Privy xuất hiện.
 */
async function getLatestBlockhashWithRetry(connection: Connection): Promise<{
  blockhash: string;
  lastValidBlockHeight: number;
}> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await connection.getLatestBlockhash();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }
  throw lastError;
}
