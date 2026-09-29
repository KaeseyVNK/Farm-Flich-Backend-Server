// PM2 ecosystem — Masked Farm production (phase 10).
// web = Next.js standalone (cluster), raid = raid-server bun (single — WS sticky N/A MVP).
// Start: `pm2 start ecosystem.config.cjs`
// Env secret: load từ .env.production (KHÔNG commit) qua env_file hoặc inline.
//
// ponytail: raid-server scale-out (Redis adapter multi-process) = roadmap khi >100 concurrent.

const fs = require("fs");
const path = require("path");

// Load env từ .env.production nếu có (KHÔNG fail khi thiếu — CI build).
const envPath = path.join(__dirname, ".env.production");
const prodEnv = fs.existsSync(envPath)
  ? Object.fromEntries(
      fs.readFileSync(envPath, "utf8")
        .split("\n")
        .filter((l) => l && !l.startsWith("#") && l.includes("="))
        .map((l) => {
          const [k, ...v] = l.split("=");
          return [k.trim(), v.join("=").trim()];
        }),
    )
  : {};

module.exports = {
  apps: [
    {
      name: "mf-web",
      script: ".next/standalone/server.js",
      instances: "max",
      exec_mode: "cluster",
      env: prodEnv,
      max_memory_restart: "512M",
      error_file: "./logs/mf-web.err.log",
      out_file: "./logs/mf-web.out.log",
      time: true,
    },
    {
      name: "mf-raid",
      script: "mini-services/raid-server/dist/index.js",
      exec_mode: "fork", // single process — WS state in-memory
      instances: 1,
      env: prodEnv,
      max_memory_restart: "512M",
      error_file: "./logs/mf-raid.err.log",
      out_file: "./logs/mf-raid.out.log",
      time: true,
    },
  ],
};
