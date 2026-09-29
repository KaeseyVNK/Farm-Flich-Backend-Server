"use client";

import { useState } from "react";
import {
  CHARACTERS,
  HAIR_TONES,
  PixelCharacter,
  type CharacterId,
  type HairId,
} from "./pixel-sprite";
import { Reveal } from "./reveal";
import { cn } from "@/lib/utils";

const OUTFITS = Object.entries(CHARACTERS) as [CharacterId, { label: string }][];
const HAIRS = Object.keys(HAIR_TONES) as HairId[];
const HAIR_LABEL: Record<HairId, string> = {
  brown: "Nâu",
  black: "Đen",
  blonde: "Vàng",
  auburn: "Đỏ",
};

export function DressUp() {
  const [outfit, setOutfit] = useState<CharacterId>("farmer");
  const [hair, setHair] = useState<HairId>("brown");

  return (
    <section className="relative overflow-hidden bg-[#3e2f23] py-16 md:py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 md:grid-cols-2 md:gap-16 md:px-6">
        <Reveal y={24}>
          <div className="pixel-border flex aspect-square items-center justify-center rounded-md bg-[#5c4632]">
            <PixelCharacter id={outfit} hair={hair} size={220} />
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <span className="pixel-border-sm inline-block rounded-md bg-sun px-3 py-1 text-xs font-extrabold uppercase tracking-widest text-[#5a4300]">
            Thử nhân vật
          </span>
          <h2 className="mt-4 font-display text-3xl font-extrabold text-cream md:text-4xl lg:text-5xl lg:leading-tight">
            Nông dân, hiệp sĩ hay pháp sư?
          </h2>
          <p className="mt-4 text-base font-semibold leading-relaxed text-cream/80 md:text-lg">
            Pack art dùng nhân vật modular (tóc, mũ, áo). Thử vài bộ dưới đây —
            khi playtest mở, bạn dựng nông dân đầy đủ trong game.
          </p>

          <p className="mt-6 text-xs font-extrabold uppercase tracking-widest text-sun">
            Trang phục
          </p>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Trang phục">
            {OUTFITS.map(([id, meta]) => (
              <button
                key={id}
                type="button"
                onClick={() => setOutfit(id)}
                aria-pressed={outfit === id}
                className={cn(
                  "pixel-border-sm rounded-md px-3 py-1.5 text-sm font-extrabold focus-visible:ring-2 focus-visible:ring-sun",
                  outfit === id
                    ? "bg-sun text-[#5a4300]"
                    : "bg-[#5c4632] text-cream hover:bg-[#6d5640]",
                )}
              >
                {meta.label}
              </button>
            ))}
          </div>

          <p className="mt-5 text-xs font-extrabold uppercase tracking-widest text-sun">
            Tóc / mũ
          </p>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Màu tóc">
            {HAIRS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setHair(id)}
                aria-pressed={hair === id}
                className={cn(
                  "pixel-border-sm rounded-md px-3 py-1.5 text-sm font-extrabold focus-visible:ring-2 focus-visible:ring-sun",
                  hair === id
                    ? "bg-sun text-[#5a4300]"
                    : "bg-[#5c4632] text-cream hover:bg-[#6d5640]",
                )}
              >
                {HAIR_LABEL[id]}
              </button>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
