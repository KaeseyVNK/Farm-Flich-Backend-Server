# Deployment Guide — Masked Farm

> MVP = **local-dev only**. Production (Supabase managed + raid-server bare metal/Caddy/PM2) = roadmap.

## Prerequisite
- Node 20+ · bun ≥1.3 · Docker
- Supabase project provisioned (Project Settings → API + Database)

## Local-dev setup

### 1. Postgres (docker)
```bash
docker compose up -d postgres
# → host :5433 → container :5432 (tránh đụng postgres local)
# DB: hgpp · user: postgres · pass: test
```

### 2. Env keys
Copy `.env.local.example` → `.env.local`, điền:
| Key | Giá trị |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://YOUR-PROJECT.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | anon key (dashboard → API) |
| `SUPABASE_SERVICE_ROLE_KEY` | service role (server-only, KHÔNG expose client) |
| `DATABASE_URL` | pooler `:6543?pgbouncer=true&connection_limit=1` |
| `DIRECT_URL` | direct `:5432` (cho migrate) |
| `NEXT_PUBLIC_RAID_WS_URL` | `ws://localhost:3001/raid` |

### 3. DB migrate
```bash
npm run db:generate
npm run db:migrate
```
Note: partial unique index `WHERE status='active'` (audit M1) — migration SQL thủ công, Prisma không sinh.

### 4. Run all
```bash
npm run dev:all
# concurrently: Next :3000 + raid-server :3001
```
raid-server đọc env qua `--env-file=../../.env.local` (audit M7). Service role key + `DATABASE_URL` server-only.

### 5. Test
```bash
npm test                                    # vitest root
cd mini-services/raid-server && bun test
npm run test:integration                    # 2-client raid flow (local postgres docker)
```

## Ports
| Service | Port |
|---|---|
| Next.js | 3000 |
| raid-server WS | 3001 |
| Postgres (local docker) | 5433 |
| Supabase Postgres (prod) | 6543 (pooler) / 5432 (direct) |

## Production (roadmap)
- Supabase managed (Auth + Postgres + Realtime) — không self-host.
- raid-server bare metal/bun + PM2 (single-process SPOF, restart on crash).
- Caddy TLS + reverse proxy (`wss://` → raid-server `:3001`).
- Cookie domain + `Secure` flag cho wss.
- Health-check `/healthz` raid-server.
- RLS policy đầy đủ (MVP app-layer authz).
- BFS benchmark pass @50 rooms × 2 dogs, jitter <16ms.

## Production deploy (phase 10)

### Stack
- **Caddy** TLS reverse proxy (auto Let's Encrypt) → Next.js :3000 + raid-server :3001.
- **Next.js** `output: "standalone"` (next.config.ts đã set), PM2 cluster.
- **raid-server** bun single-binary (`bun build --target=bun`), PM2 fork (single — WS in-memory).
- **Supabase** project riêng (prod ≠ dev).

### Prerequisite
1. Domain `maskedfarm.app` + `ws.maskedfarm.app` (A record → server IP).
2. Supabase prod project provisioned.
3. Server: bun ≥1.3, Caddy, PM2 (`npm i -g pm2`).

### Build artifacts
```bash
# Next.js standalone
npm run build
# → .next/standalone/ (server.js + .next/static + public)

# raid-server single-binary
cd mini-services/raid-server && bun run build
# → dist/index.js (bun target)
```

### Env
Copy `.env.production.example` → `.env.production`, fill giá trị thật. **KHÔNG commit** (gitignore `.env*`).
```bash
DATABASE_URL=postgresql://...supabase.co:6543/postgres
DIRECT_URL=postgresql://...supabase.co:5432/postgres
NEXT_PUBLIC_RAID_WS_URL=wss://ws.maskedfarm.app
RAID_PORT=3001
```

### Deploy (bare-metal PM2 — recommend)
```bash
# 1. Migrate DB (1 lần / release)
npm run db:generate
DATABASE_URL=... DIRECT_URL=... npx prisma migrate deploy

# 2. Build (web + raid)
npm run build
cd mini-services/raid-server && bun run build && cd ../..

# 3. Start PM2 (doc env từ .env.production qua ecosystem.config.js)
pm2 start ecosystem.config.js
pm2 save
pm2 startup   # auto-restart on reboot

# 4. Caddy
caddy run --config Caddyfile    # auto TLS Let's Encrypt
```

> `ecosystem.config.js` (root) = mf-web cluster + mf-raid single fork (bun), đọc `.env.production` qua `env_file`. Log → `logs/`. Trước khi start: `mkdir -p logs`.

### Deploy (docker alternative)
```bash
docker compose -f docker-compose.prod.yml up -d
# web + raid + caddy services, mount .env.production
```

### Smoke test
```bash
./scripts/smoke-test.sh
# curl healthz web + raid, wscat WS handshake (expect 401 auth — verify upgrade OK)
```

### Load test (k6)
```bash
k6 run scripts/k6-load-test.js
# 100 concurrent WS join × 3 min → assert tick stable 10Hz, no 5xx, no memory leak
```

### Backup
- Supabase PITR auto (recommend).
- Hoặc `pg_dump` cron daily.

### Process manage
| Lệnh | Tác dụng |
|---|---|
| `pm2 status` | xem mf-web + mf-raid running |
| `pm2 logs mf-raid` | tail raid log |
| `pm2 restart mf-web` | restart web cluster |
| `pm2 reload mf-web` | zero-downtime reload |

### Cron — marketplace expire sweep (phase 6 F6.5)
Listing hết hạn (TTL 7d) cần đóng + refund. Endpoint `GET /api/cron/marketplace-expire` gọi RPC `expire_listing` (idempotent).
- **Vercel:** `vercel.json` → `crons: [{ "path": "/api/cron/marketplace-expire", "schedule": "0 * * * *" }]` (mỗi giờ).
- **Bare-metal:** cron `0 * * * * curl -fsS https://maskedfarm.app/api/cron/marketplace-expire`.
- Nếu expose public → bảo vệ bằng `CRON_SECRET` header (roadmap — single-user MVP hiện không cần).

### Production checklist
- [ ] `.env.production` KHÔNG commit (`git status` clean).
- [ ] TLS valid (Let's Encrypt auto-renew).
- [ ] PM2 startup hook (reboot auto-start).
- [ ] `curl https://maskedfarm.app/healthz` → 200.
- [ ] `wscat wss://ws.maskedfarm.app/raid` → handshake OK.
- [ ] k6 load test pass (tick 10Hz stable, no 5xx).
- [ ] Backup PITR / pg_dump verified.

## Troubleshooting
| Triệu chứng | Khắc phục |
|---|---|
| Cookie `Secure` không gửi qua `ws://localhost` | dev dùng cookie non-secure hoặc `wss://` local |
| Pooler exhaust @50 concurrent saveFarm | thêm `@prisma/adapter-pg` |
| Constants drift (raid-server) | runtime assert `MAP_COLS*MAP_ROWS===farm.terrain.length` khi load. Shared `@hgpp/game-core` = roadmap |
| raid-server env rỗng | verify `--env-file=../../.env.local` (audit M7) |

Xem `./codebase-summary.md` (dev commands), `./project-roadmap.md` (prod phase).

## Staging — naxz-public K3s (ns `hgpp-staging`)

Tự động 100% qua GitHub Actions (push `main` → workflow
`.github/workflows/deploy-hgpp-staging.yml`). Chi tiết cơ chế: NaxZ
`docs/agent-deploy-guide.md` (ARC runner tự apply, kaniko digest-pinned).

### Kiến trúc
- **Repo**: `tandt2402/hgpp` (private). Runner: scale set `arc-runners-hgpp`
  (helm release `arc-runner-set-hgpp`, ns arc-runners).
- **Images**: `ghcr.io/tandt2402/hgpp-web:<sha12>` + `hgpp-raid:<sha12>`
  (kaniko build từ git context, digest-pinned qua `kubectl set image`).
- **Trong ns**: `hgpp-web` (2 replica, initContainer `migrate` =
  `prisma migrate deploy` lên Supabase) + `hgpp-raid` (1 replica).
  KHÔNG có datastore in-ns — DB/auth = Supabase cloud.
- **URLs (public)**: `https://hgpp.1xdev.app` ·
  `wss://hgpp.1xdev.app/raid` (Cloudflare tunnel → Traefik IngressRoute
  `hgpp-public`). Raid WS/lockdown share the web host so the host-only
  Supabase cookie is sent. Tailnet mirror: `https://hgpp-web.taildbdafd.ts.net`
  · `wss://hgpp-raid.taildbdafd.ts.net/raid`.
- **Secrets**: `hgpp-env` (Supabase keys + raid URLs) + `regcred` (GHCR pull).
  Netpol: Cilium CNP `hgpp-web`/`hgpp-raid` trong `infra/k8s/staging/netpol.yml`.
- **NEXT_PUBLIC_\***: bake lúc build qua `build_args` của workflow — đổi
  Supabase project/raid URL = sửa workflow, KHÔNG phải secret.

### Manifests
`infra/k8s/staging/` (namespace, ci-deploy-rbac, hgpp-web, hgpp-raid,
ingress-tailscale, ingress-public, netpol). Image trong manifest = digest PLACEHOLDER —
workflow thay bằng digest thật (`kubectl set image`). KHÔNG `kubectl apply -f`
lại manifest khi đã rollout (digest reset = outage).

### Deploy thủ công / vận hành
```bash
gh workflow run deploy-hgpp-staging.yml --repo tandt2402/hgpp   # trigger tay
kubectl -n hgpp-staging get pods,ingress                        # kiểm tra
kubectl -n hgpp-staging logs deploy/hgpp-web -c migrate          # log migrate
```
Update vendored action `.github/actions/ci-build-deploy`: diff với naxz-infra,
owner review, copy (runbook NaxZ).

### Gotchas đã biết
- CI workflow cũ (`ci.yml`, ubuntu-latest) đang bị GitHub billing chặn
  ("spending limit") — không liên quan deploy (runner tự host).
- Local `docker-compose.prod.yml` build không truyền NEXT_PUBLIC_* build-args
  → client bundle rỗng các biến đó; staging luôn build qua workflow.
- Đổi scale set name/sai `runs-on:` = job queue forever (guide §2.1).

### Gotchas bổ sung (verified 2026-08-18 lần deploy đầu)
- **Supabase direct `db.*:5432` chỉ có AAAA (IPv6)** — cụm K8s IPv4-only →
  P1001. Secret `hgpp-env` PHẢI dùng pooler: `DATABASE_URL` =
  `aws-0-ap-southeast-1.pooler.supabase.com:6543?pgbouncer=true` (runtime),
  `DIRECT_URL` = pooler `:5432` session mode, username `postgres.<project-ref>`.
  Local `.env` vẫn dùng direct được (Mac có IPv6).
- **regcred**: nguồn `default/kaniko-docker` giữ key `config.json` + type
  Opaque — replicate nguyên si = kubelet bỏ qua (401 anonymous). Phải tạo bằng
  `kubectl create secret docker-registry regcred ...` (type dockerconfigjson,
  key `.dockerconfigjson`).
- **kaniko bỏ `COPY --from=<stage trung gian>`** (không phải builder) — prisma
  CLI cho migrate phải cài bằng `RUN` ngay trong runner stage.
- **bun chạy file cần prefix `./`** — `bun node_modules/...` bị resolve như
  package specifier (Module not found).
- **image 1 : N container**: action split `:` — nhập đôi dockerfiles/image_names
  (precedent SPVOS) khi cần set cả initContainer + container.
- Cold `next build` (Turbopack) ~30+ phút trên node shared — action poll đã bump
  25→45 phút.
