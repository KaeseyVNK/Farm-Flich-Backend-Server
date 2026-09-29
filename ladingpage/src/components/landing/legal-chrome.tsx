import Link from "next/link";
import type { ReactNode } from "react";

export function LegalChrome({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-cream text-foreground">
      <header className="border-b-[3px] border-[#3e2f23] bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/" className="font-display text-xl font-extrabold">
            Farm &amp; Filch
          </Link>
          <Link href="/" className="text-sm font-extrabold text-grass-dark underline-offset-2 hover:underline">
            Về trang chủ
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-display text-4xl font-extrabold">{title}</h1>
        <div className="mt-8 flex flex-col gap-4 text-base font-semibold leading-relaxed text-foreground/80">
          {children}
        </div>
      </main>
    </div>
  );
}
