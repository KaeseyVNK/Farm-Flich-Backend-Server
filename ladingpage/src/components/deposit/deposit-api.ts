/**
 * Client gọi các endpoint nạp Cash của server game (Farm-Flich-Server-Beta,
 * src/routes/depositRoutes.js):
 *   GET  /deposit/info     — public: tỉ giá, treasury, mint, mức tối thiểu.
 *   POST /deposit/confirm  — body { signature } → { ok, credited, cash }.
 * (wallet-pay.tsx tự fire POST /deposit/gas-gift best-effort trước khi gửi.)
 * Endpoint confirm yêu cầu phiên đăng nhập (requireSession): tài khoản nhận
 * Cash lấy từ Bearer token do gameApiFetch tự gắn — KHÔNG gửi username trong
 * body (server authority: server bỏ qua username gửi từ client).
 * Mọi hàm không throw — lỗi trở thành union để UI hiển thị thân thiện.
 */

import { GAME_API_BASE_URL } from "@/lib/game-api";
import { gameApiFetch } from "@/components/auth/session";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

const INFO_TIMEOUT_MS = 10_000;

export type DepositInfo = {
  /** false khi server chưa cấu hình treasury → UI hiện banner "chưa mở". */
  enabled: boolean;
  /** Tên mạng hiển thị, ví dụ "Solana". */
  network: string;
  /** Mint USDT (SPL) dùng để gửi/nhận diện token. */
  mint: string;
  decimals: number;
  /** Địa chỉ nhận USDT (null khi chưa cấu hình). */
  treasuryAddress: string | null;
  treasuryTokenAccount: string | null;
  /** Cash nhận được cho mỗi 1 USDT (server config, kỳ vọng 10). */
  rate: number;
  minUsdt: number;
  /** Mức chốt Solana server dùng để xác minh ("finalized" | "confirmed"). */
  commitment: string;
};

export type DepositInfoResult =
  | { ok: true; info: DepositInfo }
  | { ok: false; error: string };

function toNonNegativeInt(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

/** GET /deposit/info — luôn 200 từ server (enabled:false khi chưa cấu hình). */
export async function fetchDepositInfo(): Promise<DepositInfoResult> {
  let response: Response;
  try {
    response = await fetch(`${GAME_API_BASE_URL}/deposit/info`, {
      headers: { Accept: "application/json", "X-Client-Version": "4" },
      cache: "no-store",
      signal: AbortSignal.timeout(INFO_TIMEOUT_MS),
    });
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof DOMException && error.name === "TimeoutError"
          ? "The game server is responding too slowly — try again in a few minutes."
          : "Could not connect to the game server to load top-up information — please try again later.",
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: `The game server returned error ${response.status} while loading top-up information.`,
    };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, error: "The top-up information response is not valid JSON." };
  }
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "The top-up information response is invalid." };
  }
  const record = body as Record<string, unknown>;
  const rate = toNonNegativeInt(record.rate);
  const decimals = toNonNegativeInt(record.decimals);
  const minUsdt = toNonNegativeInt(record.minUsdt);
  if (record.ok !== true || rate === null || decimals === null) {
    return { ok: false, error: "The top-up information response is invalid." };
  }

  if (record.enabled === true) {
    try {
      const treasury = new PublicKey(record.treasuryAddress as string);
      const mint = new PublicKey(record.mint as string);
      if (decimals !== 6 || rate !== 10 || getAssociatedTokenAddressSync(mint, treasury).toBase58() !== record.treasuryTokenAccount) {
        throw new Error("Invalid treasury configuration");
      }
    } catch {
      return { ok: false, error: "Top-up is unavailable: the receiving token account configuration does not match. No funds have been sent." };
    }
  }

  return {
    ok: true,
    info: {
      enabled: record.enabled === true,
      network: typeof record.network === "string" && record.network ? record.network : "Solana",
      mint: typeof record.mint === "string" ? record.mint : "",
      decimals,
      treasuryAddress:
        typeof record.treasuryAddress === "string" && record.treasuryAddress
          ? record.treasuryAddress
          : null,
      treasuryTokenAccount: typeof record.treasuryTokenAccount === "string" ? record.treasuryTokenAccount : null,
      rate,
      minUsdt: minUsdt ?? 1,
      commitment:
        typeof record.commitment === "string" && record.commitment
          ? record.commitment
          : "finalized",
    },
  };
}

export type ConfirmDepositSuccess = {
  ok: true;
  /** Cash đã được cộng (server trả `credited`). */
  credited: number;
  /** Số dư Cash sau khi cộng (server trả `cash`). */
  cash: number;
  /** Lượng USDT đọc được on-chain, dạng chuỗi ("1.5") — null khi server không trả. */
  usdtAmount: string | null;
  /** true khi signature này đã được cộng trước đó (idempotent replay). */
  alreadyCredited: boolean;
};

export type ConfirmDepositFailure = {
  ok: false;
  /** Thông báo tiếng Việt sẵn sàng hiển thị. */
  message: string;
  /** Có nên hiển thị nút "Kiểm tra lại" (lỗi tạm thời, confirm idempotent). */
  retryable: boolean;
  confirmations: number | null;
  requiredConfirmations: number | null;
};

export type ConfirmDepositResult =
  | ConfirmDepositSuccess
  | ConfirmDepositFailure;

function failureFromCode(
  status: number,
  body: Record<string, unknown> | null,
): ConfirmDepositFailure {
  const code = typeof body?.code === "string" ? body.code : "";
  const confirmations = toNonNegativeInt(body?.confirmations);
  const required = toNonNegativeInt(body?.requiredConfirmations);

  switch (code) {
    case "SESSION_EXPIRED":
      return {
        ok: false,
        message: "Your session has expired — please log in again and try confirming once more.",
        retryable: false,
        confirmations: null,
        requiredConfirmations: null,
      };
    case "DEPOSIT_PERSIST_FAILED":
      return {
        ok: false,
        message:
          "The server could not save the deposit record (a storage error), so NO Cash has been credited yet — the transaction is not lost; click “Check again” in a few minutes.",
        retryable: true,
        confirmations: null,
        requiredConfirmations: null,
      };
    case "INVALID_SIGNATURE":
      return {
        ok: false,
        message: "Invalid transaction signature — it must be a base58 string of 64–88 characters.",
        retryable: false,
        confirmations: null,
        requiredConfirmations: null,
      };
    case "INVALID_USERNAME":
      return {
        ok: false,
        message: "Could not determine the account to receive the Cash — please log in again.",
        retryable: false,
        confirmations: null,
        requiredConfirmations: null,
      };
    case "TX_NOT_FINALIZED":
    case "TX_NOT_MINED":
      return {
        ok: false,
        message:
          "The transaction has not appeared on the blockchain yet. If you just sent it, wait a few seconds and click “Check again”.",
        retryable: true,
        confirmations: null,
        requiredConfirmations: null,
      };
    case "TX_FAILED":
      return {
        ok: false,
        message:
          "The transaction failed on-chain — no USDT was transferred. Please create a new transaction.",
        retryable: false,
        confirmations: null,
        requiredConfirmations: null,
      };
    case "TRANSFER_NOT_TO_TREASURY":
      return {
        ok: false,
        message:
          "This transaction contains no USDT transfer to the treasury address — you may have used the wrong network or recipient.",
        retryable: false,
        confirmations: null,
        requiredConfirmations: null,
      };
    case "WRONG_TOKEN_CONTRACT":
      return {
        ok: false,
        message:
          "The transaction is not a USDT transfer on Solana (wrong mint). Please send the correct USDT token on the Solana network.",
        retryable: false,
        confirmations: null,
        requiredConfirmations: null,
      };
    case "TX_NOT_CONFIRMED_YET":
      return {
        ok: false,
        message:
          "The transaction is on the blockchain but has not been finalized by the network yet. Wait a few seconds and click “Check again”.",
        retryable: true,
        confirmations,
        requiredConfirmations: required,
      };
    case "AMOUNT_TOO_SMALL":
      return {
        ok: false,
        message: "The USDT amount in the transaction is below the server minimum.",
        retryable: false,
        confirmations: null,
        requiredConfirmations: null,
      };
    case "TX_ALREADY_CREDITED":
      return {
        ok: false,
        message: "This transaction has already been used to top up a different account.",
        retryable: false,
        confirmations: null,
        requiredConfirmations: null,
      };
    case "FARM_NOT_FOUND":
      return {
        ok: false,
        message:
          "No farm was found for this account — log into the game once to create a farm, then come back to top up.",
        retryable: false,
        confirmations: null,
        requiredConfirmations: null,
      };
    case "DEPOSIT_DISABLED":
      return {
        ok: false,
        message: "Cash top-up is not available yet (the server has not configured a treasury address).",
        retryable: false,
        confirmations: null,
        requiredConfirmations: null,
      };
    case "RPC_UNAVAILABLE":
      return {
        ok: false,
        message:
          "The server could not read on-chain data (the RPC node is overloaded) — click “Check again” in a few minutes.",
        retryable: true,
        confirmations: null,
        requiredConfirmations: null,
      };
    default:
      return {
        ok: false,
        message:
          status === 0
            ? "No response was received from the server within a reasonable time. The transaction may still have been processed — click “Check again”."
            : `Could not confirm the transaction (error ${status || "network"}). Please try again.`,
        retryable: true,
        confirmations: null,
        requiredConfirmations: null,
      };
  }
}

/**
 * POST /deposit/confirm qua gameApiFetch — Bearer token tự gắn, tài khoản nhận
 * Cash do server suy ra từ phiên (body chỉ cần signature). Idempotent theo
 * signature phía server — gửi lại nhiều lần an toàn, treo máy chỉ cần bấm
 * "Kiểm tra lại".
 */
export async function confirmDeposit(
  signature: string,
): Promise<ConfirmDepositResult> {
  const { status, body } = await gameApiFetch("/deposit/confirm", {
    body: { signature },
  });

  if (status === 200 && body && body.ok === true) {
    const creditedMilli = toNonNegativeInt(body.creditedMilliCash);
    const balanceMilli = toNonNegativeInt(body.balanceMilliCash);
    const credited = creditedMilli === null ? null : creditedMilli / 1000;
    const cash = balanceMilli === null ? null : balanceMilli / 1000;
    if (credited === null || cash === null) {
      return {
        ok: false,
        message: "Invalid top-up confirmation response (missing Cash amount).",
        retryable: false,
        confirmations: null,
        requiredConfirmations: null,
      };
    }
    return {
      ok: true,
      credited,
      cash,
      usdtAmount: typeof body.usdtAmount === "string" ? body.usdtAmount : null,
      alreadyCredited: body.alreadyCredited === true,
    };
  }

  return failureFromCode(status, body);
}
