"use client";

import { useEffect, useRef, useState } from "react";
import { AccountCard } from "./account-card";
import { LoginForm } from "./login-form";
import { WalletLogin } from "./wallet-login";
import { WalletCard } from "./wallet-card";
import { bootAuthFromStorage, ensureAccountDetails, launchGame, useAuthSnapshot } from "./session";

export function LoginSection() {
  const auth = useAuthSnapshot();
  const autoLaunchStarted = useRef(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { bootAuthFromStorage(); }, []);
  useEffect(() => {
    if (!auth.token) { autoLaunchStarted.current = false; return; }
    void ensureAccountDetails();
    if (new URLSearchParams(window.location.search).get("launch") === "1" && !autoLaunchStarted.current) {
      autoLaunchStarted.current = true;
      void launchGame().then(setError);
    }
  }, [auth.token]);

  if (!auth.ready) return <p role="status" className="font-bold">Checking your session…</p>;
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      {error && <p role="alert" className="font-bold text-destructive">{error}</p>}
      {auth.token ? <><AccountCard /><WalletCard /></> : <><LoginForm /><WalletLogin onAuthed={() => void ensureAccountDetails()} /></>}
    </div>
  );
}
