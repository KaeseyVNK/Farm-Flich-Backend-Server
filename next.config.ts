import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  distDir: process.env.MASKED_FARM_NEXT_DIST_DIR ?? ".next",
  env: {
    NEXT_PUBLIC_E2E: process.env.NEXT_PUBLIC_E2E,
  },
  turbopack: {
    root: process.cwd(),
  },
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default withNextIntl(nextConfig);
