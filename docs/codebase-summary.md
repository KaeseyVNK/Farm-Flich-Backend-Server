# Codebase Summary — Masked Farm

> Next.js 16 + React 19 + Tailwind 4 (inherit Harvest Hollow Canvas farm engine) · Supabase (Auth+Postgres+Realtime+SSR) · Prisma 6 postgres (pooler `:6543` + DIRECT `:5432`) · raid-server (bun + ws, server authority).

## Repo structure
```
hgpp/
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── actions/               # Server Actions (replay authz)
│   │   ├── api/                   # REST routes
│   │   ├── auth/, login/          # Auth pages
│   │   ├── play/                  # Farm + raid view
│   │   ├── replay/[sessionId]/    # Replay timeline (owner-only)
│   │   ├── layout.tsx             # Font load (VT323/Bungee/PS2P)
│   │   └── globals.css            # Design tokens (:root 14 var)
│   ├── lib/
│   │   ├── game/                  # Farm engine + visual: constants/save/sync/wallet/farm-service/overlay-policy/feature-registry/raid-cap/economy/bridge/music/sfx
│   │   ├── raid/                  # Raid client (ws-client/eligibility/farm-status/interpolation/loss-cap/types)
│   │   ├── supabase/              # Supabase clients (browser/server/admin)
│   │   ├── db.ts                  # Prisma client
│   │   └── utils.ts
│   ├── store/                     # Zustand (farm/game/inventory/npc/quest/raid/ui)
│   ├── components/                # React UI (layout/raid/replay/farm/game-ui/primitives + phaser renderers)
│   │   └── game-ui/               # Pixel primitives: pixel-frame/pixel-button/game-icon/item-icon/game-icon-id
├── mini-services/raid-server/
│   ├── src/
│   │   ├── index.ts               # Bun.serve WS + tickAll 10Hz
│   │   ├── auth.ts                # cookie → getUser verify (no jwt trust)
│   │   ├── room.ts                # RaidRoom state + snapshot 5Hz
│   │   ├── join.ts                # atomic RaidSession active (RETURNING gate)
│   │   ├── dog.ts                 # GuardDog auto-patrol BFS + LOS
│   │   ├── puzzle.ts              # memory seq server secret
│   │   ├── alert.ts               # FSM 3 cấp
│   │   ├── finalize.ts            # transaction loot+shield+cap+mask
│   │   ├── lockdown.ts            # owner presence → gate close
│   │   ├── replay.ts              # ring-buffer events (tick, seq)
│   │   ├── protocol.ts            # discriminated union (no jwt payload)
│   │   ├── shield.ts · loss-cap.ts · defense-xp.ts
│   │   ├── supabase.ts · rng.ts · constants.ts · types.ts
│   └── tests/
├── prisma/
│   ├── schema.prisma              # User/Farm/Inventory/Mask/DefenseConfig/RaidSession/RaidEvent/RaidLossDaily
│   └── migrations/
├── tests/
│   ├── unit/ · integration/
│   └── setup.ts · helpers.ts
├── e2e/                           # Playwright: functional + visual redesign suites
│   ├── visual-baseline.spec.ts    # visual snapshots (deterministic, owner-state)
│   ├── touch-controls.spec.ts     # farm D-pad + 44px touch targets
│   ├── accessibility-navigation.spec.ts
│   ├── renderer-resilience.spec.ts # Phaser remount + ?sprite=off fallback smoke
│   ├── performance.spec.ts        # leak + latency health evidence
│   └── ... (farm-day/raid-join/replay/social/village/overlay-policy/focus-trap/…) + helpers
├── docs/                          # Thư mục này + wireframes/
├── docker-compose.yml             # postgres :5433 local-dev
├── package.json                   # vitest + concurrently (dev:all)
└── .env.local.example
```

## Stack chi tiết
| Lớp | Công nghệ |
|---|---|
| Web | Next.js 16 App Router + React 19 + Tailwind 4 |
| Game client | Canvas 2D + Zustand store |
| Auth/DB/Realtime | Supabase (`@supabase/ssr` + `@supabase/supabase-js`) |
| ORM | Prisma 6 postgres (`DATABASE_URL` pooler `:6543`, `DIRECT_URL` `:5432`) |
| Raid server | Bun + ws (single-process multi-room) |
| Test | vitest (root) + bun test (raid-server) |

## Dev commands
| Lệnh | Tác dụng |
|---|---|
| `npm run dev:all` | Next :3000 + raid-server :3001 (concurrently) |
| `npm run dev:raid` | Chỉ raid-server (bun) |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:generate` | `prisma generate` |
| `npm test` | vitest root |
| `npm run test:integration` | vitest `tests/integration/` |
| `cd mini-services/raid-server && bun test` | raid-server unit |
| `docker compose up -d postgres` | local postgres :5433 |

Xem `./system-architecture.md` (data flow), `./deployment-guide.md` (env keys).
