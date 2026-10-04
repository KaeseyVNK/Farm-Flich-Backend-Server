import { isValidSignature } from "./usdt-amount";

export type DepositOwner = { playerId: string; network: string; walletAddress: string };
type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;
const key = (owner: DepositOwner) => `farmfilch.pendingDeposits.v1:${JSON.stringify([owner.playerId, owner.network, owner.walletAddress])}`;

export function readPendingDeposits(owner: DepositOwner, storage?: Storage): string[] {
  try {
    const values: unknown = JSON.parse((storage ?? window.localStorage).getItem(key(owner)) ?? "[]");
    return Array.isArray(values) ? [...new Set(values.filter((value): value is string => typeof value === "string" && isValidSignature(value)))].slice(0, 20) : [];
  } catch { return []; }
}

export function savePendingDeposit(owner: DepositOwner, signature: string, storage?: Storage): boolean {
  try {
    const target = storage ?? window.localStorage;
    if (!isValidSignature(signature)) return false;
    const pending = readPendingDeposits(owner, target);
    if (!pending.includes(signature)) {
      if (pending.length >= 20) return false;
      pending.push(signature);
    }
    target.setItem(key(owner), JSON.stringify(pending));
    return true;
  } catch { return false; }
}

export function removePendingDeposit(owner: DepositOwner, signature: string, storage?: Storage) {
  try {
    const target = storage ?? window.localStorage;
    const pending = readPendingDeposits(owner, target).filter(value => value !== signature);
    if (pending.length) target.setItem(key(owner), JSON.stringify(pending));
    else target.removeItem(key(owner));
  } catch { /* Keep receipt recoverable from the wallet history. */ }
}
