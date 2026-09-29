"use client";

import Image from "next/image";
import { WORLD_FEATURES } from "@/lib/landing-content";
import { Reveal } from "./reveal";

export function World() {
  return (
    <section id="world" className="section-shell scroll-mt-24 bg-parchment py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <Reveal className="mb-12 max-w-3xl md:mb-20">
          <p className="font-display text-sm font-extrabold uppercase tracking-[0.18em] text-meadow-dark">
            Beyond your front gate
          </p>
          <h2 className="mt-3 font-display text-4xl font-extrabold leading-none text-ink md:text-6xl">
            The world of Farm &amp; Filch
          </h2>
        </Reveal>

        <div className="space-y-10 md:space-y-16">
          {WORLD_FEATURES.map((feature, index) => {
            const reverse = index % 2 === 1;
            return (
              <article key={feature.id} className="pixel-border grid overflow-hidden bg-meadow-dark text-parchment md:grid-cols-2">
                <Reveal className={reverse ? "md:order-2" : undefined} y={16}>
                  <div className="relative aspect-[4/3] min-h-64">
                    <Image src={feature.image} alt={feature.alt} fill sizes="(max-width: 768px) 100vw, 50vw" className="pixelated object-cover" />
                  </div>
                </Reveal>
                <Reveal className={reverse ? "md:order-1" : undefined} delay={0.06} y={16}>
                  <div className="flex h-full flex-col justify-center p-7 md:p-10">
                    <p className="font-display text-sm font-extrabold uppercase tracking-[0.16em] text-harvest">{feature.eyebrow}</p>
                    <h3 className="mt-3 font-display text-3xl font-extrabold leading-tight md:text-4xl">{feature.title}</h3>
                    <p className="mt-4 text-base font-semibold leading-relaxed text-parchment/85 md:text-lg">{feature.description}</p>
                    <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t-2 border-parchment/25 pt-4 font-display text-sm font-extrabold text-harvest" aria-label={`${feature.title} highlights`}>
                      {feature.stats.map((stat) => <li key={stat}>{stat}</li>)}
                    </ul>
                  </div>
                </Reveal>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// Legacy aliases keep the current page compiling until its composition changes.
export const Features = World;
export function WhatsOn() {
  return null;
}
