"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getWalletAdapter, isWalletConfigured, resolveWalletProviderId } from "@/components/wallet/adapter";
import { ensureAccountDetails, gameApiFetch, getAuthSnapshot, useAuthSnapshot } from "./session";

export function WalletCard() {
  const auth = useAuthSnapshot();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const autoStarted = useRef<string | null>(null);
  const linkWallet = useCallback(async (silent = false) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true); setError(null);
    const token = auth.token;
    try {
      const adapter = await getWalletAdapter();
      let address: string;
      if (silent) {
        if (!adapter.supportsSilentLink || !adapter.connectSilent) return;
        const jwt = await gameApiFetch("/auth/particles-token", { body: {} });
        if (getAuthSnapshot().token !== token) throw new Error("Your account changed. Please log in again.");
        if (jwt.status !== 200 || typeof jwt.body?.jwt !== "string") throw new Error("Automatic wallet linking is not available. Use Connect Wallet below.");
        ({ address } = await adapter.connectSilent(jwt.body.jwt));
      } else {
        ({ address } = await adapter.connect());
      }
      if (getAuthSnapshot().token !== token) throw new Error("Your account changed. Please log in again.");
      const nonce = await gameApiFetch("/auth/wallet-nonce", { body: { address, purpose: "link" } });
      if (nonce.status !== 200 || nonce.body?.ok !== true || typeof nonce.body.message !== "string") throw new Error("Could not request wallet verification.");
      const signature = await adapter.signPersonalMessage(address, nonce.body.message);
      if (getAuthSnapshot().token !== token) throw new Error("Your account changed. Please log in again.");
      const result = await gameApiFetch("/auth/link-wallet", { body: { address, signature } });
      if (result.status !== 200 || result.body?.ok !== true) throw new Error(typeof result.body?.error === "string" ? result.body.error : "This wallet cannot be linked to your account.");
      await ensureAccountDetails();
    } catch (err) { setError(err instanceof Error ? err.message : "Wallet linking failed. Please try again."); }
    finally { pending.current = false; setBusy(false); }
  }, [auth.token]);
  useEffect(() => {
    if (!auth.token || auth.walletAddress || autoStarted.current === auth.token || !isWalletConfigured() || resolveWalletProviderId() !== "particles") return;
    autoStarted.current = auth.token;
    void linkWallet(true);
  }, [auth.token, auth.walletAddress, linkWallet]);
  return <div className="pixel-border flex flex-col gap-3 bg-[#fffcf0] p-6">
    <h3 className="font-display text-lg font-extrabold">Wallet</h3>
    <p className="break-all font-mono text-sm">{auth.walletAddress ?? "No wallet linked"}</p>
    {error && <p role="alert" className="font-bold text-destructive">{error}</p>}
    {!auth.walletAddress && (isWalletConfigured() ?
      <button type="button" disabled={busy} onClick={() => void linkWallet()} className="min-h-11 border-[3px] border-ink bg-sun p-2 font-bold disabled:opacity-60">{busy ? "Verifying wallet…" : "Connect Wallet"}</button> :
      <p className="text-sm">Wallet sign-in is not configured yet. You can still launch the game.</p>)}
  </div>;
}
