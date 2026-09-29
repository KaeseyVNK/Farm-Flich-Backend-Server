"use client";

import { CropIcon, PixelCharacter } from "./pixel-sprite";
import { Reveal, SectionHeader } from "./reveal";

const STEPS = [
  {
    title: "Waitlist",
    desc: "Đang mở. Email + mã ngày.",
    now: true,
  },
  {
    title: "Playtest kín",
    desc: "Mời từng đợt, sửa cảm giác trồng/câu/đi đảo.",
    now: false,
  },
  {
    title: "Mở trình duyệt",
    desc: "Ai cũng vào được, không cần tải.",
    now: false,
  },
];

export function Roadmap() {
  return (
    <section id="lo-trinh" className="scroll-mt-24 bg-[#e8f4d9] py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <SectionHeader
          badge="Lộ trình"
          badgeIcon={<CropIcon name="gem" size={16} />}
          title="Ba cổng, không hứa ngày"
          desc="Vùng đất mới (núi lửa, đầm) nằm sau khi loop nông trại ổn — không phải DLC đang bán."
        />
        <div className="grid gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.08}>
              <article className="pixel-border h-full rounded-md bg-cream p-6">
                <span className="pixel-border-sm inline-block rounded-md bg-[#3e2f23] px-2 py-0.5 font-mono text-xs font-extrabold text-sun">
                  0{i + 1}
                </span>
                {s.now && (
                  <span className="ml-2 font-display text-xs font-extrabold uppercase tracking-wide text-grass-dark">
                    Đang mở
                  </span>
                )}
                <h3 className="mt-3 font-display text-2xl font-extrabold">{s.title}</h3>
                <p className="mt-2 text-sm font-semibold text-foreground/75">{s.desc}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Studio() {
  return (
    <section id="studio" className="scroll-mt-24 bg-cream py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <SectionHeader
          badge="Studio"
          badgeIcon={<CropIcon name="egg" size={16} />}
          title="Một nhóm nhỏ, một đảo"
        />
        <Reveal>
          <div className="pixel-border mx-auto flex max-w-xl flex-col items-center rounded-md bg-white p-8 text-center">
            <div className="pixel-border-sm rounded-md bg-[#f3ead3] p-3">
              <PixelCharacter id="farmer" hair="blonde" size={96} />
            </div>
            <h3 className="mt-4 font-display text-2xl font-extrabold">Farm &amp; Filch</h3>
            <p className="mt-1 text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
              Indie · Việt Nam
            </p>
            <p className="mt-4 text-base font-semibold leading-relaxed text-foreground/75">
              Đội nhỏ đang dựng nông trại pixel chơi trên trình duyệt. Chưa
              tuyển public. Liên hệ qua form giữ chỗ — chúng tôi đọc hết thư.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
