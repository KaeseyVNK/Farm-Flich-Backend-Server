// next-intl request config (without-i18n-routing: locale via cookie, URL không prefix).
// VN default + EN. ADR-013: locale prefix routing defer phase 8 (tránh đứt e2e phase 1).
import { getRequestConfig } from "next-intl/server";
import { headers } from "next/headers";
import en from "./messages/en.json";
import vi from "./messages/vi.json";

export const locales = ["vi", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "vi";

function loadMessages(locale: string) {
  return locale === "en" ? en : vi;
}

export default getRequestConfig(async () => {
  // Ưu tiên cookie "hh-locale", fallback Accept-Language header, fallback default vi.
  let locale: string = defaultLocale;
  try {
    const h = await headers();
    const cookie = h.get("cookie") ?? "";
    const match = cookie.match(/hh-locale=(vi|en)/);
    if (match) {
      locale = match[1];
    } else {
      const al = h.get("accept-language") ?? "";
      if (al.toLowerCase().startsWith("en")) locale = "en";
    }
  } catch {
    // headers() ngoài request scope — dùng default.
  }
  if (!locales.includes(locale as Locale)) locale = defaultLocale;
  return {
    locale,
    messages: loadMessages(locale),
  };
});
