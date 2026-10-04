/**
 * Particles adapter — giữ flow JWT ngầm duy nhất có trong hệ (connectSilent).
 * Mọi gọi SDK qua command queue; ParticlesWalletBridge xử lý.
 */

import type { WalletAdapter } from "./adapter";
import { enqueueWalletCommand } from "./commands";

function connectViaBridge(): Promise<string> {
  return new Promise((resolve, reject) => enqueueWalletCommand({ kind: "connect", resolve, reject }));
}
function connectSilentViaBridge(jwt: string): Promise<string> {
  return new Promise((resolve, reject) => enqueueWalletCommand({ kind: "connect-silent", jwt, resolve, reject }));
}
function signViaBridge(address: string, message: string): Promise<string> {
  return new Promise((resolve, reject) => enqueueWalletCommand({ kind: "sign", address, message, resolve, reject }));
}
function sendUsdtViaBridge(rawAmount: bigint, treasury: string, mint: string, payer: string): Promise<string> {
  return new Promise((resolve, reject) => enqueueWalletCommand({ kind: "send-usdt", rawAmount, treasury, mint, payer, resolve, reject }));
}

export const particlesAdapter: WalletAdapter = {
  id: "particles",
  supportsSilentLink: true,
  connect: () => connectViaBridge().then((address) => ({ address })),
  connectSilent: (jwt: string) => connectSilentViaBridge(jwt).then((address) => ({ address })),
  signPersonalMessage: signViaBridge,
  sendUsdtTransfer: (raw, target, payer) => sendUsdtViaBridge(raw, target.treasury, target.mint, payer),
};
