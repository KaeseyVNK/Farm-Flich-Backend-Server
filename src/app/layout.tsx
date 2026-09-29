import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Press_Start_2P, VT323, Bungee } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { initSentry } from "@/lib/telemetry/sentry";
import { serverLocale } from "@/i18n/locale-shared";

initSentry(); // no-op khi chưa có NEXT_PUBLIC_SENTRY_DSN

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Cozy pixel font for HUD labels & panel headings (loaded once, applied via .font-pixel)
const pixel = Press_Start_2P({
  variable: "--font-pixel",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

// Masked Farm fonts (verified 100% Vietnamese glyph coverage — red-team #14):
// VT323 = body/UI (pixel terminal), Bungee = display/title/CTA.
// PS2P giữ cho số/icon-key KHÔNG dấu (thiếu 15/16 diacritics → cấm cho text Việt).
const vt323 = VT323({
  variable: "--font-vt323",
  weight: "400",
  subsets: ["latin", "vietnamese"],
  display: "swap",
});
const bungee = Bungee({
  variable: "--font-bungee",
  weight: "400",
  subsets: ["latin", "vietnamese"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Masked Farm — Farm by Day, Raid by Night",
  description:
    "Masked Farm — a cozy top-down farming sim by day and a tense multiplayer heist by night. Till, plant, water, harvest and befriend the townsfolk, then don a mask and raid under cover of dark.",
  keywords: ["farming sim", "cozy game", "heist game", "Masked Farm", "Next.js", "Canvas", "Zustand"],
  authors: [{ name: "Masked Farm" }],
  icons: {
    icon: "/logo.svg",
    apple: "/logo.svg",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Masked Farm",
  },
  openGraph: {
    title: "Masked Farm",
    description: "A cozy farming sim by day, a tense heist by night.",
    type: "website",
  },
};

// Audit UI C1: viewport export — Next 16 yêu cầu riêng cho <meta viewport>.
// viewportFit=cover để safe-area.ts parse env(safe-area-inset-*) đúng.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#17181a",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const messages = await getMessages();
  const locale = await serverLocale();
  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${pixel.variable} ${vt323.variable} ${bungee.variable} antialiased bg-background text-foreground`}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
          <Toaster />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
