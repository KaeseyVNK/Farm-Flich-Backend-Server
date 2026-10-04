import { defineConfig } from "vitest/config";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(import.meta.dirname, ".env.local"), quiet: true });
for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
  const url = new URL(process.env[key] || "http://invalid");
  if (!/^postgres(?:ql)?:$/.test(url.protocol) || !["localhost", "127.0.0.1"].includes(url.hostname) || url.port !== "54322") {
    throw new Error("Wallet integration tests require the local port 54322 database.");
  }
}
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: { environment: "node", include: ["tests/unity-wallet-*.test.ts", "tests/unit/unity-cash-purchase.test.ts"], testTimeout: 30000 },
});
