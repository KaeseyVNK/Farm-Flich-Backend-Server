"use client";
// Client-side locale switch — set cookie "hh-locale" + reload. Without-i18n-routing (no URL prefix).
import { useRouter } from "next/navigation";
import type { Locale } from "./locale-shared";

export function useLocaleSwitch() {
  const router = useRouter();
  return (locale: Locale) => {
    document.cookie = `hh-locale=${locale};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
    router.refresh();
  };
}
