// InputAction map (ADR-014). Multi-device indirection: gameplay đọc actions.has('interact'),
// KHÔNG input.keyboard.checkDown(). Thêm rebind = chỉ sửa map, không rewrite gameplay.
// Device: keyboard + gamepad + touch. Radial deadzone cho stick. Last-device tracking.

export enum InputAction {
  MoveUp = "move-up",
  MoveDown = "move-down",
  MoveLeft = "move-left",
  MoveRight = "move-right",
  Interact = "interact",
  Menu = "menu",
  Pause = "pause",
  Run = "run",
}

export type DeviceKind = "keyboard" | "gamepad" | "touch";

export interface ActionState {
  /** Action đang hold down. */
  pressed: Set<InputAction>;
  /** Action vừa edge-press (frame này) — consume qua takeJustPressed. */
  justPressed: Set<InputAction>;
  /** Last device nhận input — swap prompt UI (gamepad → "Press A" vs keyboard → "Space"). */
  lastDevice: DeviceKind;
  /** Buffer queue cho coyote time: action → timestamp expire (ms). */
  buffer: Map<InputAction, number>;
  /**
   * Reference count: action → số key code đang hold trigger action đó.
   * Multi-key-to-same-action (default Space+KeyE = Interact, hoặc user rebind)
   * → keyup 1 key không được remove action khi key kia vẫn hold (stuck-released bug).
   */
  holdCount: Map<InputAction, number>;
  /**
   * Key codes đang physical hold (bộ tách auto-repeat). Browser fire keydown lặp
   * khi giữ phím (không keyup giữa) → nếu tăng refcount mỗi keydown thì release
   * 1 lần không đủ drop action. Set này chặn keydown repeat (code đã hold).
   */
  heldCodes: Set<string>;
}

export function createActionState(): ActionState {
  return {
    pressed: new Set(),
    justPressed: new Set(),
    lastDevice: "keyboard",
    buffer: new Map(),
    holdCount: new Map(),
    heldCodes: new Set(),
  };
}

/** Key/code → Action binding (keyboard). Mặc định WASD + mũi tên + Space/E/Escape. */
export const DEFAULT_KB_BINDINGS: Record<string, InputAction> = {
  KeyW: InputAction.MoveUp,
  ArrowUp: InputAction.MoveUp,
  KeyS: InputAction.MoveDown,
  ArrowDown: InputAction.MoveDown,
  KeyA: InputAction.MoveLeft,
  ArrowLeft: InputAction.MoveLeft,
  KeyD: InputAction.MoveRight,
  ArrowRight: InputAction.MoveRight,
  Space: InputAction.Interact,
  KeyE: InputAction.Interact,
  Tab: InputAction.Menu,
  Escape: InputAction.Pause,
  ShiftLeft: InputAction.Run,
  ShiftRight: InputAction.Run,
};

/** Feed keyboard event → mutate state. Trả action nếu edge-press.
 *  `bindings` = user rebinding map (loadRebinding().keyboard); mặc định default bindings. */
export function feedKeyboard(
  state: ActionState,
  code: string,
  isDown: boolean,
  bindings: Record<string, InputAction> = DEFAULT_KB_BINDINGS,
): InputAction | null {
  const action = bindings[code];
  if (!action) return null;
  state.lastDevice = "keyboard";
  if (isDown) {
    // Auto-repeat guard: browser fire keydown lặp khi giữ phím (không keyup giữa).
    // Bỏ qua repeat → refcount chỉ tăng 1 lần/physical-press.
    if (state.heldCodes.has(code)) return action;
    state.heldCodes.add(code);
    const count = (state.holdCount.get(action) ?? 0) + 1;
    state.holdCount.set(action, count);
    if (!state.pressed.has(action)) state.justPressed.add(action);
    state.pressed.add(action);
    return action;
  }
  // Keyup: chỉ drop action khi không còn key nào hold nó (refcount → 0).
  // Trước đây delete blind → 2 key cùng action (Space+KeyE = Interact),
  // release Space → Interact mất dù KeyE vẫn hold → player đứng hình.
  state.heldCodes.delete(code);
  const remaining = (state.holdCount.get(action) ?? 0) - 1;
  if (remaining > 0) {
    state.holdCount.set(action, remaining);
  } else {
    state.holdCount.delete(action);
    state.pressed.delete(action);
  }
  return null;
}

/**
 * Radial deadzone cho gamepad stick. Per-axis = square hole → snap axis; radial = round.
 * Trả unit vector đã deadzone, hoặc null nếu trong deadzone.
 */
export function radialDeadzone(
  x: number,
  y: number,
  deadzone = 0.25,
): { x: number; y: number } | null {
  const mag = Math.sqrt(x * x + y * y);
  if (mag < deadzone) return null;
  // Rescale từ [deadzone, 1] → [0, 1] để tránh gap nhảy.
  const norm = Math.min(1, (mag - deadzone) / (1 - deadzone));
  return { x: (x / mag) * norm, y: (y / mag) * norm };
}

/** Map stick vector → pressed actions (cho movement). Mutate state.pressed. */
export function feedStick(state: ActionState, x: number, y: number, deadzone = 0.25): void {
  const v = radialDeadzone(x, y, deadzone);
  // Clear movement trước rồi set lại (stick = continuous, không edge).
  state.pressed.delete(InputAction.MoveUp);
  state.pressed.delete(InputAction.MoveDown);
  state.pressed.delete(InputAction.MoveLeft);
  state.pressed.delete(InputAction.MoveRight);
  if (!v) return;
  state.lastDevice = "gamepad";
  if (v.y < -0.3) state.pressed.add(InputAction.MoveUp);
  if (v.y > 0.3) state.pressed.add(InputAction.MoveDown);
  if (v.x < -0.3) state.pressed.add(InputAction.MoveLeft);
  if (v.x > 0.3) state.pressed.add(InputAction.MoveRight);
}

/** Buffer/coyote time: ghi action với expire timestamp (ms). */
export function bufferAction(state: ActionState, action: InputAction, nowMs: number, windowMs = 100): void {
  state.buffer.set(action, nowMs + windowMs);
}

/** Lấy buffered action nếu còn trong window; clear sau khi lấy. */
export function consumeBuffer(state: ActionState, action: InputAction, nowMs: number): boolean {
  const exp = state.buffer.get(action);
  if (exp === undefined) return false;
  if (nowMs > exp) {
    state.buffer.delete(action);
    return false;
  }
  state.buffer.delete(action);
  return true;
}

/** End-of-frame: clear justPressed. Gọi sau khi gameplay đọc. */
export function endFrame(state: ActionState): void {
  state.justPressed.clear();
}
