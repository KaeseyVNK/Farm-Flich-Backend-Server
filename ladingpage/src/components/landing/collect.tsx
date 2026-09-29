"use client";

import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { EXTERNAL_LINKS, ITEM_STATS } from "@/lib/landing-content";
import { Reveal } from "./reveal";

export function Items() {
  return (
    <section id="items" className="section-shell scroll-mt-24 bg-parchment py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="grid gap-10 md:grid-cols-[0.9fr_1.1fr] md:items-end">
          <Reveal>
            <p className="font-display text-sm font-extrabold uppercase tracking-[0.18em] text-meadow-dark">Fill your pockets</p>
            <h2 className="mt-3 font-display text-4xl font-extrabold leading-none text-ink md:text-6xl">Discover, craft, collect.</h2>
          </Reveal>
          <Reveal delay={0.06} y={16}>
            <div className="pixel-border relative aspect-[4/3] overflow-hidden bg-harvest">
              <Image
                src="/images/farm-filch-items.png"
                alt="A pixel farmer sorting crops, fish, tools, crafts, and pet supplies beside an open chest"
                fill
                sizes="(max-width: 768px) 100vw, 630px"
                className="pixelated object-cover"
              />
            </div>
          </Reveal>
        </div>

        <ul className="mt-10 grid grid-cols-2 border-y-2 border-soil/35 md:mt-14 md:grid-cols-4" aria-label="Collectible item totals">
          {ITEM_STATS.map((stat, index) => (
            <li
              key={stat.label}
              className={`py-5 text-center md:py-7 ${index % 2 === 1 ? "border-l-2 border-soil/35" : ""} ${index >= 2 ? "border-t-2 border-soil/35 md:border-t-0" : ""} ${index > 0 ? "md:border-l-2 md:border-soil/35" : "md:border-l-0"}`}
            >
              <span className="block font-display text-3xl font-extrabold text-meadow-dark md:text-5xl">{stat.value}</span>
              <span className="mt-1 block text-xs font-extrabold uppercase tracking-[0.14em] text-ink/70 md:text-sm">{stat.label}</span>
            </li>
          ))}
        </ul>

        <Reveal className="mt-10 text-center md:mt-12">
          <a href={EXTERNAL_LINKS.play} className="pixel-border pixel-shadow-hover inline-flex items-center gap-2 bg-meadow-dark px-6 py-3 font-display text-base font-extrabold text-parchment">
            Play Now <ArrowUpRight className="size-5" aria-hidden="true" />
          </a>
        </Reveal>
      </div>
    </section>
  );
}

export const Collect = Items;
