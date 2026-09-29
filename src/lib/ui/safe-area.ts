// Safe area insets (phase 8 — ADR-009). Notch + rounded corners che UI.
// CSS env(safe-area-inset-*) read qua getComputedStyle. Pure resolver cho test.
export interface SafeAreaInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** Parse env(safe-area-inset-*) từ CSS computed style. Fallback 0 khi không support. */
export function parseSafeArea(getProperty: (name: string) => string): SafeAreaInsets {
  const parse = (v: string): number => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : 0;
  };
  return {
    top: parse(getProperty("safe-area-inset-top") || getProperty("--sat") || "0"),
    bottom: parse(getProperty("safe-area-inset-bottom") || getProperty("--sab") || "0"),
    left: parse(getProperty("safe-area-inset-left") || getProperty("--sal") || "0"),
    right: parse(getProperty("safe-area-inset-right") || getProperty("--sar") || "0"),
  };
}

/** Convert insets → CSS padding string. */
export function safeAreaPadding(insets: SafeAreaInsets): string {
  return `${insets.top}px ${insets.right}px ${insets.bottom}px ${insets.left}px`;
}

/** Touch hit-target check: ≥44px (Apple HIG). */
export function meetsHitTarget(size: number): boolean {
  return size >= 44;
}
