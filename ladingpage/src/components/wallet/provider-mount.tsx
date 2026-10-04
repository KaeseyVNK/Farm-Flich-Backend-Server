"use client";

/**
 * Mount provider ví theo provider đang chọn (spec 2026-10-01 mục 4.1):
 *   privy     → PrivyMount (dynamic ssr:false)
 *   particles → ParticlesMount (dynamic ssr:false)
 *   web3auth  → không cần mount (singleton trong adapter)
 * Route-gated: chỉ trang dùng ví (/login, /buy-cash) — trang marketing
 * không tải SDK (Review Focus #3: THIẾU /buy-cash = modal nạp tiền chết).
 * Chưa cấu hình → render children thuần (degrade).
 */

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { isWalletConfigured, resolveWalletProviderId } from "./adapter";

const PrivyMount = dynamic(() => import("./privy-mount"), { ssr: false });
const ParticlesMount = dynamic(() => import("./particles-mount"), { ssr: false });

/** Các route cần SDK ví (modal login + modal nạp tiền). */
const WALLET_ROUTES = ["/login", "/buy-cash"] as const;

export function WalletProviderMount({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const enabled =
    isWalletConfigured() &&
    WALLET_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  if (!enabled) return <>{children}</>;

  const id = resolveWalletProviderId();
  if (id === "privy") return <PrivyMount>{children}</PrivyMount>;
  if (id === "particles") return <ParticlesMount>{children}</ParticlesMount>;
  // web3auth (hoặc null phòng hờ) — singleton tự nạp trong adapter
  return <>{children}</>;
}
