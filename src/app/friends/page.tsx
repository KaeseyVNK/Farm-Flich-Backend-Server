"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { X, Users, Heart, Star, Laugh, Gift, Flower2, Sun, Moon, Fish, Cat, Dog, PartyPopper, ThumbsUp, Send } from "lucide-react";
import {
  listFriendsAction,
  sendRequestAction,
  giftItemAction,
  visitFriendAction,
  likeFarmAction,
  sendStickerAction,
  writeGuestbookAction,
  getVisitSocialAction,
} from "@/app/actions/friends";
import { STICKER_IDS, type StickerId } from "@/lib/social/social-rules";
import { VisitFarmCanvas } from "@/components/social/visit-farm-canvas";
import { useTutorialStore } from "@/store/tutorialStore";

interface Friend {
  id: string;
  displayName: string | null;
}

interface VisitFarm {
  terrain: number[];
  crops: Record<string, { dead?: boolean }>;
  objects: Record<string, { type?: string }>;
  placedDecor?: { uid?: string; defId?: string; tx?: number; ty?: number; rot?: number }[];
  /** W4 audit-fix: cá ao — chấm + tooltip trên visit canvas. */
  pondFish?: { fishId?: string; daysGrown?: number }[];
}

/** W4: sticker id → icon (không OS emoji làm identity — Lucide như FeatureBar). */
const STICKER_ICONS: Record<StickerId, typeof Heart> = {
  heart: Heart, star: Star, laugh: Laugh, gift: Gift, flower: Flower2, sun: Sun,
  moon: Moon, fish: Fish, cat: Cat, dog: Dog, party: PartyPopper, thumb: ThumbsUp,
};

interface VisitSocial {
  likes: number;
  likedByMe: boolean;
  guestbook: { id: string; visitorId: string; message: string; createdAt: string }[];
}

/** Notice phân biệt ok/error — success không hiện màu alarm (IA phase 5). */
interface Notice {
  ok: boolean;
  text: string;
}
const FAIL = (err?: string) => ({ ok: false, text: err ?? "Không thực hiện được — thử lại." });

export default function FriendsPage() {
  // W4 audit-fix: copy social qua i18n namespace `social` (plan W4P3 — trước đây hardcode vi).
  const t = useTranslations("social");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [targetId, setTargetId] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [gift, setGift] = useState<{ id: string; name: string } | null>(null);
  const [visit, setVisit] = useState<{ id: string; name: string; farm: VisitFarm | null } | null>(null);
  const [visitMsg, setVisitMsg] = useState("");
  // busy: chặn duplicate submit khi server action đang pending (phase 5 plan §9).
  const [busy, setBusy] = useState(false);

  const refresh = () => listFriendsAction().then(setFriends);
  useEffect(() => {
    refresh();
  }, []);

  const onSend = async () => {
    if (!targetId.trim() || busy) return;
    setBusy(true);
    const res = await sendRequestAction(targetId.trim());
    setBusy(false);
    setNotice(res.ok ? { ok: true, text: "Đã gửi lời mời." } : FAIL(res.error));
    if (res.ok) setTargetId("");
  };
  const onGift = async (itemId: string, qty: number) => {
    if (!gift || busy) return;
    setBusy(true);
    const res = await giftItemAction(gift.id, itemId, qty);
    setBusy(false);
    setNotice(res.ok ? { ok: true, text: `Đã tặng ${qty} ${itemId}.` } : FAIL(res.error));
    setGift(null);
  };
  const [social, setSocial] = useState<VisitSocial | null>(null);
  const [gbText, setGbText] = useState("");

  const loadSocial = async (ownerId: string) => {
    const res = await getVisitSocialAction(ownerId);
    if (!("error" in res) || res === undefined) setSocial(res as VisitSocial);
  };

  const onVisit = async (id: string, name: string) => {
    if (busy) return;
    setBusy(true);
    setVisitMsg("");
    setSocial(null);
    setGbText("");
    try {
      const res = await visitFriendAction(id);
      if (!res.ok) {
        setVisit(null);
        setVisitMsg("");
        setNotice(FAIL(res.error));
        return;
      }
      setVisit({ id, name, farm: res.farm as VisitFarm | null });
      useTutorialStore.getState().tickVisit();
      void loadSocial(id);
    } finally {
      setBusy(false);
    }
  };

  // W4 social: like / sticker / guestbook (gọi khi đang thăm farm bạn)
  const onLike = async () => {
    if (!visit || busy) return;
    setBusy(true);
    try {
      const res = await likeFarmAction(visit.id);
      if (res.ok) {
        setSocial((s) => (s ? { ...s, likes: res.totalLikes ?? s.likes, likedByMe: true } : s));
      } else {
        setNotice(FAIL(res.error));
      }
    } finally {
      setBusy(false);
    }
  };
  const onSticker = async (stickerId: StickerId) => {
    if (!visit || busy) return;
    setBusy(true);
    try {
      const res = await sendStickerAction(visit.id, stickerId);
      setNotice(res.ok ? { ok: true, text: t("stickerSent") } : FAIL(res.error));
    } finally {
      setBusy(false);
    }
  };
  const onGuestbook = async () => {
    if (!visit || busy || !gbText.trim()) return;
    setBusy(true);
    try {
      const res = await writeGuestbookAction(visit.id, gbText);
      if (res.ok) {
        setGbText("");
        void loadSocial(visit.id);
        setNotice({ ok: true, text: t("guestbookSent") });
      } else {
        setNotice(FAIL(res.error));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="f-body min-h-screen bg-[#fffaf0] p-6 text-[#3b2f23]">
      <h1 className="f-display mb-4 flex items-center gap-2 text-3xl text-[var(--mystic)]">
        <Users aria-hidden className="h-7 w-7" /> {t("title")}
      </h1>
      {notice && (
        <p className={`mb-3 text-sm ${notice.ok ? "text-[#4e7d3a]" : "text-[var(--alarm)]"}`}>{notice.text}</p>
      )}

      <div className="mb-6 flex gap-2">
        <input
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          placeholder={t("friendInputPlaceholder")}
          className="f-body flex-1 rounded border-2 border-[#4a3119] bg-white px-3 py-1.5 text-sm"
        />
        <button
          onClick={onSend}
          className="rounded border-2 border-[#4a3119] bg-[var(--mystic)] px-4 py-1.5 text-sm font-bold text-white"
        >
          {t("addFriend")}
        </button>
      </div>

      <h2 className="f-display mb-2 text-xl text-[#4e7d3a]">{t("listHeading", { count: friends.length })}</h2>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {friends.map((f) => (
          <div key={f.id} className="flex items-center justify-between rounded border-2 border-[#4a3119] bg-[#efe2c4] px-3 py-2">
            <span className="text-sm font-bold">{f.displayName ?? f.id.slice(0, 8)}</span>
            <div className="flex gap-1">
              <button
                onClick={() => setGift({ id: f.id, name: f.displayName ?? f.id.slice(0, 8) })}
                className="rounded border border-[#4a3119] bg-[#4e7d3a] px-2 py-0.5 text-xs font-bold text-[#fbf7ec]"
              >
                {t("gift")}
              </button>
              <button
                onClick={() => onVisit(f.id, f.displayName ?? f.id.slice(0, 8))}
                className="rounded border border-[#4a3119] bg-[#e7b94e] px-2 py-0.5 text-xs font-bold text-[#3b2f23]"
              >
                {t("visit")}
              </button>
            </div>
          </div>
        ))}
        {friends.length === 0 && <p className="text-sm opacity-60">{t("noFriends")}</p>}
      </div>

      {gift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-72 rounded border-2 border-[#4a3119] bg-[#fffaf0] p-4 text-center">
            <h3 className="f-display mb-2 text-sm text-[#4e7d3a]">{t("giftFor", { name: gift.name })}</h3>
            <div className="mb-2 grid grid-cols-2 gap-1">
              <button onClick={() => onGift("wood", 5)} disabled={busy} className="rounded border border-[#4a3119] bg-[#efe2c4] py-1 text-xs disabled:opacity-50">5 wood</button>
              <button onClick={() => onGift("wood", 10)} disabled={busy} className="rounded border border-[#4a3119] bg-[#efe2c4] py-1 text-xs disabled:opacity-50">10 wood</button>
            </div>
            <button onClick={() => setGift(null)} aria-label={t("close")} className="inline-flex items-center gap-1 text-xs text-[#c0452f]">
              <X aria-hidden className="h-3 w-3" /> {t("cancel")}
            </button>
          </div>
        </div>
      )}

      {visit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-[min(90vw,560px)] rounded-xl border-2 border-[#4a3119] bg-[#fffaf0] p-4 text-center">
            <h3 className="f-display mb-1 text-base text-[#4e7d3a]">{t("farmOf", { name: visit.name })}</h3>
            <p className="mb-3 text-xs opacity-60">{t("readOnly")}</p>
            {visitMsg && <p className="mb-2 text-sm text-[var(--alarm)]">{visitMsg}</p>}
            {visit.farm ? (
              <VisitFarmCanvas
                terrain={visit.farm.terrain}
                crops={visit.farm.crops}
                objects={visit.farm.objects}
                placedDecor={visit.farm.placedDecor}
                pondFish={visit.farm.pondFish}
              />
            ) : (
              !visitMsg && <p className="py-6 text-sm opacity-60">{t("loading")}</p>
            )}
            {/* W4 social: like + sticker + guestbook (chỉ hiện khi farm đã tải) */}
            {visit.farm && (
              <div className="mt-3 text-left" data-testid="visit-social">
                <div className="mb-2 flex items-center gap-2">
                  <button
                    onClick={onLike}
                    disabled={busy || social?.likedByMe}
                    aria-label={social?.likedByMe ? t("likedToday") : t("likeFarm")}
                    data-testid="visit-like-btn"
                    className={`flex items-center gap-1.5 rounded border-2 border-[#4a3119] px-3 py-1 text-sm font-bold ${
                      social?.likedByMe ? "bg-[#e8b4b4] text-[#c0452f]" : "bg-[#f0c964] text-[#3b2f23]"
                    } disabled:opacity-60`}
                  >
                    <Heart aria-hidden className={`h-4 w-4 ${social?.likedByMe ? "fill-[#c0452f]" : ""}`} />
                    {social ? t('likedCount', { count: social.likes }) : t('like')}
                  </button>
                  <span className="text-xs opacity-60">{social?.likedByMe ? t('likedToday') : t('oncePerDay')}</span>
                </div>
                <div className="mb-2 flex flex-wrap gap-1" data-testid="visit-sticker-tray">
                  {STICKER_IDS.map((id) => {
                    const Icon = STICKER_ICONS[id];
                    return (
                      <button
                        key={id}
                        onClick={() => onSticker(id)}
                        disabled={busy}
                        aria-label={t("sendSticker", { id })}
                        data-testid={`visit-sticker-${id}`}
                        className="rounded border border-[#4a3119] bg-[#efe2c4] p-1.5 hover:bg-[#e7b94e] disabled:opacity-50"
                      >
                        <Icon aria-hidden className="h-4 w-4 text-[#3b2f23]" />
                      </button>
                    );
                  })}
                </div>
                <div className="mb-1 flex gap-1">
                  <input
                    value={gbText}
                    onChange={(e) => setGbText(e.target.value)}
                    maxLength={200}
                    placeholder={t("guestbookPlaceholder")}
                    aria-label={t("guestbookInputLabel")}
                    data-testid="visit-guestbook-input"
                    className="f-body flex-1 rounded border-2 border-[#4a3119] bg-white px-2 py-1 text-xs"
                  />
                  <button
                    onClick={onGuestbook}
                    disabled={busy || !gbText.trim()}
                    aria-label={t("sendGuestbook")}
                    data-testid="visit-guestbook-send"
                    className="rounded border-2 border-[#4a3119] bg-[#4e7d3a] px-2 py-1 text-xs font-bold text-[#fbf7ec] disabled:opacity-50"
                  >
                    <Send aria-hidden className="h-4 w-4" />
                  </button>
                </div>
                {social && social.guestbook.length > 0 && (
                  <ul className="fancy-scroll max-h-24 overflow-y-auto rounded border border-[#d2bf96] bg-[#f7efdc] p-1.5 text-xs" data-testid="visit-guestbook-list">
                    {social.guestbook.map((g) => (
                      <li key={g.id} className="truncate py-0.5">
                        <b>{g.visitorId.slice(0, 8)}</b>: {g.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <button onClick={() => setVisit(null)} className="mt-3 rounded border-2 border-[#c0452f] px-4 py-1 text-sm font-bold text-[#c0452f]">
              {t("close")}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
