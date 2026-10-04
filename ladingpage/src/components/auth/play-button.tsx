"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, Play } from "lucide-react";
import { bootAuthFromStorage, launchGame, useAuthSnapshot } from "./session";

export function PlayGameButton({ className, label = "Play Now" }: { className?: string; label?: string }) {
  const auth = useAuthSnapshot();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { bootAuthFromStorage(); }, []);
  if (!auth.token) return <a href="/login" className={className}>{label}</a>;

  async function launch() {
    if (busy) return;
    setBusy(true);
    setError(await launchGame());
    setBusy(false);
  }
  return (
    <span className="inline-flex flex-col gap-1">
      <button type="button" onClick={() => void launch()} disabled={busy} className={className}>
        {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Play className="size-4 fill-current" aria-hidden="true" />}
        {busy ? "Launching…" : label}
      </button>
      {error && <span role="alert" className="max-w-xs text-sm font-bold text-destructive">{error}</span>}
    </span>
  );
}
