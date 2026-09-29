import Image from "next/image";
import { MessageCircle, Play, Twitter } from "lucide-react";
import { EXTERNAL_LINKS } from "@/lib/landing-content";

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-[#f7edcf] pt-[72px] text-[#231b18]">
      <div className="absolute inset-x-0 top-0 h-[58%] bg-[#e5a53b]" aria-hidden="true" />
      <div className="absolute right-0 top-0 hidden h-full w-[46%] border-l-[5px] border-[#231b18] bg-[#181b31] md:block" aria-hidden="true" />
      <div className="absolute right-[12%] top-32 hidden size-20 rounded-full bg-[#f7c948] shadow-[0_0_0_5px_#231b18] md:block md:size-28" aria-hidden="true" />
      <div className="relative mx-auto grid min-h-[calc(100svh-72px)] max-w-6xl items-center gap-8 px-4 py-12 md:grid-cols-[.9fr_1.1fr] md:px-6 md:py-16 lg:gap-14">
        <div className="relative z-10 max-w-xl">
          <p className="inline-flex border-[3px] border-[#231b18] bg-[#f7edcf] px-3 py-2 text-xs font-extrabold tracking-[0.14em] text-[#231b18] shadow-[3px_3px_0_#231b18]">PRE-BETA IS NOW LIVE</p>
          <h1 className="mt-6 font-display text-5xl font-extrabold leading-[.94] tracking-tight text-[#231b18] sm:text-6xl lg:text-7xl">Grow. <span className="text-[#315b35]">Guard.</span>{" "}<span className="text-[#741f1b]">Filch.</span></h1>
          <p className="mt-6 max-w-lg text-base font-bold leading-relaxed text-[#3e2c25] md:text-lg">Build the farm you have always wanted, protect every hard-won harvest, and keep one eye on the neighbors—because they may come looking to steal it.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href={EXTERNAL_LINKS.play} className="inline-flex min-h-12 items-center justify-center gap-2 border-[4px] border-[#231b18] bg-[#f7c948] px-5 font-display text-lg font-extrabold text-[#231b18] shadow-[4px_4px_0_#231b18] transition-transform hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#231b18]"><Play className="size-5 fill-current" aria-hidden="true" />Play Now</a>
            <a href="#trailer" className="inline-flex min-h-12 items-center justify-center gap-2 border-[4px] border-[#231b18] bg-[#f7edcf] px-5 font-display text-lg font-extrabold text-[#231b18] shadow-[4px_4px_0_#231b18] transition-transform hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#231b18]">See Game Preview</a>
          </div>
          <p className="mt-7 border-y-[3px] border-[#231b18] py-3 text-sm font-extrabold uppercase tracking-wide md:text-base">Free to play <span aria-hidden="true">·</span> Browser-based <span aria-hidden="true">·</span> No download required</p>
          <div className="mt-5 flex items-center gap-3"><span className="text-xs font-extrabold uppercase tracking-wider">Join the plot</span><a href={EXTERNAL_LINKS.x} target="_blank" rel="noopener noreferrer" aria-label="Farm & Filch on X" className="flex size-11 items-center justify-center border-[3px] border-[#231b18] bg-[#f7edcf] hover:bg-[#f7c948] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#231b18]"><Twitter className="size-5" aria-hidden="true" /></a><a href={EXTERNAL_LINKS.discord} target="_blank" rel="noopener noreferrer" aria-label="Farm & Filch on Discord" className="flex size-11 items-center justify-center border-[3px] border-[#231b18] bg-[#f7edcf] hover:bg-[#f7c948] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#231b18]"><MessageCircle className="size-5" aria-hidden="true" /></a></div>
        </div>
        <div className="relative z-10 md:translate-y-8"><div className="absolute -left-3 -top-3 h-12 w-12 border-l-[5px] border-t-[5px] border-[#f7c948]" aria-hidden="true" /><div className="relative aspect-[16/9] overflow-hidden border-[5px] border-[#231b18] bg-[#181b31] shadow-[8px_8px_0_#231b18]"><Image src="/images/farm-filch-hero.png" alt="Farm & Filch pixel farm, split between sunny fields and a moonlit night" fill priority sizes="(max-width: 767px) calc(100vw - 2rem), (max-width: 1024px) 52vw, 640px" className="object-cover" /></div><p className="ml-auto mt-3 w-fit border-[3px] border-[#231b18] bg-[#f7c948] px-3 py-2 text-xs font-extrabold uppercase tracking-wider text-[#231b18] shadow-[3px_3px_0_#231b18]">Daylight grows it. Nightfall tests it.</p></div>
      </div>
    </section>
  );
}
