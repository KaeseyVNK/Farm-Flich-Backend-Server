/**
 * Tên farmer (username) cho account ví — THỐNG NHẤT với server:
 * walletAuthService.NAME_RE = ^[a-z0-9_]{1,10}$ (trim + lowercase trước khi validate).
 */
export const FARMER_NAME_PATTERN = /^[a-z0-9_]{1,10}$/;

export type FarmerNameResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

export function validateFarmerName(raw: string): FarmerNameResult {
  const normalized = raw.trim().toLowerCase();
  if (FARMER_NAME_PATTERN.test(normalized)) return { ok: true, value: normalized };
  return {
    ok: false,
    error: "Farmer names must be 1–10 characters: letters, numbers, and underscores (_).",
  };
}
