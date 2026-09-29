import type { Metadata } from "next";
import { Baloo_2, Nunito } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const baloo2 = Baloo_2({ variable: "--font-baloo", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });
const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"], weight: ["400", "500", "600", "700", "800", "900"] });
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://farmfilch.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Farm & Filch — Grow. Guard. Filch.",
  description: "Farm & Filch is a free-to-play browser pixel farm RPG. Grow your farm, protect your harvest, and filch from the neighbors.",
  keywords: ["Farm & Filch", "farming RPG", "browser game", "pixel art game", "farm game"],
  authors: [{ name: "Farm & Filch" }],
  icons: { icon: "/favicon.svg" },
  openGraph: { title: "Farm & Filch — Grow. Guard. Filch.", description: "Build your farm, guard your harvest, and filch from your neighbors.", type: "website", url: "/", siteName: "Farm & Filch", images: [{ url: "/images/farm-filch-hero.png", width: 1672, height: 941, alt: "Farm & Filch pixel farm" }] },
  twitter: { card: "summary_large_image", title: "Farm & Filch — Grow. Guard. Filch.", description: "Build your farm, guard your harvest, and filch from your neighbors.", images: ["/images/farm-filch-hero.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body className={`${baloo2.variable} ${nunito.variable} antialiased bg-background text-foreground`}>{children}<Toaster /></body></html>;
}
