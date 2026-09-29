# System Architecture — Masked Farm

> Hybrid: WS (raid tick 10Hz, snapshot 5Hz) + Supabase Realtime (presence/lobby/replay-meta/owner-notify). Server authority tuyệt đối cho **Inventory raid-loot**; **gold = local-first** (review H4 2026-08-24).

## Trust boundary
```
Client (browser)  ──cookie sb-access-token──►  raid-server (bun :3001)
      │                                                │
      │ ws raid tick/snapshot                          │ getUser() verify (no jwt trust)
      │                                                │
      ▼                                                ▼
Supabase Realtime (presence/notify) ◄──────────  Postgres (Prisma service_role)
                                                      │
                                                      ▼
                                                 RPC finalize_raid (atomic tx)
```

## Server authority
| Dữ liệu | Nơi lưu | Authority |
|---|---|---|
| `User.gold` | Postgres | **Sink-only** (review H4): bounty/craft trừ qua RPC; earnings local-first, KHÔNG sync lên. Client check `fetchGold` trước sink + deduct local sau OK |
| `Inventory` (raid loot) | Postgres | **Server** (`steal_with_loss_cap` — pool FOR UPDATE nội bộ) |
| `Farm` JSONB (terrain/crops/objects/forage/shippingBoxes) | Postgres | Client (JSONB; placedDecor server-capped 200 + defId whitelist) |
| `Farm.gameMeta` (season/time/energy/player/quests) | Postgres JSONB | Client (phi-gold — audit C1). **day không còn dùng cho blood-moon** |
| Blood-moon trigger | UTC date hash (server clock) | **Server** — review H3b: gameMeta.day owner-controlled → exploit loot ×2 |
| `Mask.durability` · `Farm.shieldUntil` · `dailyRaidCount` | Postgres | **Server** |

Gold KHÔNG còn trong `gameMeta` (audit C1).

## Raid flow
1. **Join (atomic):** `UPDATE RaidSession SET status='active', thiefId=? WHERE farmId=? AND status='lobby' RETURNING id`. Rowcount 0 → reject. Check `shieldUntil` + `dailyRaidCount < cap` (helper phase 2) + thief `Mask.durability>0` + owner `farmStatus ∈ {away,offline}`. Rate-limit join/lobby (audit M10).
2. **Tick loop (10Hz):** movement+collision (SOLID_TILES), dog BFS cache + Bresenham LOS, alert FSM, puzzle deadline. Snapshot 5Hz publish `room:<farmId>` (Bun pub/sub). Snapshot **chứa velocity `dx,dy`** mỗi entity (audit C3), **KHÔNG chứa trap** (red-team #13). In-flight snapshot Postgres mỗi 5s.
3. **Finalize (raid-end):** RPC `finalize_raid` transaction:
   - per-raid cap 10%/category, daily cap 25% (ket excluded)
   - `RaidLossDaily` upsert atomic
   - deduct victim inventory `WHERE qty>=X RETURNING` (rowcount mismatch → abort)
   - add thief loot
   - set `Farm.shieldUntil` (30min online-away / 2h sau bị trộm / 24h new-player)
   - bump `dailyRaidCount` (+ reset 24h)
   - mask durability -1
   - Defense XP (anti-self-farm: raider ≥2 interact + bite xảy ra)
   - status → `resolved`
4. **Lockdown (phase 9):** raid-server subscribe `farm-status:<ownerId>` Realtime presence. Transition away/offline → playing giữa active raid → 2s debounce → `triggerRoomLockdown` (idempotent): `gateCloseTick = tickN + 200` (20s @ 10Hz, tick-based KHÔNG wall-clock) + alert bump 50. Owner POST `/lockdown` = manual trigger cùng path.
5. **Replay (phase 9):** `RaidEvent` ordered (`tick`, `seq`) → `replayEvents` headless re-sim qua new `RaidRoom.applyEvent` → `SnapshotMsg[]`. Page `/replay/[sessionId]` Server Action authz owner/thief → canvas player scrub/play 10Hz + timeline. `RaidRoom.applyEvent`: move/chestOpen/lockdown/exit/caught/timeout re-apply, tick/trapSprung/puzzleFail = markers.

## Auth
- WS upgrade: đọc cookie `sb-access-token` → `supabase.auth.getUser()` verify. **KHÔNG tin payload jwt** (red-team #3).
- App-layer authz (RLS phase sau).
- Prisma `service_role` (server-only, KHÔNG expose client).

## Client UI / rendering (visual redesign)
- **UI tokens/primitives:** semantic `--mf-*` colour tokens + `--z-*` ladder trong `globals.css` (guard bởi `tests/unit/masked-farm-tokens.test.ts`). Pixel primitives `src/components/game-ui/` (`pixel-frame`, `pixel-button`, `game-icon`, shared `item-icon`). Cấm `backdrop-filter` trên functional UI; corner 2–4px; identity hình qua `GameIcon`/manifest — không emoji.
- **Feature registry:** `src/lib/game/feature-registry.ts` pure (không React/Zustand/DOM/icon JSX) — một nguồn feature cho desktop rail, 4 primary + More mobile nav, hotkey hint, entry raid; component dispatcher dịch `FeatureTarget`.
- **Overlay policy:** `src/lib/game/overlay-policy.ts` `resolveSurface()` pure — top surface, z-index, focus, Escape, `blocksGameplay`/`pausesClock`. Precedence farm: shop → gift → dialogue → panel; `showStartScreen` blocking (`escape:none`); raid non-idle → delegate Escape cho `RaidView`, GameLayout không đóng UI ẩn phía dưới. `GameLayout` + `ui-gate.ts` dùng chung resolver.
- **Farm renderer:** `FarmScene` vẫn owner tick/movement/collision/bridge; presentation display-only theo layer `src/components/game/phaser/` (`terrain-sprite-renderer`, `crop-sprite-renderer`, `farm-entity-sprite-renderer`) — fallback geometric rõ ràng, integer-aligned, không subpixel blur. `?sprite=off` = internal render-only fallback procedural Canvas 2D (`textures-legacy.ts`, frozen fork; ADR-013) — không public feature.
- **Raid WS lifecycle:** `RaidView` vẫn owner WS lifecycle, input, finish guard; snapshot chỉ từ server. Live `RaidCanvas` + replay `replay-canvas-player` dùng **chung** `src/components/raid/raid-display-mapper.ts` (`mapRaidEntity`) — một display spec, không emoji/shape placeholder. Replay nhãn "reconstructed".
- **Mobile touch:** `RaidTouchControls` + farm D-pad raid-safe gate; layout variables reserved zones, không overlap D-pad/Use/hotbar/nav.

## Edge cases
| Trường hợp | Xử lý |
|---|---|
| alt-F4 | disconnect >5s → RaidSession `aborted`; reconnect session cũ (dog không reset); grace 30s → forfeit loot |
| 2 raider đồng thời | atomic `RETURNING` → 1 reject |
| Trap hidden | snapshot KHÔNG gửi trap, chỉ `trap-sprung` event (phase 1: bear/spike/alarm, server-only) |
| Snapshot velocity | mỗi entity có `dx,dy` + heading cho client interpolation (audit C3) |
| Constants drift | runtime assert `MAP_COLS*MAP_ROWS===farm.terrain.length` khi load farm (raid-server) |

## Models (xem `prisma/schema.prisma`)
`User` · `Farm` · `Inventory` · `Mask` · `DefenseConfig` · `RaidSession` (partial unique index `WHERE status='active'`, audit M1) · `RaidEvent` (`@@unique([sessionId, tick, seq])`, audit M2) · `RaidLossDaily`.

Xem `./code-standards.md` (authority pattern), `./deployment-guide.md`, `./design-guidelines.md` (UI contract), `./masked-farm-visual-direction.md` (art direction), `./visual-redesign-release-checklist.md` (release gate).
