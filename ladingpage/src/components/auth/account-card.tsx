"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import { logout, useAuthSnapshot } from "./session";
import { PlayGameButton } from "./play-button";

export function AccountCard() {
  const auth = useAuthSnapshot();
  return (
    <div className="pixel-border flex flex-col gap-4 bg-[#fffcf0] p-6 shadow-[4px_4px_0_#231b18] md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-sm font-extrabold uppercase tracking-[0.18em] text-meadow-dark">Account</p>
          <h2 className="mt-1 break-all font-display text-2xl font-extrabold text-ink">{auth.username}</h2>
        </div>
        <button type="button" onClick={() => void logout()} className="inline-flex min-h-11 items-center gap-2 border-[3px] border-[#231b18] bg-[#fffcf0] px-4 font-display text-sm font-extrabold shadow-[3px_3px_0_#231b18] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
          <LogOut className="size-4" aria-hidden="true" />Log out
        </button>
      </div>
      <dl className="pixel-border-sm bg-parchment px-4 py-3">
        <dt className="text-xs font-extrabold uppercase tracking-wide text-ink/60">Cash</dt>
        <dd className="font-mono text-sm font-bold text-ink">{auth.cashMilli === null ? "Unavailable" :
          (auth.cashMilli / 1000).toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</dd>
      </dl>
      <div className="flex gap-4 font-bold"><Link href="/buy-cash" className="underline">Top Up Cash</Link><Link href="/leaderboard" className="underline">Leaderboard</Link></div>
      <PlayGameButton label="Launch Game" className="inline-flex min-h-12 items-center justify-center gap-2 border-[3px] border-[#231b18] bg-sun px-5 font-display text-lg font-extrabold shadow-[3px_3px_0_#231b18] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 disabled:opacity-60" />
    </div>
  );
}
