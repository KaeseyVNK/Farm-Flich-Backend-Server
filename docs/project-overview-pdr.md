# Project Overview & PDR — Masked Farm

> Game nông trại pixel multiplayer: farm (ngày) + raid/trộm (đêm). Server-authoritative. Inherit Harvest Hollow Canvas farm engine.

## Core tension
**Rời farm để phát triển, hay ở lại để bảo vệ.** Người chơi đóng 2 vai: chủ farm (trồng/thu hoạch/bán) + kẻ trộm (lén farm người khác lấy cắp).

## Concept
- Pixel top-down, map 30×22 tile (960×704), Canvas engine.
- Cozy farm ban ngày ↔ mysterious heist ban đêm (night overlay indigo `--night`).
- Solo raid realtime: 1 raider / farm / vụ (multi-raider = roadmap).
- Mask = ticket vào raid (concept §6). Hỏng theo lượt dùng (durability).
- Dog AI auto-patrol (owner-set waypoint = roadmap).
- Shield chống trộm liên tục. Daily raid-cap 3 vụ/farm/ngày (concept §13).
- Replay timeline (no re-sim) — owner xem lại vụ trộm.

## MVP scope (YAGNI/KISS)
**Kế thừa Harvest Hollow:** farm 30×22, trồng/tưới/thu hoạch, shop, calendar, NPC, save 3 slot.
**Thêm mới:**
- Auth: anon → upgrade email
- Postgres (Supabase) + Prisma 6
- raid-server (bun + ws) server authority
- Raid core: 1 map, dog AI auto-patrol, alert 3 cấp, 1 rương gỗ, 1 puzzle memory, mask, shield, daily raid-cap 3, replay timeline
- Design tokens (5 raid color + VT323/Bungee/PS2P font)

**Cắt → roadmap (future, post-FULL):** owner-set dog waypoint, multi-raider gang (1 vs N), replay trap re-sim, reconnect grace 5s, RLS full, `@hgpp/game-core` shared package.

## Functional requirements (PDR)
| ID | Yêu cầu |
|---|---|
| FR-1 | User đăng nhập anon, upgrade email giữ tiến trình |
| FR-2 | Save farm cloud (JSONB terrain/crops/objects/forage/shippingBoxes/gameMeta) |
| FR-3 | Gold + Inventory server-authoritative (RPC atomic, rowcount check) |
| FR-4 | Raid: thief join farm mục tiêu (owner away/offline, no shield, daily-cap ok, mask durability > 0) |
| FR-5 | Raid tick 10Hz, snapshot 5Hz (WS, velocity dx/dy mỗi entity) |
| FR-6 | Dog auto-patrol → LOS/chase → bite 3 = caught |
| FR-7 | Puzzle memory (seq 3, server secret, rate-limit) |
| FR-8 | Alert FSM 3 cấp (Stealth / Caution / Alarm) |
| FR-9 | Finalize atomic: loss-cap (10%/raid, 25%/day) + shield + mask durability + daily raid-count + Defense XP (anti-self-farm) |
| FR-10 | Lockdown: owner về giữa raid → gate close 5s + dog buff +50% |
| FR-11 | Replay timeline owner-only (Server Action authz `session.user.id === ownerId`) |
| FR-12 | Daily raid-cap 3 vụ/farm/ngày, reset 24h |

## Non-functional
| | |
|---|---|
| Performance | BFS cache ≤2Hz/dog, jitter <16ms @50 rooms × 2 dogs |
| Reliability | alt-F4 >5s aborted, reconnect session cũ (dog không reset), grace 30s |
| Security | WS cookie-only auth (`getUser()` verify, no jwt trust), app-layer authz, trap hidden snapshot |
| LCP | Font `display:swap` + preload |

## Roadmap (rút gọn)
- P1 Foundation Supabase+Auth — DONE
- P2 Data layer Prisma — DONE
- P3 Design tokens+fonts — DONE
- P4 raid-server engine — DONE
- P5 Raid client+UI — DONE
- P6 Raid finalize+shield+lockdown+replay — DONE
- P7 Test+review+docs+deploy — DONE
- FULL roadmap 10 phases — ALL DONE (commit `f916fc6`): trap, iron/safe chests+puzzle, defense XP, multi-mask+spoof fix, friends+gift, marketplace, 3 biome maps, village hub, lockdown auto+re-sim replay, production deploy
- Future: owner-set waypoint, multi-raider gang, replay trap re-sim, reconnect grace, RLS, shared game-core package

Xem `./project-roadmap.md`, `./system-architecture.md`.

## Open questions
- Anon expiry policy: tắt Supabase auto-delete anon OR period > MVP (TBD).
- Replay jsonb archive window 30d (TBD).
- Mask economy balance (defer `economy.ts` review).
