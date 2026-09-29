import { defineConfig } from "vitest/config";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(import.meta.dirname, ".env.local") });
if (!/^postgresql:\/\/[^/]+@(?:127\.0\.0\.1|localhost):54322\//.test(process.env.DIRECT_URL ?? "")) {
  throw new Error("Character integration test requires the local port 54322 database.");
}

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: { environment: "node", include: ["tests/character-bridge.test.ts"] },
});
