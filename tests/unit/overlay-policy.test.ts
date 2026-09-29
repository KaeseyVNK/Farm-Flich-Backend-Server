// Phase 2 — overlay policy contract (implementation-handoff-contract §ui-gate and pause).
// resolveSurface is the ONE pure resolver both ui-gate and GameLayout must derive from. It
// has no React/Zustand/DOM. This table-driven test locks every contract row + precedence so
// the two current divergent lists (isGameplayBlocked includes raid; GameLayout pause does
// not) converge on a single source of truth.
import { describe, it, expect } from "vitest";
import { resolveSurface } from "../../src/lib/game/overlay-policy";
import type { OverlayInputs } from "../../src/lib/game/overlay-policy";

// Helper: an all-clear baseline (raidPhase idle, nothing open).
const NONE: OverlayInputs = {
  activePanel: null,
  dialogueNpc: null,
  giftTarget: null,
  showShop: false,
  showCooking: false,
  decorMode: false,
  showStartScreen: false,
  raidPhase: "idle",
  raidPuzzleOpen: false,
};

describe("resolveSurface — isolation per contract row", () => {
  const cases: Array<{
    name: string;
    mutate: (i: OverlayInputs) => OverlayInputs;
    top: string;
    blocks: boolean;
    pauses: boolean;
    escape: string;
    layer: string;
  }> = [
    {
      name: "none — farm owns input",
      mutate: (i) => i,
      top: "none", blocks: false, pauses: false, escape: "none", layer: "canvas",
    },
    {
      name: "start screen — blocking, no implicit Escape close",
      mutate: (i) => ({ ...i, showStartScreen: true }),
      top: "start", blocks: true, pauses: true, escape: "none", layer: "mode",
    },
    {
      name: "raid puzzle — highest within raid",
      mutate: (i) => ({ ...i, raidPhase: "active", raidPuzzleOpen: true }),
      top: "raid-puzzle", blocks: true, pauses: true, escape: "delegate-raid", layer: "mode",
    },
    {
      name: "raid lobby",
      mutate: (i) => ({ ...i, raidPhase: "lobby" }),
      top: "raid-lobby", blocks: true, pauses: true, escape: "delegate-raid", layer: "mode",
    },
    {
      name: "raid active",
      mutate: (i) => ({ ...i, raidPhase: "active" }),
      top: "raid-active", blocks: true, pauses: true, escape: "delegate-raid", layer: "mode",
    },
    {
      name: "raid ended",
      mutate: (i) => ({ ...i, raidPhase: "ended" }),
      top: "raid-ended", blocks: true, pauses: true, escape: "delegate-raid", layer: "mode",
    },
    {
      name: "shop",
      mutate: (i) => ({ ...i, showShop: true }),
      top: "shop", blocks: true, pauses: true, escape: "close-shop", layer: "modal",
    },
    {
      name: "cooking (W2)",
      mutate: (i) => ({ ...i, showCooking: true }),
      top: "cooking", blocks: true, pauses: true, escape: "close-cooking", layer: "modal",
    },
    {
      name: "decor-mode (W3) — không blocks gameplay (scene reroute), không pause clock",
      mutate: (i) => ({ ...i, decorMode: true }),
      top: "decor-mode", blocks: false, pauses: false, escape: "exit-decor", layer: "mode",
    },
    {
      name: "gift picker",
      mutate: (i) => ({ ...i, giftTarget: "lewis" }),
      top: "gift", blocks: true, pauses: true, escape: "close-gift", layer: "modal",
    },
    {
      name: "dialogue",
      mutate: (i) => ({ ...i, dialogueNpc: "lewis" }),
      top: "dialogue", blocks: true, pauses: true, escape: "close-dialogue", layer: "modal",
    },
    {
      name: "panel (inventory)",
      mutate: (i) => ({ ...i, activePanel: "inventory" }),
      top: "panel", blocks: true, pauses: true, escape: "close-panel", layer: "panel",
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      const p = resolveSurface(c.mutate({ ...NONE }));
      expect(p.top).toBe(c.top);
      expect(p.blocksGameplay).toBe(c.blocks);
      expect(p.pausesClock).toBe(c.pauses);
      expect(p.escape).toBe(c.escape);
      expect(p.layer).toBe(c.layer);
    });
  }
});

describe("resolveSurface — precedence (higher wins)", () => {
  // Contract: start → raid puzzle → raid state → shop → gift → dialogue → panel → none.
  it("start beats raid/shop/gift/dialogue/panel", () => {
    const p = resolveSurface({
      ...NONE,
      showStartScreen: true,
      raidPhase: "active",
      showShop: true,
      giftTarget: "lewis",
      dialogueNpc: "robin",
      activePanel: "inventory",
    });
    expect(p.top).toBe("start");
  });

  it("raid puzzle beats raid-state and shop", () => {
    const p = resolveSurface({ ...NONE, raidPhase: "active", raidPuzzleOpen: true, showShop: true });
    expect(p.top).toBe("raid-puzzle");
  });

  it("raid state beats shop/gift/dialogue/panel", () => {
    const p = resolveSurface({
      ...NONE,
      raidPhase: "lobby",
      showShop: true,
      giftTarget: "lewis",
      dialogueNpc: "robin",
      activePanel: "inventory",
    });
    expect(p.top).toBe("raid-lobby");
  });

  it("shop beats gift/dialogue/panel (farm surface priority)", () => {
    const p = resolveSurface({
      ...NONE,
      showShop: true,
      giftTarget: "lewis",
      dialogueNpc: "robin",
      activePanel: "inventory",
    });
    expect(p.top).toBe("shop");
  });

  it("gift beats dialogue/panel", () => {
    const p = resolveSurface({
      ...NONE,
      giftTarget: "lewis",
      dialogueNpc: "robin",
      activePanel: "inventory",
    });
    expect(p.top).toBe("gift");
  });

  it("dialogue beats panel", () => {
    const p = resolveSurface({ ...NONE, dialogueNpc: "robin", activePanel: "inventory" });
    expect(p.top).toBe("dialogue");
  });

  it("raidPuzzleOpen ignored when raidPhase idle (no phantom raid surface)", () => {
    const p = resolveSurface({ ...NONE, raidPhase: "idle", raidPuzzleOpen: true });
    expect(p.top).toBe("none");
  });
});

describe("resolveSurface — purity", () => {
  it("không mutate input", () => {
    const input: OverlayInputs = { ...NONE, showShop: true };
    const snapshot = JSON.stringify(input);
    resolveSurface(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
