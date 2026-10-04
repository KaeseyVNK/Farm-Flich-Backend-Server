"use client";

/**
 * Khu "Pay with Wallet" của trang /buy-cash — Solana qua wallet adapter (spec
 * 2026-10-01-solana-migration; sửa 2026-10-02: USER TRẢ TOÀN BỘ PHÍ):
 *   - Chưa cấu hình → không render (chuyển tay bên dưới là đường dự phòng);
 *   - "Pay with Wallet": hỏi phiên SDK ví trước (Privy chết độc lập với login
 *     game → thẻ "One-time wallet sign-in" có giải thích thay vì modal bất
 *     ngờ) → adapter.connect() → kiểm tra ví khớp binding tài
 *     khoản (logout xong không được dùng ví mới) → pre-check TRƯỚC KHI dựng
 *     lệnh:
 *       1) SOL của ví đủ phí + rent (transaction có kèm lệnh tạo idempotent
 *          ATA đích — treasury chưa có token account USDT thì người gửi trả
 *          ~0.00204 SOL rent; thiếu → panel hướng dẫn nạp SOL vào ví);
 *       2) USDT trong ví đủ số lượng nạp (không có/chưa đủ → panel hướng dẫn
 *          nạp USDT vào ví — root cause 2026-10-02: transferChecked fail
 *          simulate mù mờ trước đây);
 *     không có gas-gift: ví nóng server đã bỏ.
 *   - adapter.sendUsdtTransfer (SPL transferChecked) → signature → parent
 *     POST /deposit/confirm như cũ.
 *   RPC check lỗi (null) → degrade: vẫn cho thử gửi, ví sẽ tự báo thiếu.
 */
import { useCallback, useRef, useState } from "react";
import { Check, Copy, LoaderCircle, Wallet } from "lucide-react";
import {
  WalletConnectCancelledError,
  getWalletAdapter,
  isWalletConfigured,
  resolveSolanaRpc,
} from "@/components/wallet/adapter";
import {
  getSolLamports,
  getTokenAccountSnapshot,
  requiredPayerLamports,
} from "@/components/wallet/solana-transfer";
import {
  getAuthSnapshot,
  isSameWallet,
  walletMismatchMessage,
} from "@/components/auth/session";
import type { DepositInfo } from "./deposit-api";
import { savePendingDeposit, type DepositOwner } from "./pending-deposits";

type WalletPhase = "idle" | "wallet-auth" | "connecting" | "sending" | "sent";

/** Panel hướng dẫn nạp tiền vào ví embedded trước khi gửi lại. */
type FundPanel =
  | {
      kind: "sol";
      address: string;
      lamports: number;
      requiredLamports: number;
      needsAtaSetup: boolean;
    }
  | { kind: "usdt"; address: string; balanceLabel: string | null; neededLabel: string };

const BUSY_PHASES: readonly WalletPhase[] = ["connecting", "sending"];

const payButtonClass =
  "pixel-shadow-hover inline-flex min-h-11 items-center gap-2 border-[3px] border-[#231b18] bg-sun px-4 font-display text-sm font-extrabold text-[#231b18] shadow-[3px_3px_0_#231b18] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f7c948] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none";

function phaseLabel(phase: WalletPhase): string {
  switch (phase) {
    case "connecting":
      return "Opening wallet…";
    case "sending":
      return "Sending transaction…";
    case "sent":
      return "Transaction sent";
    default:
      return "Pay with Wallet";
  }
}

/** raw units (6 decimals) → chuỗi hiển thị kiểu en-US. */
function formatUsdt(raw: bigint): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(Number(raw) / 1e6);
}

export type WalletPaySectionProps = {
  info: DepositInfo;
  /** Lượng USDT đã parse sang raw units (>0, đạt mức tối thiểu). */
  raw: bigint;
  disabled: boolean;
  /** Được gọi với signature ngay khi ví gửi xong → parent tự confirm. */
  onTxHash: (signature: string, owner: DepositOwner & { token: string }, saved: boolean) => void;
};

export function WalletPaySection(props: WalletPaySectionProps) {
  if (!isWalletConfigured()) return null;
  return <WalletPayButton {...props} />;
}

function WalletPayButton({ info, raw, disabled, onTxHash }: WalletPaySectionProps) {
  const [phase, setPhase] = useState<WalletPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [fundPanel, setFundPanel] = useState<FundPanel | null>(null);
  const [copied, setCopied] = useState(false);
  const pending = useRef(false);

  const busy = BUSY_PHASES.includes(phase);

  const pay = useCallback(async (force = false) => {
    if (pending.current || busy || disabled) return;
    if (!info.treasuryAddress || !info.mint) return;
    const initial = getAuthSnapshot();
    const sessionToken = initial.token;
    if (!sessionToken || !initial.playerId || !initial.walletAddress) return;
    const owner = { token: sessionToken, playerId: initial.playerId, walletAddress: initial.walletAddress, network: info.network };
    pending.current = true;
    setError(null);
    setFundPanel(null);
    setPhase("connecting");
    try {
      const adapter = await getWalletAdapter();
      // Phiên SDK ví (Privy) chết độc lập với login game — reload trang hay
      // browser chặn cookie 3rd-party đều giết nó. Hỏi TRƯỚC: false → hiện
      // thẻ giải thích "One-time wallet sign-in" thay vì bật modal bất ngờ
      // (report 2026-10-04: "đã login mà bấm nạp vẫn bắt login").
      if (!force && typeof adapter.isAuthenticated === "function") {
        let authed: boolean | null = null;
        try {
          authed = await adapter.isAuthenticated();
        } catch {
          authed = null; // hỏi lỗi → bỏ qua bước, connect() tự xử lý như cũ
        }
        if (authed === false) {
          setPhase("wallet-auth");
          return;
        }
      }
      const { address } = await adapter.connect();
      // Ràng buộc 2026-10-03: ví kết nối phải đúng ví gắn với tài khoản
      // (ưu tiên binding server từ phiên; fallback binding localStorage sống
      // qua logout) — sai thì chặn, KHÔNG gửi tiền từ ví lạ.
      const linked = getAuthSnapshot().walletAddress;
      if (!linked) {
        setPhase("idle");
        setError("Link this wallet on your account page before sending USDT.");
        return;
      }
      if (!isSameWallet(address, linked)) {
        setPhase("idle");
        setError(walletMismatchMessage(address, linked));
        return;
      }
      setPhase("sending");
      // Quyết định 2026-10-02: user trả toàn bộ phí — pre-check cả 2 điều kiện
      // (SOL cho phí+rent, USDT đủ lượng) thay vì gửi fail mù mờ.
      const rpc = resolveSolanaRpc();
      const [lamports, destSnapshot] = await Promise.all([
        getSolLamports(address, rpc),
        getTokenAccountSnapshot(info.treasuryAddress, info.mint, rpc),
      ]);
      // destSnapshot null (RPC lỗi) → requiredPayerLamports coi như cần tạo
      // ATA (thất bại an toàn: hiện panel nạp SOL thay vì gửi hụt rent).
      const requiredLamports = requiredPayerLamports(
        destSnapshot ? destSnapshot.exists : null,
      );
      if (lamports !== null && lamports < requiredLamports) {
        setPhase("idle");
        setFundPanel({
          kind: "sol",
          address,
          lamports,
          requiredLamports,
          needsAtaSetup: !destSnapshot?.exists,
        });
        return;
      }
      const srcSnapshot = await getTokenAccountSnapshot(address, info.mint, rpc);
      if (
        srcSnapshot &&
        (!srcSnapshot.exists ||
          (srcSnapshot.rawAmount !== null && srcSnapshot.rawAmount < raw))
      ) {
        setPhase("idle");
        setFundPanel({
          kind: "usdt",
          address,
          balanceLabel:
            srcSnapshot.exists && srcSnapshot.rawAmount !== null
              ? formatUsdt(srcSnapshot.rawAmount)
              : null,
          neededLabel: formatUsdt(raw),
        });
        return;
      }
      if (getAuthSnapshot().token !== sessionToken || getAuthSnapshot().walletAddress !== address) {
        setPhase("idle");
        setError("Your account changed. Please reconnect before sending USDT.");
        return;
      }
      const signature = await adapter.sendUsdtTransfer(
        raw,
        { treasury: info.treasuryAddress, mint: info.mint },
        address,
      );
      const saved = savePendingDeposit(owner, signature);
      // Save under the original account even if the wallet modal outlived logout.
      if (getAuthSnapshot().token !== sessionToken) return;
      setPhase("sent");
      onTxHash(signature, owner, saved);
    } catch (error) {
      setPhase("idle");
      setError(
        error instanceof WalletConnectCancelledError
          ? "You closed the wallet window — click again when you're ready, or use the manual transfer below."
          : "The transaction was not sent — your wallet may have rejected the request, or it does not have enough SOL left for the network fee. Top up some SOL if needed, then try again, or use the manual transfer below.",
      );
    } finally { pending.current = false; }
  }, [busy, disabled, info, raw, onTxHash]);

  const copyAddress = useCallback(() => {
    if (!fundPanel) return;
    try {
      // Không có quyền clipboard (http/iframe cũ) — người dùng vẫn copy tay được.
      navigator.clipboard?.writeText(fundPanel.address).then(
        () => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        },
        () => undefined,
      );
    } catch {
      // Trình duyệt cũ không có navigator.clipboard — bỏ qua.
    }
  }, [fundPanel]);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => void pay()}
        disabled={disabled || busy}
        aria-busy={busy}
        className={payButtonClass}
      >
        {busy ? (
          <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        ) : (
          <Wallet className="size-4" aria-hidden="true" />
        )}
        {phaseLabel(phase)}
      </button>
      {error && (
        <p role="alert" className="text-sm font-bold text-destructive">
          {error}
        </p>
      )}
      {phase === "wallet-auth" && (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col gap-2 border-[3px] border-[#231b18] bg-parchment p-3 shadow-[3px_3px_0_#231b18]"
        >
          <p className="text-sm font-bold leading-snug text-ink">
            One-time wallet sign-in needed — your embedded wallet is protected by
            its own email/Google login, which is separate from your game login.
            This browser has lost that wallet session (normal after a page
            reload). Click below and a sign-in window will open; the payment
            continues automatically after you sign in.
          </p>
          <button
            type="button"
            onClick={() => void pay(true)}
            className={payButtonClass}
          >
            <Wallet className="size-4" aria-hidden="true" />
            Sign in and continue payment
          </button>
        </div>
      )}
      {fundPanel?.kind === "sol" && (
        <div
          role="alert"
          className="flex flex-col gap-2 border-[3px] border-[#231b18] bg-parchment p-3 shadow-[3px_3px_0_#231b18]"
        >
          <p className="text-sm font-bold leading-snug text-ink">
            Your wallet does not have enough SOL to pay the network fee
            {fundPanel.needsAtaSetup
              ? " and set up the USDT account for the first time"
              : ""}{" "}
            (~{(fundPanel.requiredLamports / 1e9).toFixed(5)} SOL needed). Transfer some SOL to
            the wallet address below — this is your own embedded wallet, NOT the USDT treasury
            address — then click &quot;Pay with Wallet&quot; again.
          </p>
          <FundAddressRow address={fundPanel.address} copied={copied} onCopy={copyAddress} />
          <p className="text-xs font-semibold text-ink/70">
            Current SOL balance: {(fundPanel.lamports / 1e9).toFixed(9)} SOL
          </p>
        </div>
      )}
      {fundPanel?.kind === "usdt" && (
        <div
          role="alert"
          className="flex flex-col gap-2 border-[3px] border-[#231b18] bg-parchment p-3 shadow-[3px_3px_0_#231b18]"
        >
          <p className="text-sm font-bold leading-snug text-ink">
            This top-up needs {fundPanel.neededLabel} USDT in your wallet, but it{" "}
            {fundPanel.balanceLabel === null
              ? "has never held USDT (no USDT account yet)"
              : `only holds ${fundPanel.balanceLabel} USDT`}
            . Transfer USDT (Solana network) to the wallet address below — this is your own
            embedded wallet, NOT the USDT treasury address — then click
            &quot;Pay with Wallet&quot; again.
          </p>
          <FundAddressRow address={fundPanel.address} copied={copied} onCopy={copyAddress} />
        </div>
      )}
      {phase === "sent" && !error && (
        <p role="status" aria-live="polite" className="text-sm font-bold text-grass-dark">
          Your wallet has sent the transaction — the system is verifying it on-chain; please wait for network confirmation.
        </p>
      )}
    </div>
  );
}

function FundAddressRow({
  address,
  copied,
  onCopy,
}: {
  address: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 break-all font-mono text-sm font-bold text-ink">
        {address}
      </code>
      <button
        type="button"
        onClick={onCopy}
        aria-label="Copy wallet address"
        className="shrink-0 border-2 border-[#231b18] bg-white p-1.5 shadow-[2px_2px_0_#231b18] hover:translate-y-px"
      >
        {copied ? (
          <Check className="size-4 text-grass-dark" aria-hidden="true" />
        ) : (
          <Copy className="size-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
