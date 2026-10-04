"use client";

/**
 * PrivyProvider + bridge — nạp động (ssr:false). Config Solana ghim probe
 * 3.46.0: embedded Solana wallet tạo on-login; ví ngoài (Phantom/…) qua
 * Wallet-Standard; `config.solana.rpcs` là OPTIONAL — bỏ (probe exit 0).
 */

import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import type { ReactNode } from "react";
import PrivyWalletBridge from "./privy-bridge";

export default function PrivyMount({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? ""}
      config={{
        appearance: { theme: "light" },
        // Email + Google + ví ngoài (quyết định #3 spec)
        loginMethods: ["email", "google", "wallet"],
        embeddedWallets: {
          ethereum: { createOnLogin: "off" },
          solana: { createOnLogin: "users-without-wallets" },
        },
        externalWallets: { solana: { connectors: toSolanaWalletConnectors() } },
      }}
    >
      <PrivyWalletBridge />
      {children}
    </PrivyProvider>
  );
}
