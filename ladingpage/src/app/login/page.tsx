import type { Metadata } from "next";
import { Footer } from "@/components/landing/footer";
import { Navbar } from "@/components/landing/navbar";
import { LoginSection } from "@/components/auth/login-section";

export const metadata: Metadata = {
  title: "Log In — Farm & Filch",
  description:
    "Log in to your Farm & Filch game account and launch your farm.",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col bg-parchment">
      <Navbar />
      <main id="content" tabIndex={-1} className="flex-1 outline-none">
        <div className="mx-auto w-full max-w-4xl px-4 pb-16 pt-28 md:px-6 md:pt-32 md:pb-24">
          <p className="font-display text-sm font-extrabold uppercase tracking-[0.18em] text-meadow-dark">
            Farm &amp; Filch
          </p>
          <h1 className="mt-3 font-display text-4xl font-extrabold leading-none text-ink md:text-6xl">
            Log In
          </h1>
          <p className="mt-4 max-w-2xl text-base font-semibold leading-relaxed text-ink/75 md:text-lg">
            Log in with your game account, then launch your farm. Your existing progress stays with your account.
          </p>
          <div className="mt-8">
            <LoginSection />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
