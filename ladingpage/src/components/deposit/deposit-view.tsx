"use client";

/**
 * Nội dung trang /buy-cash — nạp Cash bằng USDT (tỉ giá lấy từ /deposit/info,
 * kỳ vọng 1 USDT = 10 Cash):
 *   1. Chưa đăng nhập → thẻ mời sang /login (Cash gắn với tài khoản game).
 *   2. Đã đăng nhập → thông tin treasury/network từ GET /deposit/info, form số
 *      USDT với preview số Cash (toán BigInt, floor như server), 2 đường đi:
 *      a) "Nạp bằng ví" — ví embedded gửi SPL transferChecked USDT (wallet
 *      adapter) (wallet-pay.tsx);
 *      b) Chuyển tay — địa chỉ treasury + hướng dẫn + ô dán signature.
 *   3. Có signature → POST /deposit/confirm (idempotent theo signature) → panel
 *      kết quả, lỗi tạm thời có nút "Kiểm tra lại" (poll thủ công là đủ).
 */

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  LoaderCircle,
  LogIn,
  RefreshCw,
} from "lucide-react";
import {
  bootAuthFromStorage,
  ensureAccountDetails,
  getAuthSnapshot,
  useAuthSnapshot,
} from "@/components/auth/session";
import { isWalletConfigured } from "@/components/wallet/adapter";
import {
  confirmDeposit,
  fetchDepositInfo,
  type ConfirmDepositResult,
  type DepositInfo,
} from "./deposit-api";
import {
  isValidSignature,
  parseUsdtToRaw,
  rawMeetsMinimum,
  rawToCash,
} from "./usdt-amount";
import { WalletPaySection } from "./wallet-pay";
import { readPendingDeposits, savePendingDeposit, removePendingDeposit, type DepositOwner } from "./pending-deposits";

const cardClass =
  "pixel-border flex flex-col gap-4 bg-[#fffcf0] p-6 shadow-[4px_4px_0_#231b18] md:p-8";

const primaryButtonClass =
  "pixel-shadow-hover inline-flex min-h-11 items-center justify-center gap-2 border-[3px] border-[#231b18] bg-sun px-5 font-display text-sm font-extrabold text-[#231b18] shadow-[3px_3px_0_#231b18] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f7c948] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none";

const retryButtonClass =
  "pixel-shadow-hover inline-flex min-h-11 items-center gap-2 border-[3px] border-[#231b18] bg-[#fffcf0] px-4 font-display text-sm font-extrabold text-[#231b18] shadow-[3px_3px_0_#231b18] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f7c948]";

const inputClass =
  "pixel-border-sm h-12 w-full rounded-md bg-white px-3 text-base font-semibold text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring";

export function DepositView() {
  const auth = useAuthSnapshot();
  const [info, setInfo] = useState<DepositInfo | null>(null);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [infoTick, setInfoTick] = useState(0);
  const [amount, setAmount] = useState("");
  const [txHash, setTxHash] = useState("");
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmResult, setConfirmResult] = useState<ConfirmDepositResult | null>(null);
  const [copied, setCopied] = useState(false);
  const confirmInFlightRef = useRef<string | null>(null);
  const [pending, setPending] = useState<string[]>([]);
  const [storageWarning, setStorageWarning] = useState(false);

  useEffect(() => {
    const owner = auth.playerId && auth.walletAddress && info?.network
      ? { playerId: auth.playerId, walletAddress: auth.walletAddress, network: info.network } : null;
    const values = owner ? readPendingDeposits(owner) : [];
    setPending(values);
    setTxHash(values[0] ?? "");
    setConfirmResult(null);
    setConfirmBusy(false);
    setStorageWarning(false);
    confirmInFlightRef.current = null;
  }, [auth.token, auth.playerId, auth.walletAddress, info?.network]);

  // Boot phiên từ localStorage + nạp wallet/Cash 1 lần (như LoginSection).
  useEffect(() => {
    bootAuthFromStorage();
    void ensureAccountDetails();
  }, []);

  // GET /deposit/info là public — fetch cả khi chưa đăng nhập để hiện tỉ giá.
  useEffect(() => {
    let cancelled = false;
    fetchDepositInfo().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setInfo(result.info);
        setInfoError(null);
      } else {
        setInfoError(result.error);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [infoTick]);

  const rawAmount = info ? parseUsdtToRaw(amount, info.decimals) : null;
  const amountPositive = rawAmount !== null && rawAmount > BigInt(0);
  const meetsMinimum =
    rawAmount !== null && info ? rawMeetsMinimum(rawAmount, info.minUsdt, info.decimals) : false;
  const previewCash =
    rawAmount !== null && info && amountPositive
      ? rawToCash(rawAmount, info.rate, info.decimals)
      : null;
  const signatureValid = isValidSignature(txHash);

  const submitConfirm = useCallback(
    async (hash: string) => {
      // Tài khoản nhận Cash lấy từ phiên Bearer phía server — client chỉ cần đã đăng nhập.
      const current = getAuthSnapshot();
      if (!auth.token || current.token !== auth.token || !current.playerId || !current.walletAddress || !info?.network || confirmInFlightRef.current) return;
      const owner = { playerId: current.playerId, walletAddress: current.walletAddress, network: info.network };
      const token = auth.token;
      setConfirmResult(null);
      if (!isValidSignature(hash)) {
        setConfirmResult({
          ok: false,
          message: "Transaction signature format is invalid — it must be a base58 string of 64–88 characters.",
          retryable: false,
          confirmations: null,
          requiredConfirmations: null,
        });
        return;
      }
      setStorageWarning(!savePendingDeposit(owner, hash.trim()));
      setPending(readPendingDeposits(owner));
      confirmInFlightRef.current = token;
      setConfirmBusy(true);
      try {
        const result = await confirmDeposit(hash.trim());
        if (result.ok) removePendingDeposit(owner, hash.trim());
        if (getAuthSnapshot().token !== token) return;
        setPending(readPendingDeposits(owner));
        setConfirmResult(result);
        if (result.ok) await ensureAccountDetails();
      } finally {
        if (confirmInFlightRef.current === token) {
          confirmInFlightRef.current = null;
          if (getAuthSnapshot().token === token) setConfirmBusy(false);
        }
      }
    },
    [auth.token, info?.network],
  );

  // Ví embedded vừa gửi xong → điền signature và tự động xác minh/cộng Cash.
  const handleWalletTxHash = useCallback(
    (hash: string, owner: DepositOwner & { token: string }, saved: boolean) => {
      if (getAuthSnapshot().token !== owner.token || getAuthSnapshot().playerId !== owner.playerId) return;
      setStorageWarning(!saved);
      setTxHash(hash);
      void submitConfirm(hash);
    },
    [submitConfirm],
  );

  const copyTreasury = useCallback(() => {
    const address = info?.treasuryAddress;
    if (!address) return;
    try {
      navigator.clipboard
        .writeText(address)
        .then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        })
        .catch(() => {
          // Không có quyền clipboard — người dùng vẫn copy thủ công được.
        });
    } catch {
      // Trình duyệt cũ không có navigator.clipboard — bỏ qua.
    }
  }, [info?.treasuryAddress]);

  // ── Chưa đăng nhập: mời sang /login trước (yêu cầu functional #4). ──
  if (!auth.token) {
    return (
      <div className={`${cardClass} mx-auto w-full max-w-xl text-center`} aria-live="polite">
        <LogIn className="mx-auto size-10 text-[#c98219]" aria-hidden="true" />
        <h2 className="font-display text-2xl font-extrabold text-ink">
          Log in to top up Cash
        </h2>
        <p className="text-sm font-semibold leading-relaxed text-ink/70">
          Topped-up Cash is tied to your game account, so this page needs its
          own login — the session inside the game doesn't carry over here.
          Log in once below and you'll come straight back.
        </p>
        <p className="text-sm font-bold text-meadow-dark">
          Use your game username and password, or log in with your wallet.
        </p>
        {info?.enabled && (
          <p className="text-sm font-bold text-meadow-dark">
            Current rate: 1 USDT = {info.rate} Cash · {info.network} network
          </p>
        )}
        <div>
          <Link
            href="/login?redirect=/buy-cash"
            className={`${primaryButtonClass} w-full sm:w-auto`}
          >
            <LogIn className="size-4" aria-hidden="true" />
            Log in now
          </Link>
        </div>
      </div>
    );
  }

  // ── Đã đăng nhập ──
  return (
    <div className="flex flex-col gap-6">
      {!auth.walletAddress && <p role="status" className="pixel-border-sm bg-white p-4 font-bold">Link your wallet on the <Link href="/login" className="underline">account page</Link> before transferring USDT. Only transfers from that wallet can be credited.</p>}
      {infoError && (
        <div className={`${cardClass} items-center text-center`} aria-live="polite">
          <AlertTriangle className="size-9 text-[#b93d35]" aria-hidden="true" />
          <p className="text-base font-bold text-ink">{infoError}</p>
          <button
            type="button"
            onClick={() => setInfoTick((tick) => tick + 1)}
            className={retryButtonClass}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Try again
          </button>
        </div>
      )}

      {!infoError && !info && (
        <div className={`${cardClass} items-center text-center`} aria-live="polite">
          <LoaderCircle
            className="size-8 animate-spin text-[#c98219] motion-reduce:animate-none"
            aria-hidden="true"
          />
          <p className="text-base font-bold text-ink">Loading top-up information…</p>
        </div>
      )}

      {info && !info.enabled && (
        <div className={`${cardClass} items-center text-center`} aria-live="polite">
          <AlertTriangle className="size-9 text-[#c98219]" aria-hidden="true" />
          <h2 className="font-display text-2xl font-extrabold text-ink">
            Cash top-up is not available yet
          </h2>
          <p className="text-sm font-semibold leading-relaxed text-ink/70">
            The game server has not configured a USDT treasury address yet.
            Please check back later — nothing else about your account is
            affected.
          </p>
        </div>
      )}

      {info && info.enabled && (
        <>
          {storageWarning && <p role="alert" className={cardClass}>This browser could not save the transaction. Copy the signature below before leaving; you can confirm it later from your wallet history.</p>}
          {pending.length > 0 && <section className={cardClass} aria-label="Pending top-ups">
            <h2 className="font-display text-xl font-bold">Pending top-ups</h2>
            <p>These transfers are waiting for verification. Select one and confirm it again; this does not send more USDT.</p>
            {pending.map(signature => <button key={signature} type="button" disabled={confirmBusy} onClick={() => setTxHash(signature)} className="break-all text-left font-mono text-sm underline">{signature}</button>)}
          </section>}
          {/* Card 1 — thông tin nạp từ /deposit/info */}
          <section className={cardClass} aria-labelledby="deposit-info-heading">
            <div>
              <h2 id="deposit-info-heading" className="font-display text-xl font-extrabold text-ink">
                Top-up information
              </h2>
              <p className="mt-1 font-display text-3xl font-extrabold text-meadow-dark">
                1 USDT = {info.rate} Cash
              </p>
              {auth.cashMilli !== null && (
                <p className="mt-1 text-sm font-bold text-ink/70">
                  Your current balance: {(auth.cashMilli / 1000).toFixed(3)} Cash
                </p>
              )}
            </div>

            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex flex-col gap-1">
                <dt className="font-extrabold uppercase tracking-wide text-ink/60">
                  USDT treasury address — {info.network} network
                </dt>
                <dd className="flex flex-wrap items-center gap-2">
                  <code className="min-w-0 flex-1 break-all font-mono text-sm font-bold text-ink">
                    {info.treasuryAddress}
                  </code>
                  <button
                    type="button"
                    onClick={copyTreasury}
                    className="pixel-shadow-hover inline-flex min-h-11 shrink-0 items-center gap-2 border-[3px] border-[#231b18] bg-[#fffcf0] px-3 font-display text-xs font-extrabold text-[#231b18] shadow-[3px_3px_0_#231b18] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f7c948]"
                  >
                    <Copy className="size-4" aria-hidden="true" />
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </dd>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-1 font-semibold text-ink/70">
                <div>
                  <dt className="inline font-extrabold text-ink">Token: </dt>
                  <dd className="inline font-mono text-xs" title={info.mint}>
                    USDT (mint {info.mint.slice(0, 8)}…{info.mint.slice(-6)})
                  </dd>
                </div>
                <div>
                  <dt className="inline font-extrabold text-ink">Minimum: </dt>
                  <dd className="inline">{info.minUsdt} USDT</dd>
                </div>
                <div>
                  <dt className="inline font-extrabold text-ink">Confirmation: </dt>
                  <dd className="inline">
                    network commits at {info.commitment === "finalized" ? "finalized" : "confirmed"}
                  </dd>
                </div>
              </div>
            </dl>
          </section>

          {/* Card 2 — số USDT + 2 đường nạp + xác nhận */}
          <section className={cardClass} aria-labelledby="deposit-form-heading">
            <div>
              <h2 id="deposit-form-heading" className="font-display text-xl font-extrabold text-ink">
                USDT amount to top up
              </h2>
              <div className="mt-3 flex flex-col gap-2">
                <label htmlFor="deposit-amount" className="text-sm font-extrabold text-ink">
                  USDT amount
                </label>
                <input
                  id="deposit-amount"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  inputMode="decimal"
                  autoComplete="off"
                  maxLength={24}
                  placeholder={`Minimum ${info.minUsdt}`}
                  className={inputClass}
                />
                {amount.trim() !== "" && !amountPositive && (
                  <p role="alert" className="text-sm font-bold text-destructive">
                    Invalid USDT amount — only digits and a decimal point are allowed.
                  </p>
                )}
                {amountPositive && !meetsMinimum && (
                  <p role="alert" className="text-sm font-bold text-destructive">
                    Minimum {info.minUsdt} USDT per top-up.
                  </p>
                )}
                {previewCash !== null && meetsMinimum && (
                  <p role="status" aria-live="polite" className="font-display text-lg font-extrabold text-meadow-dark">
                    You receive ≈ {previewCash} Cash
                  </p>
                )}
              </div>
            </div>

            {isWalletConfigured() ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-extrabold text-ink">Option 1 — Pay with your embedded wallet</p>
                <WalletPaySection
                  info={info}
                  raw={rawAmount ?? BigInt(0)}
                  disabled={!amountPositive || !meetsMinimum || previewCash === null || !auth.walletAddress || confirmBusy}
                  onTxHash={handleWalletTxHash}
                  key={`${auth.token}:${auth.playerId}:${auth.walletAddress}:${info.network}`}
                />
              </div>
            ) : null}

            <div className="flex flex-col gap-3">
              <p className="text-sm font-extrabold text-ink">
                {isWalletConfigured() ? "Option 2 —" : ""} Manual transfer from a personal wallet (Phantom, Solflare…)
              </p>
              <ol className="list-decimal space-y-1 pl-5 text-sm font-semibold leading-relaxed text-ink/75">
                <li>
                  Open your wallet on the <strong className="text-ink">{info.network}</strong> network.
                </li>
                <li>
                  Send exactly the <strong className="text-ink">USDT</strong> token to the
                  treasury address above (copy it to avoid typos), minimum {info.minUsdt} USDT.
                </li>
                <li>Copy the transaction signature from your wallet/explorer and paste it into the field below.</li>
              </ol>
              <p role="note" className="text-sm font-bold text-[#c98219]">
                Only top up from a personal wallet (Phantom, Solflare…). If you withdraw USDT from
                an exchange (Binance, OKX…), the transaction may take a different form, so the
                server may not detect it automatically and no Cash will be credited — transfer the
                USDT to a personal wallet first, then top up.
              </p>
              <div className="flex flex-col gap-2">
                <label htmlFor="deposit-txhash" className="text-sm font-extrabold text-ink">
                  Transaction signature
                </label>
                <input
                  id="deposit-txhash"
                  value={txHash}
                  onChange={(event) => setTxHash(event.target.value)}
                  placeholder="base58 signature…"
                  autoComplete="off"
                  spellCheck={false}
                  className={`${inputClass} font-mono text-sm`}
                />
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => void submitConfirm(txHash)}
                  disabled={confirmBusy || !signatureValid || !auth.walletAddress}
                  aria-busy={confirmBusy}
                  className={`${primaryButtonClass} w-full sm:w-auto`}
                >
                  {confirmBusy ? (
                    <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  ) : null}
                  {confirmBusy ? "Checking transaction…" : "Confirm top-up"}
                </button>
              </div>
              {confirmBusy && (
                <p role="status" aria-live="polite" className="text-sm font-bold text-ink/70">
                  The server is reading on-chain data and crediting Cash — this can take up to a minute.
                </p>
              )}
            </div>
          </section>

          {/* Panel kết quả confirm */}
          {confirmResult && !confirmBusy && (
            <div aria-live="polite">
              {confirmResult.ok ? (
                <div className={`${cardClass} items-center text-center`}>
                  <CheckCircle2 className="size-10 text-meadow-dark" aria-hidden="true" />
                  <h2 className="font-display text-2xl font-extrabold text-ink">
                    Top-up successful: +{confirmResult.credited} Cash
                  </h2>
                  <p className="text-sm font-bold text-ink/70">
                    New balance: {confirmResult.cash} Cash
                    {confirmResult.usdtAmount ? ` · Received ${confirmResult.usdtAmount} USDT` : ""}
                  </p>
                  {confirmResult.alreadyCredited && (
                    <p className="text-sm font-semibold text-ink/60">
                      This transaction was already credited earlier — the system will not credit it again.
                    </p>
                  )}
                </div>
              ) : (
                <div className={`${cardClass} items-center text-center`}>
                  <AlertTriangle className="size-10 text-[#b93d35]" aria-hidden="true" />
                  <p className="max-w-lg text-base font-bold text-ink" role="alert">
                    {confirmResult.message}
                  </p>
                  {confirmResult.retryable && (
                    <button
                      type="button"
                      onClick={() => void submitConfirm(txHash)}
                      className={retryButtonClass}
                    >
                      <RefreshCw className="size-4" aria-hidden="true" />
                      Check again
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
