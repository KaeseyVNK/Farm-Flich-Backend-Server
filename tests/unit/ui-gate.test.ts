import { describe, it, expect, beforeEach } from "vitest";
import { isGameplayBlocked } from "@/lib/game/ui-gate";
import { useUiStore } from "@/store/uiStore";
import { useRaidStore } from "@/store/raidStore";

/**
 * ui-gate — single source of truth cho "gameplay có bị chặn?". Mọi layer
 * (GameEngine legacy, FarmScene Phaser, Hotbar hotkeys) đọc helper này.
 * Trước đây duplicate list ở 4 nơi → raid phase không được gate → WASD di
 * chuyển player ẩn sau raid backdrop + clock advance trong lúc raid.
 */
const blockedUiStates: {
  name: string;
  apply: () => void;
  clear: () => void;
}[] = [
  {
    name: "showShop",
    apply: () => useUiStore.getState().setShowShop(true),
    clear: () => useUiStore.getState().setShowShop(false),
  },
  {
    name: "dialogueNpc",
    apply: () => useUiStore.getState().openDialogue("maru"),
    clear: () => useUiStore.getState().closeDialogue(),
  },
  {
    name: "giftTarget",
    apply: () => useUiStore.getState().openGiftPicker("maru"),
    clear: () => useUiStore.getState().closeGiftPicker(),
  },
  {
    name: "showStartScreen",
    apply: () => useUiStore.getState().setShowStartScreen(true),
    clear: () => useUiStore.getState().setShowStartScreen(false),
  },
  {
    name: "activePanel",
    apply: () => useUiStore.getState().openPanel("inventory"),
    clear: () => useUiStore.getState().closePanel(),
  },
];

beforeEach(() => {
  useUiStore.getState().setShowShop(false);
  useUiStore.getState().closeDialogue();
  useUiStore.getState().closeGiftPicker();
  useUiStore.getState().setShowStartScreen(false);
  useUiStore.getState().closePanel();
  useRaidStore.getState().reset();
});

describe("isGameplayBlocked", () => {
  it("default (không overlay, không raid) → false", () => {
    expect(isGameplayBlocked()).toBe(false);
  });

  it.each(blockedUiStates)("overlay $name → true", ({ apply, clear }) => {
    apply();
    expect(isGameplayBlocked()).toBe(true);
    clear();
    expect(isGameplayBlocked()).toBe(false);
  });

  it.each(["lobby", "active", "ended"] as const)(
    "raid phase $phase → true (full-screen che gameplay)",
    (phase) => {
      useRaidStore.getState().setPhase(phase);
      expect(isGameplayBlocked()).toBe(true);
    },
  );

  it("raid idle → không chặn gameplay", () => {
    useRaidStore.getState().setPhase("idle");
    expect(isGameplayBlocked()).toBe(false);
  });

  it("raid active + sau đó reset → unblock", () => {
    useRaidStore.getState().setPhase("active");
    expect(isGameplayBlocked()).toBe(true);
    useRaidStore.getState().reset();
    expect(isGameplayBlocked()).toBe(false);
  });
});
