"use client";

import Image from "next/image";
import { Menu, Play, X } from "lucide-react";
import { useEffect, useState } from "react";
import { EXTERNAL_LINKS, NAV_ITEMS } from "@/lib/landing-content";

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const linkClass = scrolled
    ? "text-[#f7edcf]/85 hover:bg-[#f7edcf]/10 hover:text-[#f7edcf]"
    : "text-[#231b18]/80 hover:bg-[#231b18]/10 hover:text-[#231b18]";

  return (
    <header className={`fixed inset-x-0 top-0 z-50 border-b-[3px] transition-colors duration-200 motion-reduce:transition-none ${scrolled ? "border-[#231b18] bg-[#181b31]/95 shadow-[0_4px_0_#231b18]" : "border-transparent bg-[#f7edcf]/80"}`}>
      <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-[60] focus:rounded-sm focus:bg-[#f7c948] focus:px-4 focus:py-3 focus:font-bold focus:text-[#231b18]">Skip to content</a>
      <nav className="mx-auto flex h-[72px] max-w-6xl items-center justify-between gap-4 px-4 md:px-6" aria-label="Main navigation">
        <a href="/" aria-label="Farm & Filch home" className="flex min-h-11 items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f7c948]">
          <Image src="/images/farm-filch-logo.png" alt="" width={44} height={44} className="size-11 rounded-sm border-[3px] border-[#231b18] bg-[#f7c948] object-cover" />
          <span className={`font-display text-xl font-extrabold tracking-tight md:text-2xl ${scrolled ? "text-[#f7edcf]" : "text-[#231b18]"}`}>Farm <span className="text-[#d97b2a]">&amp;</span> Filch</span>
        </a>
        <ul className="hidden items-center gap-1 lg:flex">
          {NAV_ITEMS.map((item) => <li key={item.href}><a href={item.href} className={`inline-flex min-h-11 items-center rounded-sm px-3 text-sm font-extrabold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7c948] ${linkClass}`}>{item.label}</a></li>)}
        </ul>
        <div className="flex items-center gap-2">
          <a href={EXTERNAL_LINKS.play} className="hidden min-h-11 items-center gap-2 border-[3px] border-[#231b18] bg-[#f7c948] px-4 font-display text-sm font-extrabold text-[#231b18] shadow-[3px_3px_0_#231b18] transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f7c948] sm:inline-flex"><Play className="size-4 fill-current" aria-hidden="true" />Play Now</a>
          <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? "Close navigation menu" : "Open navigation menu"} className="flex size-11 items-center justify-center border-[3px] border-[#231b18] bg-[#f7c948] text-[#231b18] shadow-[3px_3px_0_#231b18] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f7c948] lg:hidden">
            {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          </button>
        </div>
      </nav>
      {open && <div id="mobile-nav" className="border-t-[3px] border-[#231b18] bg-[#181b31] lg:hidden"><ul className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4">
        {NAV_ITEMS.map((item) => <li key={item.href}><a href={item.href} onClick={() => setOpen(false)} className="flex min-h-11 items-center px-3 font-display text-base font-bold text-[#f7edcf] hover:bg-[#f7edcf]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#f7c948]">{item.label}</a></li>)}
        <li className="pt-2"><a href={EXTERNAL_LINKS.play} onClick={() => setOpen(false)} className="flex min-h-11 items-center justify-center gap-2 border-[3px] border-[#231b18] bg-[#f7c948] px-4 font-display text-base font-extrabold text-[#231b18] shadow-[3px_3px_0_#0d1020] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f7c948]"><Play className="size-4 fill-current" aria-hidden="true" />Play Now</a></li>
      </ul></div>}
    </header>
  );
}
