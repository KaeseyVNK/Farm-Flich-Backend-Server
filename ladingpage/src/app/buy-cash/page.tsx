import type { Metadata } from "next";
import { Footer } from "@/components/landing/footer";
import { Navbar } from "@/components/landing/navbar";
import { DepositView } from "@/components/deposit/deposit-view";

export const metadata: Metadata = {
  title: "Top Up Cash — Farm & Filch",
  description:
    "Top up your farm's Cash for Farm & Filch with USDT on Solana: 1 USDT = 10 Cash. Send from your embedded wallet or by manual transfer, then paste the transaction signature for verification.",
};

export default function DepositPage() {
  return (
    <div className="flex min-h-screen flex-col bg-parchment">
      <Navbar />
      <main id="content" tabIndex={-1} className="flex-1 outline-none">
        <div className="mx-auto w-full max-w-4xl px-4 pb-16 pt-28 md:px-6 md:pt-32 md:pb-24">
          <p className="font-display text-sm font-extrabold uppercase tracking-[0.18em] text-meadow-dark">
            Farm &amp; Filch
          </p>
          <h1 className="mt-3 font-display text-4xl font-extrabold leading-none text-ink md:text-6xl">
            Top Up Cash
          </h1>
          <p className="mt-4 max-w-2xl text-base font-semibold leading-relaxed text-ink/75 md:text-lg">
            Top up your farm's Cash with USDT: our server verifies the on-chain
            transaction and credits Cash straight to your account. The exchange
            rate and receiving address below are read directly from the game
            server.
          </p>
          <div className="mt-8">
            <DepositView />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
