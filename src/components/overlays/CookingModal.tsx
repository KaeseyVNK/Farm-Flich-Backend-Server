"use client";

// W2P4 — modal nấu ăn (bếp kitchenpot trong nhà). Tier 1 nấu tức thời;
// tier 2/3 chạy minigame canh thanh (cook-sm thuần + rAF loop tại đây).
import { useEffect, useRef, useState, useCallback } from "react";
import { useUiStore } from "@/store/uiStore";
import { useFarmStore } from "@/store/farmStore";
import { useInventoryStore } from "@/store/inventoryStore";
import { useProgressionStore } from "@/store/progressionStore";
import { KITCHEN_RECIPES, missingInputs } from "@/lib/game/cooking/recipe-catalog";
import { startCook, nextCook, cookQuality, type CookSession } from "@/lib/game/cooking/cook-sm";
import { getItem } from "@/lib/game/data";
import { gameActions } from "@/lib/game/actions";
import { playSfx } from "@/lib/game/sfx";
import { ItemArt } from "@/components/game-ui/item-art";
import { Button } from "@/components/ui/button";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { CookingPot, X, Zap, Star } from "lucide-react";
import { useTranslations } from "next-intl";

export function CookingModal() {
  // W2 audit-fix: copy nấu qua i18n namespace `cooking` (plan W2P1 — trước đây hardcode vi).
  const t = useTranslations("cooking");
  const show = useUiStore((s) => s.showCooking);
  const setShow = useUiStore((s) => s.setShowCooking);
  const level = useProgressionStore((s) => s.level);
  const silo = useFarmStore((s) => s.silo);
  const slots = useInventoryStore((s) => s.slots);

  const [session, setSession] = useState<CookSession | null>(null);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<CookSession | null>(null);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);
  useFocusTrap(show, dialogRef);

  // avail = silo ∪ túi (missingInputs thuần nhận map gộp)
  const avail: Record<string, number> = { ...silo };
  for (const s of slots) if (s) avail[s.itemId] = (avail[s.itemId] ?? 0) + s.qty;

  // rAF loop minigame — tick marker theo dt thực (deps [session]: mỗi tick là
  // object mới → effect re-run, rAF cũ cancel — luôn ≤1 frame đang chờ).
  useEffect(() => {
    if (!session || session.phase !== "cooking") return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const cur = sessionRef.current;
      if (!cur || cur.phase !== "cooking") return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const next = nextCook(cur, { type: "tick", dt }, Math.random);
      setSession(next);
      if (next.phase === "cooking") raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [session]);

  const tap = useCallback(() => {
    const cur = sessionRef.current;
    if (!cur || cur.phase !== "cooking") return;
    let next = nextCook(cur, { type: "tap" }, Math.random);
    if (next.phase === "done") {
      const quality = cookQuality(next.results);
      gameActions.cook(cur.recipeId, quality);
      playSfx(quality === "perfect" ? "fishcatch" : "cook");
      setDoneMsg(
        quality === "perfect" ? t("donePerfect") : quality === "good" ? t("doneGood") : t("doneMiss"),
      );
      setTimeout(() => setDoneMsg(null), 1600);
      next = { ...next };
    } else {
      playSfx("click");
    }
    setSession(next);
    // next-intl t() ổn định theo locale — vào deps để giữ memoization (lint rule).
  }, [t]);

  // Space = tap khi minigame chạy. Modal đã qua overlay-policy ("cooking"
  // surface blocksGameplay) nên scene không nhận input — listener này là nguồn duy nhất.
  useEffect(() => {
    if (!session || session.phase !== "cooking") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        tap();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [session, tap]);

  useEffect(() => {
    if (!show) {
      const t = setTimeout(() => {
        setSession(null);
        setDoneMsg(null);
      }, 0);
      return () => clearTimeout(t);
    }
  }, [show]);

  if (!show) return null;

  const cookingRecipe = session ? KITCHEN_RECIPES.find((r) => r.id === session.recipeId) : null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={t("dialogLabel")}
      data-testid="cooking-modal"
      className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="animate-pop-in flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border-2 border-[#4a3119] bg-[#fffaf0] shadow-2xl">
        <div className="wood-panel-flat flex items-center gap-3 px-4 py-3">
          <CookingPot className="h-6 w-6 text-[#fbf7ec]" />
          <div className="flex-1">
            <h3 className="text-lg font-extrabold text-[#fbf7ec] drop-shadow hud-text">
              {t("title")}
            </h3>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#fbf7ec]/80">
              {t("subtitle")}
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            aria-label={t("close")}
            onClick={() => setShow(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {session && cookingRecipe ? (
          /* ── Minigame canh thanh (tier 2/3) ─────────────────────────────── */
          <div className="flex flex-col items-center gap-4 p-6" data-testid="cooking-minigame">
            <p className="text-sm font-bold text-[#4a3119]">
              {cookingRecipe.name} — vòng {Math.min(session.round + 1, session.rounds)}/{session.rounds} · canh thanh vào vùng xanh rồi nhấn!
            </p>
            <div
              className="relative h-10 w-full max-w-md overflow-hidden rounded-full border-2 border-[#4a3119] bg-[#e8dcc0]"
              data-testid="cooking-bar"
            >
              <div
                className="absolute inset-y-0 bg-[#7cc36b]/70"
                style={{
                  left: `${session.zoneStart * 100}%`,
                  width: `${session.zoneWidth * 100}%`,
                }}
              />
              <div
                className="absolute inset-y-0 w-1.5 bg-[#d9534f]"
                data-testid="cooking-bar-marker"
                style={{ left: `calc(${session.marker * 100}% - 3px)` }}
              />
            </div>
            {doneMsg ? (
              <p className="text-lg font-extrabold text-[#4a3119]" data-testid="cooking-result">
                {doneMsg}
              </p>
            ) : (
              <div className="flex gap-3">
                <Button onClick={tap} data-testid="cooking-tap" className="min-w-32">
                  {t("tap")}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setSession(null)}
                  title={t("abandonTitle")}
                >
                  {t("abandon")}
                </Button>
              </div>
            )}
            {doneMsg && (
              <Button onClick={() => setSession(null)} variant="secondary">
                {t("continueCooking")}
              </Button>
            )}
          </div>
        ) : (
          /* ── Danh sách công thức ─────────────────────────────────────────── */
          <div className="flex-1 overflow-y-auto p-4">
            <ul className="flex flex-col gap-2">
              {KITCHEN_RECIPES.map((r) => {
                const def = getItem(r.outputItemId);
                if (!def) return null;
                const locked = level < r.unlockLevel;
                const missing = missingInputs(r, avail);
                const canCook = !locked && missing.length === 0;
                return (
                  <li
                    key={r.id}
                    className="flex items-center gap-3 rounded-xl border border-[#d9c9a3] bg-white/70 px-3 py-2"
                  >
                    <ItemArt def={def} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-extrabold text-[#4a3119]">
                        {r.name}
                        {r.buff && (
                          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-[#fff3c4] px-2 py-0.5 text-[10px] font-bold text-[#8a6d1a]">
                            {r.buff === "speed" ? <Zap className="h-3 w-3" /> : <Star className="h-3 w-3" />}
                            {r.buff === "speed" ? "Tăng tốc" : "XP ×1.2"}
                          </span>
                        )}
                      </p>
                      <p className="text-xs font-semibold text-[#7a6a4f]">
                        {r.inputs.map((ing) => {
                          const have = avail[ing.itemId] ?? 0;
                          const short = have < ing.qty;
                          return (
                            <span key={ing.itemId} className={`inline-flex items-center gap-0.5 ${short ? "text-[#c0392b]" : ""}`}>
                              <ItemArt itemId={ing.itemId} size={14} /> {have}/{ing.qty}{" "}
                            </span>
                          );
                        })}
                        · ⚡{r.energy} · {r.tier === 1 ? t("quickCook") : t("minigameRounds", { rounds: r.rounds })}
                      </p>
                    </div>
                    {locked ? (
                      <span className="rounded-full bg-[#eee] px-2 py-1 text-[11px] font-bold text-[#888]">
                        {t("level", { level: r.unlockLevel })}
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        disabled={!canCook}
                        data-testid={`cook-${r.id}`}
                        onClick={() => {
                          if (r.tier === 1) {
                            gameActions.cook(r.id, "good");
                          } else {
                            setSession(
                              startCook(
                                { id: r.id, rounds: r.rounds, zoneWidth: r.zoneWidth, tier: r.tier },
                                Math.random,
                              ),
                            );
                          }
                        }}
                      >
                        {t("cook")}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="border-t-2 border-[#d9c9a3] bg-[#f5ecd7] px-4 py-2 text-center">
          <Button variant="secondary" size="sm" data-testid="cooking-close" onClick={() => setShow(false)}>
            {t("closeKitchen")}
          </Button>
        </div>
      </div>
    </div>
  );
}
