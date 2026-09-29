"use client";

import { useUiStore } from "@/store/uiStore";
import { listSaves, loadGame, deleteSave, type SaveSlot } from "@/lib/game/save";
import { gameActions } from "@/lib/game/actions";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { loadAll } from "@/lib/game/assets/asset-loader";
import { loadGlobalMeta } from "@/lib/game/story/ng-plus";
import { initialiseFreshFarm } from "@/lib/game/new-farm-state";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { GameIcon } from "@/components/game-ui/game-icon";
import { PixelButton } from "@/components/game-ui/pixel-button";
import { PixelFrame } from "@/components/game-ui/pixel-frame";
import { StartScreenSaveSlot } from "./start-screen-save-slot";

const SLOT_LABELS: Record<SaveSlot, string> = {
  slot1: "Slot 1",
  slot2: "Slot 2",
  slot3: "Slot 3",
};

export function StartScreen() {
  const show = useUiStore((s) => s.showStartScreen);
  const setShow = useUiStore((s) => s.setShowStartScreen);
  const setActiveSlot = useUiStore((s) => s.setActiveSlot);
  const notify = useUiStore((s) => s.notify);
  const t = useTranslations("start");
  const tc = useTranslations("credits");
  const [saves, setSaves] = useState<Awaited<ReturnType<typeof listSaves>>>([]);
  const [loading, setLoading] = useState(true);
  const [busySlot, setBusySlot] = useState<SaveSlot | null>(null);
  const [assetProgress, setAssetProgress] = useState(0);
  const [endingUnlocked, setEndingUnlocked] = useState<string[]>([]);
  const startRef = useRef<HTMLDivElement>(null);
  useFocusTrap(show, startRef);

  useEffect(() => {
    if (!show) return;
    let active = true;
    loadAll((r) => { if (active) setAssetProgress(r); }).catch(() => { /* fallback đã handle */ });
    Promise.resolve()
      .then(() => { if (active) setLoading(true); })
      .then(() => listSaves())
      .then((list) => { if (active) setSaves(list); })
      .catch(() => { if (active) setSaves([]); })
      .finally(() => {
        if (!active) return;
        setLoading(false);
        setEndingUnlocked(loadGlobalMeta().endingUnlocked);
      });
    return () => { active = false; };
  }, [show]);

  if (!show) return null;

  const startNew = (slot: SaveSlot) => {
    setActiveSlot(slot);
    initialiseFreshFarm({ mode: "reset" });
    setShow(false);
    notify(`Nông trại Tidecrest đã tạo ở ${SLOT_LABELS[slot]}`, "info");
  };

  const continueSlot = async (slot: SaveSlot) => {
    setBusySlot(slot);
    try {
      const data = await loadGame(slot);
      if (!data) {
        await deleteSave(slot);
        initialiseFreshFarm({ mode: "reset" });
        setActiveSlot(slot);
        setShow(false);
        notify("Save cũ không dùng được. Đã tạo nông trại Tidecrest.", "info");
        return;
      }
      setActiveSlot(slot);
      gameActions.applySaveData(data);
      setShow(false);
      notify(`Đã tải ${SLOT_LABELS[slot]}`, "success");
    } catch {
      await deleteSave(slot);
      initialiseFreshFarm({ mode: "reset" });
      setActiveSlot(slot);
      setShow(false);
      notify("Save cũ đã xóa. Nông trại Tidecrest mới.", "info");
    } finally {
      setBusySlot(null);
    }
  };

  const deleteSlot = async (slot: SaveSlot) => {
    setBusySlot(slot);
    try {
      await deleteSave(slot);
      setSaves(await listSaves());
      notify(`Đã xóa ${SLOT_LABELS[slot]}`, "info");
    } finally {
      setBusySlot(null);
    }
  };

  const hasAnySave = saves.some((s) => s.exists);

  const startNewGamePlus = () => {
    setActiveSlot("slot1");
    initialiseFreshFarm({ mode: "ngPlus" });
    setShow(false);
    notify("New Game+ — câu chuyện bắt đầu lại, thành tựu giữ nguyên.", "success");
  };

  return (
    <div
      ref={startRef}
      role="dialog"
      aria-modal="true"
      aria-label={t("title")}
      className="start-screen pointer-events-auto absolute inset-0 z-[var(--z-mode)] flex items-center justify-center overflow-hidden p-4"
    >
      <PixelFrame variant="paper" className="start-screen-card animate-pop-in fancy-scroll relative z-10">
        <div className="mb-5 text-center">
          <GameIcon id="brand-farm" size={36} decorative className="mx-auto mb-2 text-[var(--mf-leaf)]" />
          <h1 className="start-screen-title">{t("title")}</h1>
          <p className="start-screen-subtitle">{t("subtitle")}</p>
          <p className="mt-2 font-[family-name:var(--font-vt323)] text-[16px] text-[var(--mf-ink)]">
            {t("story")}
          </p>
        </div>

        {assetProgress < 1 && (
          <div className="mb-4">
            <p className="mb-1 text-center font-[family-name:var(--font-vt323)] text-[15px] text-[var(--mf-muted-ink)]">
              {t("loadingAssets")} {Math.round(assetProgress * 100)}%
            </p>
            <div className="energy-track">
              <div className="energy-fill energy-fill-high" style={{ width: `${Math.round(assetProgress * 100)}%` }} />
            </div>
          </div>
        )}

        <h2 className="mb-2 font-[family-name:var(--font-vt323)] text-[15px] text-[var(--mf-muted-ink)]">
          {t("saveSlots")}
        </h2>
        {loading ? (
          <p className="py-6 text-center font-[family-name:var(--font-vt323)] text-[var(--mf-muted-ink)]">
            {t("loadingAssets")}
          </p>
        ) : (
          <div className="space-y-2">
            {saves.map((s) => (
              <StartScreenSaveSlot
                key={s.slot}
                meta={s}
                busy={busySlot === s.slot}
                onContinue={() => continueSlot(s.slot)}
                onNew={() => startNew(s.slot)}
                onDelete={() => deleteSlot(s.slot)}
              />
            ))}
          </div>
        )}

        {endingUnlocked.length > 0 && (
          <PixelButton variant="secondary" onClick={startNewGamePlus} className="mt-3 w-full">
            {t("newGamePlus", { count: endingUnlocked.length })}
          </PixelButton>
        )}

        {hasAnySave && (
          <PixelButton
            variant="primary"
            className="mt-3 w-full"
            onClick={() => {
              const mostRecent = saves
                .filter((s) => s.exists)
                .sort((a, b) => b.savedAt - a.savedAt)[0];
              if (mostRecent) continueSlot(mostRecent.slot);
            }}
          >
            {t("continueLatest")}
          </PixelButton>
        )}

        <p className="mt-4 text-center">
          <a
            href="/login"
            className="font-[family-name:var(--font-vt323)] text-[15px] text-[var(--mf-leaf)] underline decoration-dotted underline-offset-2"
          >
            {t("loginUpgrade")}
          </a>
        </p>
        <p className="mt-3 text-center font-[family-name:var(--font-vt323)] text-[15px] text-[var(--mf-muted-ink)]">
          {t("controls")}
        </p>
        <p className="mt-2 text-center font-[family-name:var(--font-vt323)] text-[13px] text-[var(--mf-muted-ink)]">
          {tc("assetsBy")} · {tc("assetsUrl")}
        </p>
      </PixelFrame>
    </div>
  );
}
