"use client";

import { useTranslations } from "next-intl";
import type { MouseEvent } from "react";
import { useUiStore } from "@/store/uiStore";
import { useFarmStore } from "@/store/farmStore";
import { useInventoryStore } from "@/store/inventoryStore";
import { useProgressionStore } from "@/store/progressionStore";
import { useQuestStore } from "@/store/questStore";
import { useTutorialStore } from "@/store/tutorialStore";
import { activeFarmGoal, type FarmGoalId } from "@/lib/game/week-quest";
import { getTutorialStep, TUTORIAL_ORDER } from "@/lib/game/tutorial/tutorial-catalog";
import { CROPS } from "@/lib/game/data";

const GOAL_KEY: Record<FarmGoalId, `farmGoal.${FarmGoalId}.title`> = {
  hoe: "farmGoal.hoe.title",
  plant: "farmGoal.plant.title",
  water: "farmGoal.water.title",
  harvest: "farmGoal.harvest.title",
  sell: "farmGoal.sell.title",
  unlock2: "farmGoal.unlock2.title",
  unlock3: "farmGoal.unlock3.title",
  unlock4: "farmGoal.unlock4.title",
};
const WHERE_KEY: Record<FarmGoalId, `farmGoal.${FarmGoalId}.where`> = {
  hoe: "farmGoal.hoe.where",
  plant: "farmGoal.plant.where",
  water: "farmGoal.water.where",
  harvest: "farmGoal.harvest.where",
  sell: "farmGoal.sell.where",
  unlock2: "farmGoal.unlock2.where",
  unlock3: "farmGoal.unlock3.where",
  unlock4: "farmGoal.unlock4.where",
};

/** Slim left-edge pin: W9 tutorial khi chưa xong chuỗi 14 bước — thay farmGoal
 *  (hayday loop). Xong chuỗi → quay về farmGoal bình thường. Click mở calendar
 *  (nơi hiện panel claim thưởng). */
export function HudQuest() {
  const t = useTranslations("hud");
  const terrain = useFarmStore((s) => s.terrain);
  const crops = useFarmStore((s) => s.crops);
  const slots = useInventoryStore((s) => s.slots);
  const level = useProgressionStore((s) => s.level);
  const togglePanel = useUiStore((s) => s.togglePanel);
  const tutorialStep = useQuestStore((s) => s.tutorialStep);
  const tutorialClaimed = useQuestStore((s) => s.tutorialClaimed);
  // W9P5 fix: probe counters sống trong tutorialStore — subscribe nguyên store để
  // claim button xuất hiện ĐÚNG lúc check pass (trước đây đọc getState() tĩnh —
  // bump counter không re-render → pin kẹt "0/1" mãi).
  useTutorialStore();
  const inTutorial = tutorialStep < TUTORIAL_ORDER.length;
  const activeId = inTutorial ? useQuestStore.getState().tutorialActive() : null;
  const activeStep = activeId ? getTutorialStep(activeId) : null;
  const [cur, target] = useQuestStore.getState().tutorialProgressOf();
  const claimable =
    inTutorial && activeStep && !tutorialClaimed.includes(activeStep.id) && cur >= target;
  // Claim 1 click (atomic — claimTutorial tự guard double)
  const onClaim = (e: MouseEvent) => {
    e.stopPropagation();
    useQuestStore.getState().claimTutorial();
  };

  const cropIds = Object.keys(CROPS);
  const invCropTotal = slots.reduce(
    (sum, s) => (s && cropIds.includes(s.itemId) ? sum + s.qty : sum),
    0,
  );
  const goal = activeFarmGoal({ terrain, crops, invCropTotal, level });
  const title = inTutorial && activeStep ? activeStep.title : t(GOAL_KEY[goal]);
  const where = inTutorial && activeStep ? activeStep.hint : t(WHERE_KEY[goal]);

  return (
    <button
      type="button"
      className={`hud-quest ${claimable ? "hud-quest-claimable" : ""}`}
      data-testid="hud-quest"
      aria-label={`${t(inTutorial ? "tutorial.kicker" : "questToday")}: ${title}`}
      onClick={inTutorial ? () => togglePanel("calendar") : () => togglePanel("calendar")}
    >
      <span className="hud-quest-kicker">
        {inTutorial ? `${t("tutorial.kicker")} · ${t("tutorial.step", { step: Math.min(tutorialStep + 1, 14) })}` : t("questToday")}
      </span>
      <span className="hud-quest-title">{title}</span>
      {inTutorial ? (
        <span className="hud-quest-where">
          {claimable ? t("tutorial.claimable") : `${cur}/${target} · ${where}`}
        </span>
      ) : where ? (
        <span className="hud-quest-where">{where}</span>
      ) : null}
      {inTutorial && claimable ? (
        <span
          role="button"
          tabIndex={0}
          data-testid="hud-quest-claim"
          className="hud-quest-claim"
          onClick={onClaim}
          onKeyDown={(e) => e.key === "Enter" && onClaim(e as unknown as MouseEvent)}
        >
          {t("tutorial.claim")}
        </span>
      ) : null}
    </button>
  );
}