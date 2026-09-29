// Shared locale types/constants (importable từ server + client).
import { headers } from "next/headers";

export const locales = ["vi", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "vi";

/**
 * Resolve locale từ cookie/header cho server components (layout.tsx html lang).
 * Audit UI C2: html lang hardcode "vi" → dynamic. Fallback Accept-Language.
 */
export async function serverLocale(): Promise<Locale> {
  try {
    const h = await headers();
    const cookie = h.get("cookie") ?? "";
    const match = cookie.match(/hh-locale=(vi|en)/);
    if (match) return match[1] as Locale;
    const al = (h.get("accept-language") ?? "").toLowerCase();
    if (al.startsWith("en")) return "en";
  } catch {
    // ngoài request scope (build static) → default.
  }
  return defaultLocale;
}
