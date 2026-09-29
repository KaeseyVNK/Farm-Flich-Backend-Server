import { defineConfig } from "@playwright/test";
import { config as loadDotenv } from "dotenv";

// Load .env cho Playwright (social/village spec cần Supabase env).
// KHÔNG override env đã set trong shell (process.env ưu tiên hơn).
loadDotenv({ path: ".env", override: false });

/**
 * E2E full game (phase 8) — farm gameplay 1 ngày, panels, raid lobby UI,
 * village (presence+chat), market/masks/friends smoke.
 *
 * webServer array tự start raid-server (:3001) + next dev (:3000) khi chạy.
 * Set E2E_SKIP_WEBSERVER=1 để tắt khi đã chạy `dev:all` thủ công (local).
 *
 * Run: npm run test:e2e  (tự set NEXT_PUBLIC_E2E=1)
 */
const skipWebServer = process.env.E2E_SKIP_WEBSERVER === "1";

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  retries: 0,
  workers: 1, // game canvas + shared Supabase anon rate-limit → serial là an toàn nhất
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    viewport: { width: 1280, height: 800 },
  },
  projects: [{ name: "chromium", use: { channel: "chrome" } }],
  ...(skipWebServer
    ? {}
    : {
        webServer: [
          {
            command: "bun run --env-file=../../.env src/index.ts",
            cwd: "mini-services/raid-server",
            url: "http://localhost:3001/healthz",
            reuseExistingServer: true,
            timeout: 60_000,
          },
          {
            command: "NEXT_PUBLIC_E2E=1 next dev -p 3000",
            url: "http://localhost:3000",
            reuseExistingServer: true,
            timeout: 120_000,
          },
        ],
      }),
});
