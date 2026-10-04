import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // This is a separate app; do not discover the parent backend's proxy or aliases.
  turbopack: { root: __dirname },
  outputFileTracingRoot: __dirname,
  webpack(config) {
    // Particle imports the AWS aggregate entry; use its official browser entry.
    config.resolve.alias["@aws-sdk/credential-providers$"] = require.resolve("@aws-sdk/credential-providers/dist-es/index.browser.js");
    return config;
  },
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
