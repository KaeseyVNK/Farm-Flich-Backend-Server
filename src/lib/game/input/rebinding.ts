// Input rebinding (phase 8 — ADR-014 foundation phase 2, UI phase 8).
// Remap key/button/touch zone per action. Persist localStorage.
import { InputAction, DEFAULT_KB_BINDINGS } from "./action-map";

export interface RebindingConfig {
  /** code → action map (override default). */
  keyboard: Record<string, InputAction>;
  /** gamepad button index → action. */
  gamepad: Record<number, InputAction>;
}

const STORAGE_KEY = "hh-rebinding";

export function defaultRebinding(): RebindingConfig {
  return {
    keyboard: { ...DEFAULT_KB_BINDINGS },
    gamepad: { 0: InputAction.Interact, 1: InputAction.Menu, 9: InputAction.Pause },
  };
}

export function loadRebinding(): RebindingConfig {
  if (typeof localStorage === "undefined") return defaultRebinding();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultRebinding();
    const p = JSON.parse(raw) as Partial<RebindingConfig>;
    return {
      keyboard: { ...DEFAULT_KB_BINDINGS, ...(p.keyboard ?? {}) },
      gamepad: { ...defaultRebinding().gamepad, ...(p.gamepad ?? {}) },
    };
  } catch {
    return defaultRebinding();
  }
}

export function saveRebinding(cfg: RebindingConfig): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    // quota
  }
}

/** Remap một key sang action mới. Trả config mới (pure-ish; clone). */
export function remapKeyboard(
  cfg: RebindingConfig,
  code: string,
  action: InputAction,
): RebindingConfig {
  const keyboard = { ...cfg.keyboard };
  // Xóa code cũ khỏi action khác (1 code → 1 action).
  delete keyboard[code];
  // Conflict: nếu action đã mapped bởi code khác, gỡ code cũ để 1 action = 1 key
  // (trước đây giữ cả 2 → 2 key cùng trigger 1 action, refcount ổn nhưng confusing
  // + SettingsPanel không hiển thị đúng key active).
  for (const [c, a] of Object.entries(keyboard)) {
    if (a === action && c !== code) delete keyboard[c];
  }
  keyboard[code] = action;
  return { ...cfg, keyboard };
}

/** Reset về default. */
export function resetRebinding(): RebindingConfig {
  const d = defaultRebinding();
  saveRebinding(d);
  return d;
}

/** Resolve action cho keyboard code (rebinding > default). */
export function resolveKbAction(cfg: RebindingConfig, code: string): InputAction | null {
  return cfg.keyboard[code] ?? null;
}
