"use client";

/**
 * Bridge Particles — Solana qua useSolana() (ghim probe authkit 2.1.1):
 * connect() (modal/jwt) → address xuất hiện trên useSolana().address;
 * silent-jwt: nếu address vẫn null sau connect → enable() 1 lần (defensive —
 * runtime UNVERIFIED) → vẫn null thì throw (wallet-card rơi "degraded").
 * sign: signMessage(Uint8Array) → {signature: Uint8Array} → base58.
 * send: signAndSendTransaction(VersionedTransaction) → {signature: string}.
 */

import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { AuthType } from "@particle-network/auth-core";
import { useConnect, useSolana } from "@particle-network/authkit";
import bs58 from "bs58";
import { resolveSolanaRpc } from "./adapter";
import {
  drainWalletCommands,
  pendingWalletCommandCount,
  subscribeWalletCommands,
  type WalletCommand,
} from "./commands";

const POLL_MS = 250;
const ADDRESS_TIMEOUT_MS = 30_000;

type ParticlesApi = {
  connect: ReturnType<typeof useConnect>["connect"];
  solana: ReturnType<typeof useSolana>;
};

export default function ParticlesWalletBridge() {
  const { connect } = useConnect();
  const solana = useSolana();
  const pendingCount = useSyncExternalStore(subscribeWalletCommands, pendingWalletCommandCount);
  const busyRef = useRef(false);
  const [pump, setPump] = useState(0);
  const apiRef = useRef<ParticlesApi>({ connect, solana });

  useEffect(() => {
    apiRef.current = { connect, solana };
  }, [connect, solana]);

  useEffect(() => {
    if (busyRef.current || pendingCount === 0) return;
    busyRef.current = true;
    const commands = drainWalletCommands();
    void Promise.all(commands.map((cmd) => runCommand(cmd, apiRef))).finally(() => {
      busyRef.current = false;
      setPump((t) => t + 1);
    });
  }, [pendingCount, pump]);

  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollUntil(predicate: () => boolean, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await sleep(POLL_MS);
  }
  throw new Error("wallet request timed out");
}

async function resolveAddress(apiRef: RefObject<ParticlesApi>): Promise<string> {
  await pollUntil(() => (apiRef.current.solana.address ?? "") !== "", ADDRESS_TIMEOUT_MS);
  const address = apiRef.current.solana.address;
  if (!address) throw new Error("particles returned no solana address");
  return address;
}

async function runCommand(cmd: WalletCommand, apiRef: RefObject<ParticlesApi>): Promise<void> {
  const api = apiRef.current;
  try {
    if (cmd.kind === "connect") {
      await api.connect(); // modal Particles (timeout của poll là lưới)
      cmd.resolve(await resolveAddress(apiRef));
      return;
    }
    if (cmd.kind === "connect-silent") {
      // JWT ngầm — flow hiện tại của game (sub = playerId)
      await api.connect({ provider: AuthType.jwt, thirdpartyCode: cmd.jwt });
      if ((api.solana.address ?? "") === "") {
        try { await api.solana.enable(); } catch { /* enable lỗi → để address check quyết định */ }
      }
      cmd.resolve(await resolveAddress(apiRef));
      return;
    }
    if (cmd.kind === "logout") {
      // Particles không có session logout tương đương Privy (JWT ngầm định
      // theo đăng nhập game) — "Use a different wallet" chỉ nhánh Privy;
      // adapter Particles không expose logout nên lệnh này không bao giờ tới.
      cmd.reject(new Error("particles does not support logout"));
      return;
    }
    if (cmd.kind === "auth-state") {
      // Particles giữ phiên theo JWT game (connect() tự im lặng khi còn hạn)
      // — không có bước "đăng nhập ví" riêng để báo trước.
      cmd.resolve(true);
      return;
    }
    if (cmd.kind === "sign") {
      const { signature } = await api.solana.signMessage(new TextEncoder().encode(cmd.message));
      cmd.resolve(bs58.encode(signature));
      return;
    }
    // send-usdt — Particles nhận VersionedTransaction trực tiếp, trả base58
    const { buildUnsignedUsdtTransfer } = await import("./solana-transfer");
    const tx = await buildUnsignedUsdtTransfer(
      cmd.payer, cmd.treasury, cmd.mint, cmd.rawAmount,
      resolveSolanaRpc(),
    );
    const { signature } = await api.solana.signAndSendTransaction(tx);
    cmd.resolve(signature);
  } catch (error) {
    cmd.reject(error);
  }
}
