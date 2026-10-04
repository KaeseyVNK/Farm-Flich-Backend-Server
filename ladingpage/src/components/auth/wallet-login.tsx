"use client";

/**
 * "Đăng nhập bằng ví" — qua wallet adapter (spec 2026-10-01):
 *   adapter.connect() (modal của provider đang chọn) → address
 *   → [binding check] → /auth/wallet-nonce → adapter.signPersonalMessage
 *   → /auth/wallet:
 *     - đã bind → session luôn
 *     - WALLET_NEW_USER → FarmerNamePicker (hoặc quay lại form password để link)
 *
 * Binding check (2026-10-03, chặn MỀM): ví kết nối khác ví lần trước
 * (farmfilch.linkedWallet sống qua logout) → cảnh báo + 2 lối: quay lại,
 * hoặc "Use this wallet anyway" (xoá binding → đăng nhập account của ví này).
 * Chặn CỨNG chỉ nằm ở trang thanh toán (wallet-pay) — trong phiên không bao
 * giờ gửi USDT từ ví lạ.
 *
 * "Use a different wallet" (2026-10-04): Privy còn phiên thì connect() im
 * lặng trả đúng ví cũ — user không bao giờ thấy chooser. Nút này chủ động
 * privy.logout() rồi connect() lại → Privy mở chooser (email/Google/ví ngoài).
 *
 * Chưa cấu hình provider → nút disabled với chú thích (degrade, không crash).
 * Adapter không dùng hooks → component này không cần pattern outer/inner.
 */
import { useState } from "react";
import { LoaderCircle, Wallet } from "lucide-react";
import { GAME_API_BASE_URL } from "@/lib/game-api";
import { FarmerNamePicker } from "./farmer-name-picker";
import { WalletConnectCancelledError, getWalletAdapter, isWalletConfigured } from "@/components/wallet/adapter";
import {
  clearLinkedWallet,
  getAuthRevision,
  isSameWallet,
  loginWithWallet,
  readLinkedWallet,
  walletMismatchNotice,
} from "./session";

type Phase =
  | { kind: "idle" }
  | { kind: "busy"; step: string }
  | { kind: "mismatch"; address: string; linked: string }
  | { kind: "pick"; address: string; signature: string; suggestedName: string };

export function WalletLogin({ onAuthed }: { onAuthed: () => void }) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);

  /** nonce → ký → /auth/wallet. Dùng chung cho flow thường và "use anyway". */
  const signIn = async (address: string) => {
    const revision = getAuthRevision();
    setError(null);
    try {
      setPhase({ kind: "busy", step: "Requesting a verification code from the server…" });
      const nonceRes = await fetch(`${GAME_API_BASE_URL}/auth/wallet-nonce`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Client-Version": "4" },
        body: JSON.stringify({ address, purpose: "login" }),
        signal: AbortSignal.timeout(15000),
      });
      const nonceBody = (await nonceRes.json()) as { ok?: boolean; message?: string; error?: string };
      if (!nonceRes.ok || !nonceBody.ok || !nonceBody.message) {
        throw new Error(nonceBody.error ?? "nonce failed");
      }

      const adapter = await getWalletAdapter();
      setPhase({ kind: "busy", step: "Please approve the signature in your wallet…" });
      const signature = await adapter.signPersonalMessage(address, nonceBody.message);
      if (getAuthRevision() !== revision) throw new Error("Account changed during wallet verification.");

      setPhase({ kind: "busy", step: "Verifying your signature…" });
      const result = await loginWithWallet(address, signature);
      if (result.ok) {
        onAuthed();
        return;
      }
      if ("code" in result) {
        // Nhánh WALLET_NEW_USER (duy nhất có `code` trong union).
        setPhase({ kind: "pick", address, signature, suggestedName: result.suggestedName });
        return;
      }
      setError(result.error);
    } catch {
      setError("Wallet login didn't complete — please try again.");
    }
    setPhase({ kind: "idle" });
  };

  const run = async () => {
    const revision = getAuthRevision();
    setError(null);
    try {
      setPhase({ kind: "busy", step: "Opening your wallet…" });
      const adapter = await getWalletAdapter();
      const { address } = await adapter.connect();
      if (getAuthRevision() !== revision) throw new Error("Account changed during wallet connection.");

      // Guardrail 2026-10-03 (mềm): ví khác lần trước → cảnh báo, user chọn.
      const linked = readLinkedWallet();
      if (linked && !isSameWallet(address, linked)) {
        setPhase({ kind: "mismatch", address, linked });
        return;
      }
      await signIn(address);
    } catch (error) {
      setPhase({ kind: "idle" });
      if (error instanceof WalletConnectCancelledError) {
        setError("You closed the wallet window — try again when you're ready.");
      } else {
        setError("Couldn't open your wallet — please try again.");
      }
    }
  };

  /** "Use a different wallet": huỷ phiên Privy (connect() kế sẽ mở chooser
   *  email/Google/ví ngoài thay vì im lặng trả về đúng ví cũ) rồi connect. */
  const chooseDifferentWallet = async () => {
    setError(null);
    setPhase({ kind: "busy", step: "Opening the wallet chooser…" });
    try {
      const adapter = await getWalletAdapter();
      await adapter.logout?.();
    } catch {
      // logout fail (đã logout sẵn/chưa từng connect) — vẫn thử connect tiếp.
    }
    await run();
  };

  if (phase.kind === "pick") {
    return (
      <FarmerNamePicker
        address={phase.address}
        signature={phase.signature}
        suggestedName={phase.suggestedName}
        onAuthed={onAuthed}
        onBackToPassword={() => setPhase({ kind: "idle" })}
      />
    );
  }

  if (phase.kind === "mismatch") {
    return (
      <div className="flex flex-col gap-3" role="alert">
        <p className="text-sm font-bold leading-snug text-destructive">
          {walletMismatchNotice(phase.address, phase.linked)}
        </p>
        <button
          type="button"
          onClick={() => {
            clearLinkedWallet();
            void signIn(phase.address);
          }}
          className="pixel-shadow-hover inline-flex min-h-11 items-center justify-center gap-2 border-[3px] border-[#231b18] bg-sun px-4 font-display text-sm font-extrabold text-[#231b18] shadow-[3px_3px_0_#231b18]"
        >
          <Wallet className="size-4" aria-hidden="true" />
          Use this wallet anyway
        </button>
        <button
          type="button"
          onClick={() => setPhase({ kind: "idle" })}
          className="inline-flex min-h-11 items-center justify-center border-[3px] border-[#231b18] bg-white px-4 font-display text-sm font-extrabold text-[#231b18] shadow-[3px_3px_0_#231b18]"
        >
          Go back
        </button>
      </div>
    );
  }

  const busy = phase.kind === "busy";
  const configured = isWalletConfigured();

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => void run()}
        disabled={busy || !configured}
        title={configured ? undefined : "Wallet sign-in is not available yet"}
        className="pixel-shadow-hover inline-flex min-h-11 w-full items-center justify-center gap-2 border-[3px] border-[#231b18] bg-sun px-4 font-display text-sm font-extrabold text-[#231b18] shadow-[3px_3px_0_#231b18] disabled:opacity-60"
      >
        {busy ? (
          <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        ) : (
          <Wallet className="size-4" aria-hidden="true" />
        )}
        {busy ? phase.step : configured ? "Log in with wallet" : "Log in with wallet (not configured)"}
      </button>
      {!busy && configured && (
        <button
          type="button"
          onClick={() => void chooseDifferentWallet()}
          className="inline-flex min-h-9 items-center justify-center text-xs font-bold text-ink/70 underline decoration-2 underline-offset-4 hover:text-ink"
        >
          Use a different wallet
        </button>
      )}
      {error && <p className="text-sm font-bold text-destructive">{error}</p>}
    </div>
  );
}
