# Masked Farm

Multiplayer pixel farm game — farm kinh tế + raid/stealth. Core tension: **rời farm để phát triển, hay ở lại để bảo vệ**.

## Stack
- **Next.js 16** + React 19 + Tailwind 4 + Canvas engine (inherit Harvest Hollow farming)
- **Supabase**: Auth + Postgres + Realtime + `@supabase/ssr`
- **Prisma 6** postgres (pooler :6543 + DIRECT_URL :5432)
- **raid-server**: bun + ws, server authority (raid tick 10Hz, snapshot 5Hz)
- Hybrid WS (raid tick) + Realtime (presence/lobby/replay-meta). Edge Functions BANNED.

## Quickstart (local-dev)
```bash
# 1. DB (docker postgres port 5433)
docker compose up -d postgres

# 2. Env
cp .env.example .env.local   # điền Supabase keys

# 3. Migrate
DIRECT_URL="postgresql://postgres:test@localhost:5433/hgpp" \
DATABASE_URL="postgresql://postgres:test@localhost:5433/hgpp" \
npx prisma migrate deploy && npx prisma generate

# 4. Run (web :3000 + raid-server :3001)
npm run dev:all
```

## Test
```bash
npm test                    # root vitest (unit + integration)
cd mini-services/raid-server && bun test   # raid-server
cd mini-services/raid-server && bun run tests/benchmark-bfs.ts   # BFS perf (<1ms/call)
```

## Cấu trúc
```
src/
  app/            Next App Router (pages, actions: wallet/farm/replay)
  lib/game/       wallet-service, farm-service, raid-cap, sync (server-authoritative)
  lib/raid/       eligibility, loss-cap, interpolation, ws-client, types
  store/          zustand (raidStore, gameStore, ...)
  components/     raid/ (RaidView, Lobby, Canvas, LockdownBanner, ReplayTimeline) + layout/ + game/
mini-services/raid-server/   bun + ws (room, dog, puzzle, alert, finalize, lockdown, replay)
prisma/           schema.prisma + migrations (init + raid RPC functions)
tests/            unit/ + integration/ (vitest)
docs/             7 doc files (overview, architecture, standards, deploy, design, roadmap, summary)
```

## Server authority
- **Inventory (raid loot)**: server-side, atomic (`UPDATE...WHERE qty+delta>=0 RETURNING`, RPC `deduct_inventory`, `steal_with_loss_cap`).
- **Gold**: LOCAL-FIRST (zustand) cho gameplay earnings; cloud `User.gold` chỉ là sink cho bounty/craft qua RPC security-definer. Code-review H4: docs cũ claim "gold server-side" — sai.
- **Farm JSONB**: phi-gold (terrain/crops/objects/forage/shippingBoxes + gameMeta PHI-GOLD).
- **Raid finalize**: 1 RPC transaction (`finalize_raid`: shield + daily-cap + mask durability + defense XP + reputation + RaidSession resolved; server-role only).
- WS auth = cookie-only (no payload jwt). Replay = owner-only authz.

## Roadmap
MVP done (P1-P6). Future: village, 3 maps, marketplace, friends, multi-mask, trap, iron/safe chests, owner-steering lockdown auto-detect, full re-sim replay, production deploy. See `docs/project-roadmap.md`.
