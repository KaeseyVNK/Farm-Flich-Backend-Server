"use client";

/**
 * AuthCoreContextProvider (SDK Particles, file đã dời từ auth/) + bridge —
 * nạp động (ssr:false) như PrivyMount.
 */

import type { ReactNode } from "react";
import AuthCoreProvider from "./auth-core-provider";
import ParticlesWalletBridge from "./particles-bridge";

export default function ParticlesMount({ children }: { children: ReactNode }) {
  return (
    <AuthCoreProvider>
      <ParticlesWalletBridge />
      {children}
    </AuthCoreProvider>
  );
}
