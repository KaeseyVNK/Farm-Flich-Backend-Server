import type { Metadata } from "next";
import { Footer } from "@/components/landing/footer";
import { Navbar } from "@/components/landing/navbar";
import { LeaderboardView } from "@/components/leaderboard/leaderboard-view";

export const metadata: Metadata = {
  title: "Leaderboard — Farm & Filch",
  description:
    "Farm & Filch's top 10 farmers by Gold and Level. Log in in-game to see where you rank against the whole server.",
};

export default function LeaderboardPage() {
  return (
    <div className="flex min-h-screen flex-col bg-parchment">
      <Navbar />
      <main id="content" tabIndex={-1} className="flex-1 outline-none">
        <div className="mx-auto w-full max-w-4xl px-4 pb-16 pt-28 md:px-6 md:pt-32 md:pb-24">
          <p className="font-display text-sm font-extrabold uppercase tracking-[0.18em] text-meadow-dark">
            Farm &amp; Filch
          </p>
          <h1 className="mt-3 font-display text-4xl font-extrabold leading-none text-ink md:text-6xl">
            Leaderboard
          </h1>
          <p className="mt-4 max-w-2xl text-base font-semibold leading-relaxed text-ink/75 md:text-lg">
            The top 10 players richest in Gold and the top 10 farmers with the
            highest Level. Log in in-game to see "My Rank" against the total
            number of players.
          </p>
          <div className="mt-8">
            <LeaderboardView />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
