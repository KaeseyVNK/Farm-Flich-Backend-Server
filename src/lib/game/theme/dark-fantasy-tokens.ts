// Dark Fantasy palette tokens (phase 5). Muted gothic + blood-moon accents.
// WCAG AA contrast: text/surface ≥ 4.5:1. Contrast computed via relative luminance.
//
// @deprecated Phase 1 reconciliation (masked-farm visual redesign): this exploration
// palette has 0 production importers and is NOT the canonical contract. The single source
// of truth for colour is the --mf-* CSS tokens in src/app/globals.css (see
// docs/masked-farm-visual-direction.md + masked-farm-tokens.test.ts). The DARK_FANTASY
// object is retained only so existing WCAG assertions stay meaningful; do not adopt it in
// new code — theme-deprecation.test.ts guards against that. The WCAG helpers below
// (relativeLuminance / contrastRatio / meetsAA) remain a reusable utility.
export const DARK_FANTASY = {
  // Surfaces (muted gothic — đá, gỗ cũ, nến)
  bg: "#1a1410",
  panelBg: "#2a2018",
  panelBgRaised: "#3a2d20",
  panelBorder: "#5a4530",
  // Text
  textPrimary: "#f0e6d2", // warm parchment
  textSecondary: "#b8a888",
  textMuted: "#7a6e58",
  // Accents
  accentGold: "#c9a44a",
  accentBlood: "#a83232",
  accentBlight: "#6b8e4a", // sickly green
  // States
  danger: "#c0452f",
  success: "#4e7d3a",
  warning: "#d99a2a",
  // Blood-moon sky
  bloodMoonSky: "#4a1818",
  bloodMoonGlow: "#d94848",
} as const;

/** Relative luminance (WCAG). hex string → 0..1. */
export function relativeLuminance(hex: string): number {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Contrast ratio (WCAG). ≥ 4.5 = AA text; ≥ 7 = AAA. */
export function contrastRatio(hexA: string, hexB: string): number {
  const la = relativeLuminance(hexA);
  const lb = relativeLuminance(hexB);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** Check text/surface đạt AA (≥ 4.5). */
export function meetsAA(textHex: string, surfaceHex: string): boolean {
  return contrastRatio(textHex, surfaceHex) >= 4.5;
}
