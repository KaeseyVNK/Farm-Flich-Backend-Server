"use client";

import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { EXTERNAL_LINKS, GAMEPLAY_PILLARS } from "@/lib/landing-content";
import { Reveal } from "./reveal";

const PILLAR_TONES = {
  day: "bg-parchment text-ink",
  gold: "bg-harvest text-ink",
  night: "bg-midnight text-parchment",
  leaf: "bg-meadow-dark text-parchment",
} as const;

export function CoreGameplay() {
  return (
    <section id="gameplay" className="section-shell scroll-mt-24 bg-midnight py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <Reveal className="mb-10 max-w-2xl md:mb-14">
          <p className="font-display text-sm font-extrabold uppercase tracking-[0.18em] text-harvest">
            The daily loop
          </p>
          <h2 className="mt-3 font-display text-4xl font-extrabold leading-none text-parchment md:text-6xl">
            Make the farm yours. Then keep it.
          </h2>
        </Reveal>

        <ol className="grid gap-4 md:grid-cols-2 md:gap-6">
          {GAMEPLAY_PILLARS.map((pillar, index) => (
            <li key={pillar.id}>
              <Reveal delay={index * 0.04}>
                <article className={`pixel-border overflow-hidden ${PILLAR_TONES[pillar.tone]}`}>
                  <div className="grid sm:grid-cols-[minmax(0,1fr)_13rem]">
                    <div className="p-6 md:p-8">
                      <p className="font-display text-sm font-extrabold tracking-[0.18em] opacity-70">
                        {pillar.number} / {pillar.label}
                      </p>
                      <h3 className="mt-5 font-display text-3xl font-extrabold leading-tight md:text-4xl">
                        {pillar.title}
                      </h3>
                      <p className="mt-4 max-w-xl text-base font-semibold leading-relaxed opacity-80">
                        {pillar.description}
                      </p>
                    </div>
                    <div className="relative aspect-[4/3] min-h-48 sm:aspect-auto">
                      <Image
                        src={pillar.image}
                        alt={pillar.alt}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 300px"
                        className="pixelated object-cover"
                      />
                    </div>
                  </div>
                </article>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function Trailer() {
  return (
    <section id="trailer" className="section-shell scroll-mt-24 bg-soil py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <Reveal>
          <div className="pixel-border relative aspect-[4/5] overflow-hidden bg-midnight sm:aspect-video">
            <Image
              src="/images/farm-filch-hero.png"
              alt="Farm & Filch preview split between a sunny farm, a moonlit filcher, and a glowing treasure chest"
              fill
              sizes="(max-width: 1152px) 100vw, 1152px"
              className="pixelated object-cover"
            />
            <div className="absolute inset-0 flex items-end bg-gradient-to-t from-midnight via-midnight/30 to-transparent p-5 md:p-10">
              <div className="max-w-xl text-parchment">
                <p className="font-display text-sm font-extrabold uppercase tracking-[0.18em] text-harvest">
                  Playable pre-beta is live
                </p>
                <h2 className="mt-2 font-display text-3xl font-extrabold md:text-5xl">
                  Start your story before the sun goes down.
                </h2>
                <a
                  href={EXTERNAL_LINKS.play}
                  className="pixel-border pixel-shadow-hover mt-5 inline-flex items-center gap-2 bg-harvest px-5 py-3 font-display text-base font-extrabold text-ink"
                >
                  Play Now <ArrowUpRight className="size-5" aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// Backwards-compatible export while the page composition is being updated.
export const Gameplay = CoreGameplay;
