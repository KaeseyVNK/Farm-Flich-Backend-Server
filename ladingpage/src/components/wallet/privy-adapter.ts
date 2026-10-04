/**
 * Privy adapter (mặc định) — mọi gọi SDK qua command queue; PrivyWalletBridge
 * (Task 3, mount ở Task 6) là bên xử lý. File này cố tình không import SDK
 * (chỉ type từ commands/adapter) — SDK thật nằm ở bridge + mount.
 */

import type { WalletAdapter } from "./adapter";
import { enqueueWalletCommand } from "./commands";

function connectViaBridge(): Promise<string> {
  return new Promise((resolve, reject) => enqueueWalletCommand({ kind: "connect", resolve, reject }));
}
function signViaBridge(address: string, message: string): Promise<string> {
  return new Promise((resolve, reject) => enqueueWalletCommand({ kind: "sign", address, message, resolve, reject }));
}
function sendUsdtViaBridge(rawAmount: bigint, treasury: string, mint: string, payer: string): Promise<string> {
  return new Promise((resolve, reject) => enqueueWalletCommand({ kind: "send-usdt", rawAmount, treasury, mint, payer, resolve, reject }));
}
function logoutViaBridge(): Promise<void> {
  return new Promise((resolve, reject) => enqueueWalletCommand({ kind: "logout", resolve, reject }));
}
function authStateViaBridge(): Promise<boolean> {
  return new Promise((resolve, reject) => enqueueWalletCommand({ kind: "auth-state", resolve, reject }));
}

export const privyAdapter: WalletAdapter = {
  id: "privy",
  supportsSilentLink: false,
  connect: () => connectViaBridge().then((address) => ({ address })),
  signPersonalMessage: signViaBridge,
  sendUsdtTransfer: (raw, target, payer) => sendUsdtViaBridge(raw, target.treasury, target.mint, payer),
  logout: logoutViaBridge,
  // Phiên Privy (cookie iframe riêng) chết độc lập với login game — wallet-pay
  // hỏi TRƯỚC để hiện thẻ giải thích thay vì bật modal login bất ngờ.
  isAuthenticated: authStateViaBridge,
};
