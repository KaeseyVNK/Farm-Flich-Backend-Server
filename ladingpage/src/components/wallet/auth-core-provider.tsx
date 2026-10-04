"use client";

/**
 * AuthCoreContextProvider của @particle-network/authkit — bọc trong file riêng
 * và nạp động (ssr:false) để:
 *  1. SDK (kèm antd) chỉ tải khi thật sự render — không đè bundle các trang
 *     marketing;
 *  2. không bao giờ chạy SSR (SDK dành cho browser).
 */

import { AuthCoreContextProvider } from "@particle-network/authkit";
import { bsc } from "@particle-network/authkit/chains";
import type { ReactNode } from "react";
import { PARTICLE_APP_ID, PARTICLE_CLIENT_KEY, PARTICLE_PROJECT_ID } from "./particles-config";

export default function AuthCoreProvider({ children }: { children: ReactNode }) {
  return (
    <AuthCoreContextProvider
      options={{
        projectId: PARTICLE_PROJECT_ID,
        clientKey: PARTICLE_CLIENT_KEY,
        appId: PARTICLE_APP_ID,
        // Game chạy trên BNB Smart Chain (USDT/BSC — xem /deposit/info).
        chains: [bsc],
        themeType: "light",
        language: "en",
        // Chỉ cần connect + lấy địa chỉ: tắt entry plugin ví của SDK.
        wallet: false,
      }}
    >
      {children}
    </AuthCoreContextProvider>
  );
}
