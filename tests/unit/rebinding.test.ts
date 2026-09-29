// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  defaultRebinding,
  loadRebinding,
  saveRebinding,
  remapKeyboard,
  resetRebinding,
  resolveKbAction,
} from "../../src/lib/game/input/rebinding";
import { InputAction } from "../../src/lib/game/input/action-map";

describe("Input rebinding (phase 8)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaultRebinding: WASD + Space + gamepad 0/1/9", () => {
    const d = defaultRebinding();
    expect(d.keyboard.KeyW).toBe(InputAction.MoveUp);
    expect(d.keyboard.Space).toBe(InputAction.Interact);
    expect(d.gamepad[0]).toBe(InputAction.Interact);
    expect(d.gamepad[9]).toBe(InputAction.Pause);
  });

  it("loadRebinding: empty localStorage → default", () => {
    const cfg = loadRebinding();
    expect(cfg.keyboard.Space).toBe(InputAction.Interact);
  });

  it("saveRebinding + loadRebinding round-trip", () => {
    const cfg = remapKeyboard(defaultRebinding(), "KeyQ", InputAction.Interact);
    saveRebinding(cfg);
    const loaded = loadRebinding();
    expect(loaded.keyboard.KeyQ).toBe(InputAction.Interact);
  });

  it("remapKeyboard: 1 code → 1 action (xóa binding cũ của code)", () => {
    const cfg = remapKeyboard(defaultRebinding(), "Space", InputAction.Pause);
    expect(cfg.keyboard.Space).toBe(InputAction.Pause);
    expect(cfg.keyboard.Space).not.toBe(InputAction.Interact);
  });

  it("resolveKbAction: rebinding > default", () => {
    const cfg = remapKeyboard(defaultRebinding(), "KeyQ", InputAction.Menu);
    expect(resolveKbAction(cfg, "KeyQ")).toBe(InputAction.Menu);
    expect(resolveKbAction(cfg, "Unknown")).toBeNull();
  });

  it("resetRebinding: về default + persist", () => {
    remapKeyboard(defaultRebinding(), "KeyZ", InputAction.Pause);
    const reset = resetRebinding();
    expect(reset.keyboard.KeyZ).toBeUndefined();
    expect(loadRebinding().keyboard.KeyW).toBe(InputAction.MoveUp);
  });

  it("remapKeyboard: remap KeyW→Interact gỡ Space cũ (1 action = 1 key sau remap)", () => {
    // Default: Space=Interact + KeyE=Interact. Remap KeyW→Interact → gỡ Space+KeyE
    // để 1 action chỉ 1 key (tránh confusion + refcount vô tình).
    const cfg = remapKeyboard(defaultRebinding(), "KeyW", InputAction.Interact);
    expect(cfg.keyboard.KeyW).toBe(InputAction.Interact);
    // Space + KeyE cũ gỡ (KeyE default cũng = Interact).
    expect(cfg.keyboard.Space).toBeUndefined();
    expect(cfg.keyboard.KeyE).toBeUndefined();
  });
});
