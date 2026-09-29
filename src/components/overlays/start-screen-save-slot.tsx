"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { GameIcon } from "@/components/game-ui/game-icon";
import { PixelButton } from "@/components/game-ui/pixel-button";
import { PixelFrame } from "@/components/game-ui/pixel-frame";
import type { GameIconId } from "@/components/game-ui/game-icon-id";
import type { SaveSlot, SaveMeta } from "@/lib/game/save";

const SLOT_LABELS: Record<SaveSlot, string> = {
  slot1: "Slot 1",
  slot2: "Slot 2",
  slot3: "Slot 3",
};

const SLOT_ICONS: Record<SaveSlot, GameIconId> = {
  slot1: "brand-farm",
  slot2: "brand-farm",
  slot3: "brand-farm",
};

export function StartScreenSaveSlot({
  meta,
  busy,
  onContinue,
  onNew,
  onDelete,
}: {
  meta: SaveMeta;
  busy: boolean;
  onContinue: () => void;
  onNew: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("start");
  const tc = useTranslations("common");
  const icon = SLOT_ICONS[meta.slot];
  const label = SLOT_LABELS[meta.slot];
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (deleteTimer.current) clearTimeout(deleteTimer.current);
  }, []);

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      deleteTimer.current = setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    if (deleteTimer.current) clearTimeout(deleteTimer.current);
    deleteTimer.current = null;
    setConfirmDelete(false);
    onDelete();
  };

  return (
    <PixelFrame
      variant="paper"
      className={`start-slot ${meta.exists ? "start-slot-live" : "start-slot-empty"}`}
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[4px] border-2 border-[var(--mf-frame)] bg-[var(--mf-paper)]">
        <GameIcon id={icon} size={24} decorative className="text-[var(--mf-leaf)]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-[family-name:var(--font-vt323)] text-lg text-[var(--mf-ink)]">{label}</p>
        {meta.exists && meta.preview ? (
          <p className="font-[family-name:var(--font-vt323)] text-[15px] text-[var(--mf-muted-ink)]">
            {meta.preview.season} · {meta.preview.day}/{meta.preview.year}
            <span className="ml-2 text-[var(--mf-harvest)]">{meta.preview.gold}g</span>
          </p>
        ) : (
          <p className="font-[family-name:var(--font-vt323)] text-[15px] text-[var(--mf-muted-ink)]">
            {t("emptySlot")}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {busy ? (
          <span className="px-2 font-[family-name:var(--font-vt323)] text-[var(--mf-muted-ink)]">
            {tc("loading")}
          </span>
        ) : meta.exists ? (
          <>
            <PixelButton variant="primary" onClick={onContinue} aria-label={`${t("load")} ${label}`} className="min-h-11 px-3">
              {t("load")}
            </PixelButton>
            <PixelButton
              variant={confirmDelete ? "danger" : "quiet"}
              onClick={handleDelete}
              aria-label={confirmDelete ? `${t("confirmDelete")} ${label}` : `${t("delete")} ${label}`}
              className="min-h-11 px-3"
            >
              {confirmDelete ? t("confirmDelete") : t("delete")}
            </PixelButton>
          </>
        ) : (
          <PixelButton variant="secondary" onClick={onNew} aria-label={`${t("newFarm")} ${label}`} className="min-h-11 px-3">
            {t("newFarm")}
          </PixelButton>
        )}
      </div>
    </PixelFrame>
  );
}
