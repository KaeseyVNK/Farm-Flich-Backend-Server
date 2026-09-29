"use client";

import { Palette, Sprout, UserPlus } from "lucide-react";
import { CropIcon } from "./pixel-sprite";
import { Reveal, SectionHeader } from "./reveal";
import { WaitlistForm } from "./waitlist-form";

const STEPS = [
  {
    icon: UserPlus,
    step: "1",
    title: "Để email",
    desc: "Một địa chỉ là đủ. Không thẻ, không tải app. Bạn vào danh sách mở sớm.",
    bg: "bg-[#ffe9a3]",
  },
  {
    icon: Palette,
    step: "2",
    title: "Giữ mã trong ngày",
    desc: "Mã mở sớm đổi mỗi ngày. Chép rồi dán khi client hỏi — hoặc để form lưu giúp bạn.",
    bg: "bg-[#c9e8f5]",
  },
  {
    icon: Sprout,
    step: "3",
    title: "Vào khi cửa mở",
    desc: "Playtest và bản trình duyệt gửi qua thư. Trồng vụ đầu ngay phút đầu tiên.",
    bg: "bg-[#d9ecc9]",
  },
];

export function GetStarted() {
  return (
    <section id="bat-dau" className="scroll-mt-24 bg-[#a8dff0] py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <SectionHeader
          badge="Giữ chỗ"
          badgeIcon={<CropIcon name="sunflower" size={16} />}
          title="Ba bước, chưa cần cày cuốc"
          desc="Client chưa public. Form này là cửa vào thật — không phải nút chơi giả."
        />
        <div className="grid gap-6 md:grid-cols-3 md:gap-8">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.08}>
              <article
                className={`pixel-border pixel-shadow-hover relative flex h-full flex-col rounded-md p-6 pt-10 ${s.bg}`}
              >
                <span className="pixel-border-sm absolute -top-4 left-6 flex size-9 items-center justify-center rounded-md bg-[#3e2f23] font-display text-lg font-extrabold text-sun">
                  {s.step}
                </span>
                <span className="inline-flex size-12 items-center justify-center rounded-md bg-white/80 text-[#3e2f23]">
                  <s.icon className="size-6" aria-hidden />
                </span>
                <h3 className="mt-4 font-display text-2xl font-extrabold text-foreground">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-foreground/75 md:text-base">
                  {s.desc}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-12 flex flex-col items-center">
          <WaitlistForm />
          <p className="mt-2 text-sm font-extrabold text-[#2b5a6b]">
            Trình duyệt · điện thoại · máy tính — khi bản chơi sẵn sàng
          </p>
        </Reveal>
      </div>
    </section>
  );
}

export function Community() {
  return (
    <section id="cong-dong" className="scroll-mt-24 bg-cream py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <SectionHeader
          badge="Cộng đồng"
          badgeIcon={<CropIcon name="wool" size={16} />}
          title="Kênh sẽ mở cùng playtest"
          desc="Chưa có fanpage/Discord chính thức — không bịa số follow. Bạn nhận link qua email."
        />
        <div className="grid gap-6 md:grid-cols-3">
          <Reveal>
            <div className="pixel-border flex h-full flex-col rounded-md bg-[#d9ecc9] p-5">
              <h3 className="font-display text-xl font-extrabold">Email mở sớm</h3>
              <p className="mt-2 text-sm font-semibold text-foreground/70">
                Kênh duy nhất đang chạy. Form ở mục Giữ chỗ.
              </p>
              <a
                href="#bat-dau"
                className="mt-4 font-display text-sm font-extrabold uppercase tracking-wide text-[#6d4c33] focus-visible:ring-2 focus-visible:ring-ring"
              >
                Để email →
              </a>
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <div className="pixel-border flex h-full flex-col rounded-md bg-[#cfe4f7] p-5">
              <h3 className="font-display text-xl font-extrabold">Facebook / Zalo / TikTok</h3>
              <p className="mt-2 text-sm font-semibold text-foreground/70">
                Sẽ công bố khi có handle thật. Ưu tiên kênh Việt.
              </p>
              <span className="mt-4 font-display text-sm font-extrabold uppercase tracking-wide text-foreground/50">
                Chưa mở
              </span>
            </div>
          </Reveal>
          <Reveal delay={0.16}>
            <a
              href="https://maevedevs.itch.io/farm-rpg"
              target="_blank"
              rel="noopener noreferrer"
              className="pixel-border pixel-shadow-hover flex h-full flex-col rounded-md bg-[#ffe9a3] p-5 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <h3 className="font-display text-xl font-extrabold">Art Maeve</h3>
              <p className="mt-2 text-sm font-semibold text-foreground/70">
                Tiny Farm RPG Asset Pack 16x16 — nguồn cảm hứng pixel của trang.
              </p>
              <span className="mt-4 font-display text-sm font-extrabold uppercase tracking-wide text-[#6d4c33]">
                Mở itch.io →
              </span>
            </a>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
