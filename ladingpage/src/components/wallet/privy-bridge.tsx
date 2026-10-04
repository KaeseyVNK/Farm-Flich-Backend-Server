"use client";

/**
 * Bridge Privy — component KHÔNG render gì (return null), đặt BÊN TRONG
 * PrivyProvider. Xử lý command queue bằng hooks Privy Solana (subpath
 * `@privy-io/react-auth/solana` — hooks EVM cùng tên ở index chính KHÔNG dùng):
 *   - connect: connectOrCreateWallet() là VOID → poll useWallets() 250ms tới
 *     khi có ví; quá 3s mà modal không mở và chưa authenticated → user đã
 *     đóng/hủy → WalletConnectCancelledError; 5 phút → timeout.
 *   - sign: message UTF-8 → Uint8Array; chữ ký Uint8Array → base58.
 *   - send-usdt: dựng VersionedTransaction qua solana-transfer (dynamic
 *     import), gửi bản ĐÃ serialize qua signAndSendTransaction → base58.
 *
 * Cơ chế: busyRef chặn drain đồng thời và `.finally` bơm lại effect (`pump`)
 * để lệnh enqueue trong lúc bận không bị kẹt.
 */

import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { usePrivy } from "@privy-io/react-auth";
// /solana subpath — hooks EVM cùng tên ở index chính KHÔNG dùng (ghim probe)
import { useSignAndSendTransaction, useSignMessage, useWallets } from "@privy-io/react-auth/solana";
import bs58 from "bs58";
import { WalletConnectCancelledError, resolveSolanaRpc } from "./adapter";
import {
  drainWalletCommands,
  pendingWalletCommandCount,
  subscribeWalletCommands,
  type WalletCommand,
} from "./commands";

const POLL_MS = 250;
const CONNECT_TIMEOUT_MS = 5 * 60 * 1000;

type BridgeState = {
  privy: ReturnType<typeof usePrivy>;
  wallets: ReturnType<typeof useWallets>["wallets"];
  // hook trả về OBJECT { signMessage(...) } — stateRef giữ METHOD để runCommand
  // gọi trực tiếp `stateRef.current.signMessage({...})` (brief ngầm định vậy).
  signMessage: ReturnType<typeof useSignMessage>["signMessage"];
  signAndSendTransaction: ReturnType<typeof useSignAndSendTransaction>["signAndSendTransaction"];
};

export default function PrivyWalletBridge() {
  const privy = usePrivy();
  const { wallets } = useWallets();
  const { signMessage } = useSignMessage();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const pendingCount = useSyncExternalStore(subscribeWalletCommands, pendingWalletCommandCount);
  const busyRef = useRef(false);
  const [pump, setPump] = useState(0);
  const stateRef = useRef<BridgeState>({ privy, wallets, signMessage, signAndSendTransaction });

  // Cập nhật snapshot hooks mới nhất TRƯỚC khi effect xử lý queue đọc nó
  // (effect cùng commit chạy theo thứ tự khai báo).
  useEffect(() => {
    stateRef.current = { privy, wallets, signMessage, signAndSendTransaction };
  }, [privy, wallets, signMessage, signAndSendTransaction]);

  useEffect(() => {
    if (busyRef.current || pendingCount === 0) return;
    busyRef.current = true;
    const commands = drainWalletCommands();
    void Promise.all(commands.map((cmd) => runCommand(cmd, stateRef))).finally(() => {
      busyRef.current = false;
      setPump((t) => t + 1);
    });
  }, [pendingCount, pump]);

  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Poll tới khi điều kiện đúng / user hủy / hết giờ. */
async function pollUntil(
  predicate: () => { done: boolean; cancelled?: boolean },
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const outcome = predicate();
    if (outcome.done) return;
    if (outcome.cancelled) throw new WalletConnectCancelledError();
    await sleep(POLL_MS);
  }
  throw new Error("wallet request timed out");
}

async function runCommand(cmd: WalletCommand, stateRef: RefObject<BridgeState>): Promise<void> {
  try {
    if (cmd.kind === "connect") {
      const startedAt = Date.now();
      stateRef.current.privy.connectOrCreateWallet(); // void — quan sát bằng poll (ghim #1)
      await pollUntil(() => {
        const current = stateRef.current;
        if (current.privy.ready && current.wallets.length > 0) return { done: true };
        // Sau 3s grace (modal kịp mở): modal đóng + chưa login = user hủy.
        if (Date.now() - startedAt > 3000 && !current.privy.isModalOpen && !current.privy.authenticated) {
          return { done: false, cancelled: true };
        }
        return { done: false };
      }, CONNECT_TIMEOUT_MS);
      const wallet = stateRef.current.wallets[0];
      if (!wallet) throw new Error("no solana wallet after connect");
      cmd.resolve(wallet.address);
      return;
    }
    if (cmd.kind === "connect-silent") {
      cmd.reject(new Error("privy does not support silent JWT connect"));
      return;
    }
    if (cmd.kind === "auth-state") {
      // Phiên Privy riêng với login game — wallet-pay hỏi trước khi connect
      // để hiện bước giải thích thay vì bật modal login bất ngờ.
      cmd.resolve(stateRef.current.privy.authenticated === true);
      return;
    }
    if (cmd.kind === "logout") {
      // Huỷ phiên Privy để lần connect() kế mở CHOOSER (email/Google/ví ngoài)
      // thay vì im lặng trả về đúng ví cũ — đường "Use a different wallet" ở
      // trang login. Embedded wallet vẫn gắn account Privy (email/Google):
      // đăng nhập lại phương thức cũ = lấy lại đúng ví.
      await stateRef.current.privy.logout();
      cmd.resolve();
      return;
    }
    // sign → cmd.address; send-usdt → cmd.payer (chính là ví ký/gửi)
    const walletAddress = cmd.kind === "sign" ? cmd.address : cmd.payer;
    const wallet = stateRef.current.wallets.find((w) => w.address === walletAddress) ?? null;
    if (!wallet) throw new Error("wallet not found for command");
    if (cmd.kind === "sign") {
      // Privy Solana: message Uint8Array → { signature: Uint8Array } → base58
      const { signature } = await stateRef.current.signMessage({
        message: new TextEncoder().encode(cmd.message),
        wallet,
      });
      cmd.resolve(bs58.encode(signature));
      return;
    }
    // send-usdt — SignAndSendTransaction nhận tx ĐÃ SERIALIZE (Uint8Array)
    const { buildUnsignedUsdtTransfer } = await import("./solana-transfer");
    const tx = await buildUnsignedUsdtTransfer(
      cmd.payer, cmd.treasury, cmd.mint, cmd.rawAmount,
      resolveSolanaRpc(),
    );
    const { signature } = await stateRef.current.signAndSendTransaction({
      transaction: tx.serialize(),
      wallet,
      options: { preflightCommitment: "finalized" },
    });
    cmd.resolve(bs58.encode(signature));
  } catch (error) {
    cmd.reject(error);
  }
}
