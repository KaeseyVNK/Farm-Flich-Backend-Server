import Image from "next/image";
import { EXTERNAL_LINKS, NAV_ITEMS } from "@/lib/landing-content";

const LEGAL_LINKS = [
  { href: "/dieu-khoan", label: "Terms of Service" },
  { href: "/bao-mat", label: "Privacy Policy" },
] as const;

const linkClass = "text-sm font-semibold text-[#f7edcf]/75 hover:text-[#f7c948] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7c948]";

export function Footer() {
  return (
    <footer className="mt-auto border-t-[5px] border-[#231b18] bg-[#181b31] text-[#f7edcf]">
      <div className="mx-auto grid max-w-6xl gap-9 px-4 py-12 sm:grid-cols-2 md:grid-cols-[1.35fr_1fr_1fr_1fr] md:px-6">
        <div className="sm:col-span-2 md:col-span-1"><a href="/" className="inline-flex items-center gap-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f7c948]"><Image src="/images/farm-filch-logo.png" alt="" width={48} height={48} className="size-12 border-[3px] border-[#f7edcf] bg-[#f7c948] object-cover" /><span className="font-display text-2xl font-extrabold">Farm <span className="text-[#f7c948]">&amp;</span> Filch</span></a><p className="mt-4 max-w-xs text-sm font-semibold leading-relaxed text-[#f7edcf]/70">A pixel farm RPG where the harvest is worth fighting for.</p></div>
        <nav aria-label="Game"><h2 className="font-display text-sm font-extrabold uppercase tracking-[0.16em] text-[#f7c948]">Game</h2><ul className="mt-4 space-y-2.5">{NAV_ITEMS.map((item) => <li key={item.href}><a href={item.href} className={linkClass}>{item.label}</a></li>)}<li><a href={EXTERNAL_LINKS.play} className={linkClass}>Play Now</a></li></ul></nav>
        <nav aria-label="Resources"><h2 className="font-display text-sm font-extrabold uppercase tracking-[0.16em] text-[#f7c948]">Resources</h2><ul className="mt-4 space-y-2.5"><li><a href={EXTERNAL_LINKS.x} target="_blank" rel="noopener noreferrer" className={linkClass}>X / Twitter</a></li><li><a href={EXTERNAL_LINKS.discord} target="_blank" rel="noopener noreferrer" className={linkClass}>Discord</a></li><li><a href={EXTERNAL_LINKS.art} target="_blank" rel="noopener noreferrer" className={linkClass}>Pixel art credits</a></li></ul></nav>
        <nav aria-label="Legal"><h2 className="font-display text-sm font-extrabold uppercase tracking-[0.16em] text-[#f7c948]">Legal</h2><ul className="mt-4 space-y-2.5">{LEGAL_LINKS.map((item) => <li key={item.href}><a href={item.href} className={linkClass}>{item.label}</a></li>)}</ul></nav>
      </div>
      <div className="border-t-[3px] border-[#f7edcf]/15"><div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs font-semibold text-[#f7edcf]/55 md:flex-row md:items-center md:justify-between md:px-6"><p>© 2026 Farm &amp; Filch. All rights reserved.</p><p>Grow carefully. Guard fiercely. Filch boldly.</p></div></div>
    </footer>
  );
}
