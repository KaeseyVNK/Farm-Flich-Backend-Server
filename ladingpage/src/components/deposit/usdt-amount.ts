/**
 * Toán số USDT ↔ Cash cho trang nạp (thuần, không side-effect — test được bằng
 * node:test). Server cũng làm phép tính này bằng BigInt (xem
 * Farm-Flich-Server-Beta/src/services/depositService.js: formatUnits + floor
 * bằng phép chia nguyên) — UI cố tình dùng cùng quy tắc floor để KHÔNG bao giờ
 * hứa số Cash nhiều hơn số server cộng thật.
 */

const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
/** Chữ ký giao dịch Solana (base58 64-byte → 64-88 ký tự). */
export const SOLANA_SIGNATURE_RE = /^[1-9A-HJ-NP-Za-km-z]{64,88}$/;

/** Chuỗi có hình dạng địa chỉ ví Solana (base58, case-sensitive)? */
export function isValidSolanaAddress(value: string): boolean {
  return SOLANA_ADDRESS_RE.test(value.trim());
}

/** Chuỗi người dùng dán là chữ ký giao dịch hợp lệ? */
export function isValidSignature(value: string): boolean {
  return SOLANA_SIGNATURE_RE.test(value.trim());
}

/**
 * "1.5" → BigInt raw units theo `decimals` (1.5 USDT, 6 decimals → 1500000n).
 * Chỉ nhận chữ số và tối đa một dấu chấm; phần lẻ dư quá `decimals` bị CẮT
 * (floor, không làm tròn lên). Sai định dạng / rỗng → null.
 */
export function parseUsdtToRaw(input: string, decimals: number): bigint | null {
  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed.length > 32) return null;
  if (!/^\d*(\.\d*)?$/.test(trimmed)) return null;
  const dot = trimmed.indexOf(".");
  const whole = dot === -1 ? trimmed : trimmed.slice(0, dot);
  const fracRaw = dot === -1 ? "" : trimmed.slice(dot + 1);
  if (whole === "" && fracRaw === "") return null; // chỉ có "." — không phải số.
  const frac = fracRaw.slice(0, decimals).padEnd(decimals, "0");
  const digits = `${whole === "" ? "0" : whole}${frac}`;
  return BigInt(digits);
}

/** BigInt raw → chuỗi USDT gọn ("1500000…0n" → "1.5", "2n" → "2"). */
export function formatUsdtFromRaw(raw: bigint, decimals: number): string {
  const base = BigInt(10) ** BigInt(decimals);
  const whole = raw / base;
  const frac = raw % base;
  if (frac === BigInt(0)) return whole.toString();
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}

/** Round down only below 0.001 Cash; matches the canonical milliCash ledger. */
export function rawToCash(raw: bigint, rate: number, decimals: number): number | null {
  const safeRate = BigInt(Math.max(1, Math.trunc(rate)));
  const milliCash = (raw * safeRate * BigInt(1000)) / BigInt(10) ** BigInt(decimals);
  return milliCash > BigInt(Number.MAX_SAFE_INTEGER) ? null : Number(milliCash) / 1000;
}

/** `raw` có đạt mức tối thiểu `minUsdt` USDT (toàn USDT nguyên)? */
export function rawMeetsMinimum(raw: bigint, minUsdt: number, decimals: number): boolean {
  const minWhole = BigInt(Math.max(0, Math.trunc(minUsdt)));
  return raw >= minWhole * BigInt(10) ** BigInt(decimals);
}
