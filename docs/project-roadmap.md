# Project Roadmap — Masked Farm

> Track phase status. Cập nhật sau mỗi milestone (documentation-management rule).

## MVP phases — Masked Farm MVP (`plans/260810-masked-farm-mvp/`)
| # | Phase | Status | Notes |
|---|---|---|---|
| 1 | Foundation Supabase + Auth | **DONE** | code xong, chờ keys provision |
| 2 | Data layer Prisma + authority | **DONE** | `User.gold` + `Inventory` server-side, `Farm` JSONB phi-gold (audit C1) |
| 3 | Design tokens + fonts | **DONE** | 5 raid token + VT323/Bungee/PS2P |
| 4 | raid-server engine core | **DONE** | WS 10Hz tick / 5Hz snapshot, dog AI auto-patrol, atomic join |
| 5 | Raid client + UI | **DONE** | snapshot interpolation (`dx,dy`), 3-level alert |
| 6 | Raid finalize + shield + lockdown + replay | **DONE** | RPC transaction, owner-only replay authz |
| 7 | Test + review + docs + deploy | **DONE** | integration test 2-client, deploy skeleton, BFS benchmark, docs |

## Roadmap FULL 10 phases (`plans/260810-2212-masked-farm-roadmap-full/`)
Post-MVP full concept — tất cả DONE (commit `f916fc6`, 326 test pass).

| # | Phase | Status | Notes |
|---|---|---|---|
| 1 | Trap system | **DONE** | bear/spike/alarm, springTrap, collision, slowUntilTick |
| 2 | Iron/safe chests + puzzle | **DONE** | wood(memory)/iron(timing)/safe(sequence), loot tables, ket exclude |
| 3 | Defense XP deepen | **DONE** | computeDefenseXp modifiers, spend_defense_xp RPC, dog/trap levels |
| 4 | Multi-mask + spoof fix | **DONE** | maskId server-resolved (join/index/finalize), craft_mask RPC, 4 effects |
| 5 | Friends/social | **DONE** | Friendship canonical, gift_item RPC, allowlist, daily cap 5 |
| 6 | Marketplace P2P | **DONE** | Listing/Trade, marketplace_buy RPC, 5% fee, price floor/ceiling ±60% |
| 7 | 3 raid maps (biome) | **DONE** | beach/farm/forest vision/hearing mult |
| 8 | Village hub | **DONE** | Realtime presence + chat, /village page |
| 9 | Lockdown auto + re-sim replay | **DONE** | gateCloseAt→gateCloseTick (Date.now fix), owner-presence auto lockdown, replayEvents headless, canvas player |
| 10 | Production deploy | **DONE** | Caddyfile, PM2 ecosystem, Dockerfiles, smoke/k6 scripts, runbook |

## Visual redesign — Masked Farm (`plans/260813-2050-masked-farm-visual-redesign/`)
Toàn bộ visual system — tất cả DONE (code + code-review, bài review cuối `169f710`). Full suite xanh: lint, 677 unit, 101 integration, 295 raid-server bun, 75 E2E (5 fixme raid snapshot states), build pass, baseline pixels không đổi.

| # | Phase | Status | Notes |
|---|---|---|---|
| 1 | Visual contract + regression baseline | **DONE** | `docs/masked-farm-visual-direction.md` style target, asset readiness register, token inventory, screenshot fixture catalogue |
| 2 | Reusable UI system + app shell | **DONE** | pixel primitives (`game-ui/`), pure `feature-registry`, `resolveSurface` overlay policy, MobileTabBar 4 primary + More |
| 3 | Farm world + day HUD | **DONE** | Phaser display-only layer renderers (terrain/crop/entity), fallback geometric, semantic atlas mappings, feedback-bundle |
| 4 | Player flows + management surfaces | **DONE** | StartScreen/Bật book/journey surfaces → GameIcon (bỏ emoji identity), shared `item-icon`, seam `initialiseFreshFarm`, focus trap E2E |
| 5 | Raid replay + social surfaces | **DONE** | RaidView giữ WS lifecycle, shared `raid-display-mapper` live+replay, `RaidTouchControls`, social pages primitives, DefenseUpgrade/TrapConfig defer |
| 6 | Cross-device acceptance + rollout | **DONE** | visual-baseline/touch-controls/accessibility-navigation/renderer-resilience/performance E2E, `?sprite=off` rollback smoke, release checklist |

## Map Enrichment MAX + Hay Day farm loop (2026-08-18 — merged `f4e9bd2`)
Post-redesign gameplay wave — tất cả DONE và đã merge vào main.

| Track | Status | Notes |
|---|---|---|
| Map Enrichment MAX (farm/village/beach/cave/interior) | **DONE** | `plans/260815-map-enrichment/` — 9 tasks, layout-logic rubric tests sau human-gate r1 reject; mọi zone sprite-rendered (placeholder graphics retired). Plan checkbox list stale — thực tế merge đủ |
| Hay Day farm loop (5 phases) | **DONE** | `plans/260815-0740-hayday-farm-loop/` — T.FALLOW plots, level catalog/shop XP, animals+HUD goals, camera homestead lock, orders+silo (save schema 5) |
| Orders fill-once fix | **DONE** (2026-08-18) | `farmStore.filledOrders` + tryFillOrder gate + ShopModal "Đã giao ✓" marker; save schema 6; hết in-day refill exploit. 944 unit + panels/farm-day e2e xanh |
| **W1 Câu cá hybrid** (full-concept roadmap) | **DONE + PUSHED** (2026-08-19) | `plans/260818-2100-wave1-fishing-hybrid/` 6/6 phases — 12 cá 3 vùng (ao/hồ FARM_LAKE/biển), reel bar hold/release, rod tool V4 pre-check, aquaculture nuôi cá (save 7), e2e 3/3; 1001 unit; human gate PASS (user playtest 2026-08-19); 12 commits `48bbc49..4b54db0` pushed, CI+deploy staging xanh |

## Full-concept 9-wave roadmap — W2–W9 ALL DONE (2026-08-19, `plans/reports/brainstorm-260818-masked-farm-full-concept-roadmap-report.md`)

Cả 8 wave còn lại đã có plan chi tiết (scout 4-agent: concept + gameplay + persistence + assets). Cook tuần tự, mỗi wave: TDD + full gates + human gate.

| Wave | Plan | Status | Nội dung chính | Save schema |
|---|---|---|---|---|
| W2 Nấu ăn + food chain | `plans/260819-0911-wave2-cooking-foodchain/` | **DONE** (2026-08-19) | 14 recipe (bag∪silo), cook minigame timing (tier2/3), buff speed/xp, bếp kitchenpot, 205 Food Icons, dish sell > input; save 8; unit 945, e2e cooking 3/3 + regression 31/31; review fixes (deposit-wins, overlay-policy cooking) | 7→8 (buffs) ✓ |
| W3 Decor + cosmetics | `plans/260819-0911-wave3-decor-cosmetics/` | **DONE** (2026-08-19) | 20 decor (14 ngoài + 6 trong nhà), DecorMode đặt/xoay/lật/nhặt, DecorPanel kho+mua, raid-exclusion §7 test 2 phía; save 9; unit 985, e2e decor 2/2; review fixes (house-PATH, interact leak, uid reseed, camera cursor, playerAt blocker) | 8→9 (placedDecor+owned) ✓ |
| W4 Ghé thăm farm + social | `plans/260819-0911-wave4-farm-visit-social/` | **DONE** (2026-08-19) | FarmLike+VisitLog (RLS friend-read/visitor-insert+friendship CHECK), like 1/ngày UTC, 12 sticker, guestbook ≤200 rate 3/phút, visit render + decor/mùa (SVG), VisitorsPanel poll 30s, Farm.placedDecor sync-ready; review fixes (id default, onConflict format, RLS WITH CHECK); unit 1003, e2e 2/2 | — (server-only) ✓ |
| W5 Combat quái | `plans/260819-0911-wave5-monster-combat/` | done 2026-08-19 | zone deepforest, 4 quái (slime/sprout/myconid), sword tool (Alex sheet), loot feed 4 recipe mới, cozy-energy thay HP | +1 (world.zone) |
| W6 Mount ngựa/xe đạp | `plans/260819-0911-wave6-mounts/` | done 2026-08-19 | Alex Horse/Bicycle premade sẵn, kinetics mult 1.5×/1.25×, stable building, auto-dismount, §11 không teleport | +1 (mounts) |
| W7 Raid endgame 4 sub | `plans/260819-0911-wave7-raid-endgame/` | done 260819 (9 commits, 1110 unit + 345 bun, review 3C/2H fixed) | 7a overview+fog §3.2 + newbie immunity + cloud sync (blood-moon sống) · 7b 5 giống chó + waypoint chủ + use-item mồi dụ · 7c 3 puzzle còn lại (xoay khóa/nối mạch/ghép hình) · 7d chợ đen Jack + bounty + danh tiếng 3 nhánh | Prisma mới |
| W8 Festival theo mùa | `plans/260819-0911-wave8-seasonal-festivals/` | done 260819 (7 commits, 1155 unit, e2e 4/4, review 2H/2M fixed) | schedule pure 13/24 + theme 4 mùa host NPC · catalog 12 event decor + 4 trophy (không mua §17) · scoring decor/derby/cookoff/puzzle (10đ/lượt sau review) · catchLog save v11 · village overlay 7 props non-solid + getter placements · FestivalPanel claim 1 lần key questStore + festivalStore cap 3 món + puzzle booth memory · bridge setDate + e2e 4 specs + gallery | +1 (catchLog) ✓ |
| W9 Tutorial quest-driven | `plans/260819-0911-wave9-tutorial-quests/` | done 260819 (10 commits, 1210 unit + 345 bun, tutorial e2e 2/2 ×2 + full-suite re-run, review C1/H1 + 1M/3L all fixed) | 14 quest tuyến tính dạy toàn hệ (cày→câu→nấu→ăn→decor→visit→quái→mount→raid), retire story 5-chapter save v12, quest-item ket_ §7, economy balance pass (horse 6000/bicycle 1500/mask t2 1200), 3 prod fix từ e2e (HUD claim reactivity, deepforest tick, dead-scene teardown) | 11→12 (tutorial) ✓ |

Thứ tự phụ thuộc: W1→W2 (cá vào recipe) · W3→W4/W8 (decor là chất liệu contest) · W5/W6 độc lập · W7 cần W2 (food dụ chó) + W3 (không-trộm precedent) · W8 cần W3+W4+W7 puzzle · W9 cuối cùng bọc tất cả.

## Future roadmap (post-FULL)
Còn lại sau 10 phases — ponytail markers trong code.

### Gameplay
- Owner-set dog patrol waypoint
- Multi-raider gang (1 vs N)
- Replay trap re-sim (persist DefenseConfig snapshot vào RaidSession)
- Reconnect grace 5s (alt-F4 không abort ngay)

### Tech
- RLS policy đầy đủ (thay app-layer authz)
- Shared `@hgpp/game-core` package (hết constants drift raid-server — `defense-xp-config.ts` dup)
- `@prisma/adapter-pg` nếu pooler exhaust
- npc-shop prices sync `economy.ts` (hiện hardcode)
- Water/bridge BFS (terrain solid pattern MVP)
- Replay jsonb archive 30d (TBD)
- Web3 (sau retention)

## Decisions locked (đã chốt — xem `plans/reports/validate-260810-masked-farm-mvp-report.md`)
- 1 raider/farm/raid · replay = full re-sim (phase 9, canvas scrub/play) · Prisma `service_role` + app-layer authz · replay jsonb Postgres · lockdown = auto-detect presence + manual · dog patrol v1 = AI auto-patrol · daily raid-cap 3 vụ/farm/ngày · mask required · trap hidden snapshot · Edge Functions loại (wall-clock < raid) · ket = 0% steal · marketplace fee 5% partial buy · mask repair = KHÔNG (craft mới) · gift whitelist resources+crops, daily cap 5.

## Open questions
- Anon expiry: tắt Supabase auto-delete anon OR period > MVP (TBD).
- Replay archive window 30d (TBD).
- Mask economy balance (defer `economy.ts` review).
- Multi-raider gang: N raider tối đa bao nhiêu (TBD khi design).

Xem `./project-overview-pdr.md` (MVP scope), `./deployment-guide.md` (prod phase), `./visual-redesign-release-checklist.md` (redesign release tunnel).
