"use client";

// VisitorsPanel — W4P3: chủ farm xem like/sticker/guestbook (concept §14).
// Polling 30s khi panel mở — KHÔNG realtime (plan risk: VillageChat đã tốn).

import { useEffect, useState } from "react";
import { listVisitorsAction } from "@/app/actions/friends";
import { STICKER_IDS, type StickerId } from "@/lib/social/social-rules";
import { GameIcon } from "@/components/game-ui/game-icon";
import { Heart, Star, Laugh, Gift, Flower2, Sun, Moon, Fish, Cat, Dog, PartyPopper, ThumbsUp } from "lucide-react";
import { useTranslations } from "next-intl";

const STICKER_ICONS: Record<StickerId, typeof Heart> = {
  heart: Heart, star: Star, laugh: Laugh, gift: Gift, flower: Flower2, sun: Sun,
  moon: Moon, fish: Fish, cat: Cat, dog: Dog, party: PartyPopper, thumb: ThumbsUp,
};

interface VisitorSummary {
  likesTotal: number;
  likesToday: number;
  visitsTotal: number;
  stickerTally: { stickerId: string; count: number }[];
  guestbook: { id: string; visitorId: string; message: string; createdAt: string; visitorName?: string | null }[];
}

export function VisitorsPanel() {
  // W4 audit-fix: copy social qua i18n namespace `social` (plan W4P3 — trước đây hardcode vi).
  const t = useTranslations("social");
  const [data, setData] = useState<VisitorSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [since, setSince] = useState<Date | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const res = await listVisitorsAction();
      if (!alive) return;
      if ("error" in res) {
        setError(res.error);
      } else {
        setError(null);
        setData(res);
        setSince(new Date());
      }
    };
    void load();
    const t = setInterval(load, 30_000); // polling nhẹ 30s — không mở realtime mới
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  if (error) {
    return (
      <p className="rounded-xl border-2 border-dashed border-[#d2bf96] bg-[#f3e8cf]/60 p-4 text-center text-xs font-medium text-[#5a4a36]" data-testid="visitors-error">
        {error === "unauthorized" ? t("needLogin") : t("loadFailed", { error })}
      </p>
    );
  }
  if (!data) {
    return <p className="py-6 text-center text-xs text-[#5a4a36]">{t("loading")}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2" data-testid="visitors-stats">
        <div className="rounded-xl border-2 border-[#d2bf96] bg-[#fffaf0] p-2 text-center">
          <p className="text-lg font-extrabold text-[#c0452f]" data-testid="visitors-likes-total">{data.likesTotal}</p>
          <p className="text-[10px] font-bold uppercase text-[#5a4a36]">{t("likesLabel")}</p>
        </div>
        <div className="rounded-xl border-2 border-[#d2bf96] bg-[#fffaf0] p-2 text-center">
          <p className="text-lg font-extrabold text-[#c0452f]" data-testid="visitors-likes-today">{data.likesToday}</p>
          <p className="text-[10px] font-bold uppercase text-[#5a4a36]">{t("today")}</p>
        </div>
        <div className="rounded-xl border-2 border-[#d2bf96] bg-[#fffaf0] p-2 text-center">
          <p className="text-lg font-extrabold text-[#4e7d3a]" data-testid="visitors-visits-total">{data.visitsTotal}</p>
          <p className="text-[10px] font-bold uppercase text-[#5a4a36]">{t("visits")}</p>
        </div>
      </div>

      <div className="rounded-xl border-2 border-[#d2bf96] bg-[#fffaf0] p-2.5">
        <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-[#8a6238]">
          <GameIcon id="feature-visitors" size={16} decorative /> {t("stickersReceived")}
        </h3>
        {data.stickerTally.length === 0 ? (
          <p className="text-[11px] text-[#5a4a36] opacity-80" data-testid="visitors-stickers-empty">{t("noStickers")}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5" data-testid="visitors-sticker-tally">
            {data.stickerTally.map(({ stickerId, count }) => {
              const Icon = STICKER_ICONS[stickerId as StickerId] ?? Star;
              return (
                <span
                  key={stickerId}
                  className="flex items-center gap-1 rounded-full border border-[#4a3119] bg-[#efe2c4] px-2 py-0.5 text-[11px] font-bold text-[#3b2f23]"
                >
                  <Icon aria-hidden className="h-3.5 w-3.5" /> ×{count}
                </span>
              );
            })}
          </div>
        )}
        {/* Khay đầy đủ 12 loại — legend (sticker 0 count mờ) */}
        <div className="mt-1.5 flex flex-wrap gap-1 opacity-50">
          {STICKER_IDS.filter((id) => !data.stickerTally.some((t) => t.stickerId === id)).map((id) => {
            const Icon = STICKER_ICONS[id];
            return <Icon key={id} aria-hidden className="h-3.5 w-3.5" />;
          })}
        </div>
      </div>

      <div className="rounded-xl border-2 border-[#d2bf96] bg-[#fffaf0] p-2.5">
        <h3 className="mb-1.5 text-xs font-extrabold uppercase tracking-wide text-[#8a6238]">{t("guestbookTitle")}</h3>
        {data.guestbook.length === 0 ? (
          <p className="text-[11px] text-[#5a4a36] opacity-80" data-testid="visitors-guestbook-empty">
            {t("guestbookEmpty")}
          </p>
        ) : (
          <ul className="fancy-scroll max-h-64 gap-1 overflow-y-auto text-[11px] leading-relaxed" data-testid="visitors-guestbook-list">
            {data.guestbook.map((g) => (
              <li key={g.id} className="rounded border border-[#e8dcc2] bg-[#f7efdc] px-2 py-1">
                <b>{g.visitorName ?? g.visitorId.slice(0, 8)}</b>
                <span className="ml-1 text-[#8a7a63]">{new Date(g.createdAt).toLocaleDateString("vi-VN")}</span>
                <p className="text-[#3b2f23]">{g.message}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {since && (
        <p className="text-right text-[10px] text-[#8a7a63]">
          {t("updatedAt", { time: since.toLocaleTimeString("vi-VN") })}
        </p>
      )}
    </div>
  );
}
