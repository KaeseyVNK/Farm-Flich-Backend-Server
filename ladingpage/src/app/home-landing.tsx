import { Navbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { World } from "@/components/landing/features";
import { CoreGameplay, Trailer } from "@/components/landing/gameplay";
import { Items } from "@/components/landing/collect";
import { Footer } from "@/components/landing/footer";

export function HomeLanding() {
  return (
    <div className="flex min-h-screen flex-col bg-parchment">
      <Navbar />
      <main id="content" tabIndex={-1} className="flex-1 outline-none">
        <Hero />
        <CoreGameplay />
        <World />
        <Trailer />
        <Items />
      </main>
      <Footer />
    </div>
  );
}
