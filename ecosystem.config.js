/**
 * PM2 process config (phase 10 F10.5/F10.6).
 * - mf-web: Next.js standalone cluster (max CPU).
 * - mf-raid: raid-server bun single process (WS in-memory — sticky single).
 * Env từ .env.production (KHÔNG commit). KHÔNG set PATH hardcode — cwd-relative.
 */
module.exports = {
  apps: [
    {
      name: "mf-web",
      script: "./.next/standalone/server.js",
      cwd: __dirname,
      instances: "max",
      exec_mode: "cluster",
      env: { NODE_ENV: "production", PORT: 3000 },
      // dotenv load .env.production qua env_file
      env_file: ".env.production",
      max_memory_restart: "512M",
      out_file: "./logs/mf-web-out.log",
      error_file: "./logs/mf-web-error.log",
      merge_logs: true,
      time: true,
    },
    {
      name: "mf-raid",
      script: "./mini-services/raid-server/dist/index.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      interpreter: "bun",
      env: { NODE_ENV: "production", RAID_PORT: 3001, PORT: 3001 },
      env_file: ".env.production",
      max_memory_restart: "256M",
      out_file: "./logs/mf-raid-out.log",
      error_file: "./logs/mf-raid-error.log",
      merge_logs: true,
      time: true,
    },
  ],
};
