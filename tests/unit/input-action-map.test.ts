import { describe, it, expect, beforeEach } from "vitest";
import {
  createActionState,
  feedKeyboard,
  feedStick,
  radialDeadzone,
  bufferAction,
  consumeBuffer,
  endFrame,
  DEFAULT_KB_BINDINGS,
  InputAction,
} from "../../src/lib/game/input/action-map";

describe("InputAction map", () => {
  let s: ReturnType<typeof createActionState>;
  beforeEach(() => {
    s = createActionState();
  });

  it("keyboard: WASD + Space map đúng action", () => {
    expect(DEFAULT_KB_BINDINGS.KeyW).toBe(InputAction.MoveUp);
    expect(DEFAULT_KB_BINDINGS.Space).toBe(InputAction.Interact);
    expect(DEFAULT_KB_BINDINGS.Escape).toBe(InputAction.Pause);
  });

  it("feedKeyboard edge-press → justPressed + pressed; release xóa pressed", () => {
    const a = feedKeyboard(s, "Space", true);
    expect(a).toBe(InputAction.Interact);
    expect(s.pressed.has(InputAction.Interact)).toBe(true);
    expect(s.justPressed.has(InputAction.Interact)).toBe(true);
    // repeat hold → không justPressed nữa
    feedKeyboard(s, "Space", true);
    expect(s.justPressed.size).toBe(1);
    feedKeyboard(s, "Space", false);
    expect(s.pressed.has(InputAction.Interact)).toBe(false);
  });

  it("feedKeyboard track lastDevice = keyboard", () => {
    feedKeyboard(s, "KeyD", true);
    expect(s.lastDevice).toBe("keyboard");
  });

  it("radialDeadzone: trong deadzone → null; ngoài → rescale unit", () => {
    expect(radialDeadzone(0.1, 0.1, 0.25)).toBeNull();
    const v = radialDeadzone(1, 0, 0.25)!;
    expect(v.x).toBeCloseTo(1);
    expect(v.y).toBeCloseTo(0);
    // diagonal normalize
    const d = radialDeadzone(0.7, 0.7, 0.25)!;
    expect(Math.sqrt(d.x * d.x + d.y * d.y)).toBeCloseTo(1, 1);
  });

  it("feedStick: hướng → movement actions; lastDevice gamepad", () => {
    feedStick(s, 0, -1, 0.25); // up
    expect(s.pressed.has(InputAction.MoveUp)).toBe(true);
    expect(s.lastDevice).toBe("gamepad");
    feedStick(s, 1, 0, 0.25); // right
    expect(s.pressed.has(InputAction.MoveRight)).toBe(true);
    expect(s.pressed.has(InputAction.MoveUp)).toBe(false); // cleared
  });

  it("buffer/coyote: ghi + consume trong window; quá window → false; clear sau consume", () => {
    bufferAction(s, InputAction.Interact, 1000, 100);
    expect(consumeBuffer(s, InputAction.Interact, 1050)).toBe(true);
    // consumed → lần 2 false
    expect(consumeBuffer(s, InputAction.Interact, 1060)).toBe(false);
    bufferAction(s, InputAction.Interact, 1000, 100);
    expect(consumeBuffer(s, InputAction.Interact, 1200)).toBe(false); // quá window
  });

  it("endFrame clear justPressed", () => {
    feedKeyboard(s, "Space", true);
    expect(s.justPressed.size).toBeGreaterThan(0);
    endFrame(s);
    expect(s.justPressed.size).toBe(0);
  });

  it("multi-key-to-same-action (Space+KeyE=Interact): release 1 key không drop action khi key kia hold", () => {
    // Default bindings: Space + KeyE đều = Interact.
    feedKeyboard(s, "Space", true);
    feedKeyboard(s, "KeyE", true);
    expect(s.pressed.has(InputAction.Interact)).toBe(true);
    // Release Space → Interact VẪN pressed (KeyE hold). Trước đây delete blind → stuck-released.
    feedKeyboard(s, "Space", false);
    expect(s.pressed.has(InputAction.Interact)).toBe(true);
    expect(s.holdCount.get(InputAction.Interact)).toBe(1);
    // Release KeyE → Interact mới drop (refcount → 0).
    feedKeyboard(s, "KeyE", false);
    expect(s.pressed.has(InputAction.Interact)).toBe(false);
    expect(s.holdCount.has(InputAction.Interact)).toBe(false);
  });

  describe("Run action", () => {
    it("ShiftLeft/ShiftRight map sang InputAction.Run", () => {
      const s = createActionState();
      feedKeyboard(s, "ShiftLeft", true);
      feedKeyboard(s, "ShiftRight", true);
      expect(s.pressed.has(InputAction.Run)).toBe(true);
      feedKeyboard(s, "ShiftLeft", false);
      expect(s.pressed.has(InputAction.Run)).toBe(true); // vẫn giữ (phím kia còn)
      feedKeyboard(s, "ShiftRight", false);
      expect(s.pressed.has(InputAction.Run)).toBe(false);
    });
  });

  it("auto-repeat keydown không tăng refcount (browser repeat không keyup giữa)", () => {
    // Browser fire keydown lặp khi giữ phím. Nếu refcount tăng mỗi keydown,
    // release 1 keyup không đủ drop → stuck. Guard heldCodes chặn repeat.
    feedKeyboard(s, "KeyW", true);
    expect(s.holdCount.get(InputAction.MoveUp)).toBe(1);
    feedKeyboard(s, "KeyW", true); // auto-repeat
    feedKeyboard(s, "KeyW", true); // auto-repeat
    expect(s.holdCount.get(InputAction.MoveUp)).toBe(1); // vẫn 1
    feedKeyboard(s, "KeyW", false); // 1 keyup → drop
    expect(s.pressed.has(InputAction.MoveUp)).toBe(false);
  });
});
