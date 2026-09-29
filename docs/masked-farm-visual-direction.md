# Masked Farm — Visual Direction & Migration Register

> Phase 1 deliverable (plan `260813-2050-masked-farm-visual-redesign`, phase 1).
> This file is the **human contract** that gates Phase 2. It locks the art direction, the
> canonical token map, the asset readiness register, and the literal-pattern migration
> inventory. Read it together with [design-guidelines.md](./design-guidelines.md),
> the [implementation handoff contract](../plans/260813-2050-masked-farm-visual-redesign/implementation-handoff-contract.md)
> and the [visual design specification](../plans/260813-2050-masked-farm-visual-redesign/visual-design-specification.md).

## 1. Creative direction (locked)

**Masked Farm is a warm, hand-worked farm in daylight and a precise, tense heist at night.**
Day earns trust through tactility; night spends that trust under pressure. The two modes
share pixel craft, typography discipline, border language and interaction clarity — never
the same emotional signal.

| Mode | Balance | Palette anchors |
|---|---|---|
| Day (farm) | 70% warm/cozy, 30% mystery | parchment, soil, leaf green, harvest gold, wood |
| Raid (night) | deep indigo, restrained teal, near-black | gold = valuable/caution; red = danger **only**; mystic = masks/heist **only** |

The map is hero content. UI frames information and actions; it must not turn the viewport
into a card dashboard.

## 2. Canonical token map (runtime contract)

The single source of truth is `src/app/globals.css` (`:root`). `masked-farm-tokens.test.ts`
guards both presence and exact day-side values.

### Colour — `--mf-*` semantic roles

| Token | Day value | Night value | Role |
|---|---|---|---|
| `--mf-ink` | `#2f2116` | `#f2ead8` | primary readable text |
| `--mf-muted-ink` | `#6a5137` | `#b9b0a3` | supporting text (never sole disabled signal) |
| `--mf-paper` | `#f3e6c9` | `#202139` | base panel interior |
| `--mf-paper-raised` | `#fff7e4` | `#2a2d4d` | raised / selectable interior |
| `--mf-frame` | `#4a3119` | `#101223` | crisp 2px outline |
| `--mf-wood` | `#6c4426` | `#30304b` | rails / header / hotbar shell |
| `--mf-leaf` | `#47783c` | `#559d90` | confirm / healthy / stealth-support |
| `--mf-harvest` | `#d99a2a` | `#d8ad54` | gold / currency / caution |
| `--mf-danger` | `#b94639` | `#df5c55` | destructive / alarm only |
| `--mf-focus` | `#1d638f` | `#78d7cf` | keyboard focus outline |
| `--mf-disabled` | `#c6b48d` | `#4a4b63` | disabled fill + text/icon treatment |

Night values are scoped to raid-mode surfaces in Phase 5. The legacy tokens (`--ink`,
`--surface`, `--primary`, `--accent`, `--night`, `--mystic`, `--teal`, `--alarm`, …) remain
until the Phase 2+ migration swaps consumers over; do not delete them in Phase 1.

### Z-index — named layer ladder (no component invents a competing `z-*`)

| Token | Value | Content |
|---|---:|---|
| `--z-canvas` | 0 | Phaser/Canvas + world-only effects |
| `--z-world-hint` | 10 | non-interactive contextual hint (`pointer-events: none`) |
| `--z-hud` | 20 | HUD, hotbar, touch controls, mobile nav |
| `--z-panel` | 30 | Farm Book panel/drawer + backdrop |
| `--z-toast` | 40 | notification queue |
| `--z-event` | 45 | new-day / level / chapter feedback |
| `--z-modal` | 50 | dialogue, gift, shop, confirmations |
| `--z-mode` | 60 | start screen + full raid mode |

## 3. Geometry, typography, motion (condensed — full rules in design-guidelines.md)

- **Frame:** 2px solid `--mf-frame`; double/inner line only for top-level modal or selected slot.
- **Corner:** `0/2/4px` only. `9999px` only for an intentional status dot, never a card/button.
- **Shadow:** pixel offset only (`2px 2px 0`, `3px 3px 0`). No soft card elevation.
- **Gradient/blur:** no CSS glass / `backdrop-filter` on functional UI. No blur on the canvas.
- **Spacing:** 4px base; gaps ∈ {4, 8, 12, 16, 24}. No eyeballed 5/7/11px.
- **Touch target:** ≥44×44 CSS px for primary mobile action.
- **Motion:** 120–180ms UI state, 180–280ms panel entrance; no perpetual decorative motion; reduced-motion replaces motion with immediate state/colour/label.
- **Type:** Bungee (display/title/CTA, Vietnamese-safe), VT323 (body/UI, Vietnamese-safe), Press Start 2P (ASCII numerals/keycaps **only** — never Vietnamese text).

## 4. Style target at native scale (Phase 1 approval gate)

> **Gate:** a reviewer must identify **player, crop, NPC, tool, loot/chest, alert and primary
> action** at 1×/3× game scale without a tooltip. Native-scale = 16px source grid, integer
> 3× world scale, top-down silhouette, 2px edge, top-left light direction.

The curated Farm RPG pack already satisfies the tile/crop/animal/enemy/object/UI-shell
families. The roles below map each gameplay-identity need to its manifest source. Missing
families (marked **GAP**) require minimal supplemental production after the Phase 1 audit,
through the manifest/provenance flow — never mass generation.

| Role | Source / manifest key | Status |
|---|---|---|
| Terrain (4 seasons) | `tile.grass.*`, `tile.water.*`, `tile.path`, `tile.tilled`, `tile.cliff.*` | approved (curated) |
| House / barn / shadow | `tile.house`, `tile.barn`, `tile.shadow` | approved (curated) |
| Crop stages | `crop.atlas` (All Crops.png) — needs frame slicing per crop | approved source; **frame map GAP** (Phase 3) |
| Player character | — | **GAP** — no character sheet in manifest (Phase 3/4 supplemental) |
| NPC (Mayor/Robin/Pierre) | — | **GAP** — no NPC sheets; canvas currently paints emoji (Phase 4) |
| Tool / item icons | — | **GAP** — no icon sheets; ITEMS use emoji (Phase 4/5 via `resolveIcon`) |
| Animals | `animal.*` (8 sheets) | approved (curated) |
| Enemies | `enemy.*` (6 sheets) | approved (curated, raid-candidate art) |
| Raid avatar / dog / chest | raid uses crisp pixel primitives today | **GAP** — raid entity family (Phase 5) |
| UI shell / dialogue / bars | `ui.hud`, `ui.bars`, `ui.money`, `ui.button`, `ui.dialogue`, `ui.extras`, `ui.weather` | approved (curated) |

Until a GAP family is filled, the renderer renders a **documented crisp fallback**
(geometric primitive + accessible text/label) and the manifest entry stays `placeholder`.
No code may render an emoji as gameplay identity after its family migrates.

## 5. Asset readiness register

Readiness state machine (verification-and-rollout-matrix): `approved` → ship;
`placeholder` → documented fallback, temporary; `blocked` → do not load, surface a failure.

- **46 curated entries** — all stamped `readiness: "approved"`, `kind` inferred from key
  namespace, `provenance = { pack: "Farm RPG Tiny Pack (EmanuelleDev)", license: …, credit: … }`.
  Source: `src/lib/game/assets/asset-manifest.ts` (stamped at module load from `RAW_MANIFEST`).
- **Dimension / frame / pivot** fields exist on `AssetEntry` as optional; they become
  required for newly approved runtime assets. Recording actual dimensions for the curated
  set happens in Phase 3 (farm renderer) when frames are sliced; the raw pack is present
  locally so dimensions are measurable.
- **`resolveApprovedAsset(key)`** is the strict consumer gate — throws on unknown key and on
  any non-approved readiness. `assetUrl(key)` stays strict for unknown keys but does not gate
  readiness (the loader owns per-asset fallback).
- **Icon resolution** (`resolveIcon` / `resolveCategoryIcon`) returns a typed `IconResolution`:
  `{status:"approved", key}` only for a real manifest key, else `{status:"placeholder",
  category, reason}`. The old `icon.default` non-existent key leak is removed.
- **copy-assets strictness:** missing source for an approved entry is fatal (exit 1) with
  key+path; destination collisions are fatal. All 44 sources resolve today.

## 6. Literal-pattern migration inventory

Source: Phase 1 codebase audit (src/, e2e/, tests/; token source-of-truth files excluded).
Each row is a retain/replace/exception decision with an owning phase. Phase 1 does **not**
migrate components — it only locks the contract and registers the work.

### 6.1 Direct hex consumers → `--mf-*` / legacy tokens (Phase 2 panels, Phase 4 player surfaces, Phase 5 raid)

~491 Tailwind arbitrary-hex occurrences across 44 files. The top hex values map cleanly to
tokens (76% of occurrences):

| Hex (count) | Token target | Lead files |
|---|---|---|
| `#4a3119` (107) | `--mf-frame` | wood-frame border everywhere |
| `#3b2f23` (89) | `--mf-ink` / `--ink` | primary text |
| `#4e7d3a` (76) | `--mf-leaf` / `--primary` | confirm/active |
| `#e7b94e` (66) | `--mf-harvest` (raised) / `--accent` | CTA/selection/coin |
| `#fffaf0` (64) | `--mf-paper-raised` / `--surface` | panel/modal bg |
| `#6b5b45` (52) | `--mf-muted-ink` | muted text |
| `#fbf7ec` (46) | text-on-wood | wood-panel text |
| `#c0452f` (29) | `--mf-danger` / `--destructive` | danger |
| `#f0c964` (12) | `--coin` | coin icon fill |

**Biggest migration wins (Phase 2 + 4):** SettingsPanel (39), StartScreen (35),
CalendarPanel (33), SeedsPanel (29), InventoryPanel (27), ShopModal (27),
SkillTreePanel (25), RelationshipsPanel (19), DialogueModal (17), HelpPanel (16),
TopHUD (16), FeatureBar (16).

**Mid-tier tokens to add during migration** (not yet in the `--mf-*` set): panel-inner
border `#d2bf96`, panel-inner surface `#efe2c4`/`#efe6d2`, section-header brown `#8a6238`,
secondary text `#5a4a36`, hover surface `#fff7e2`, kbd bg `#d8c69e`, info blue `#6fa8dc`.

**Non-Tailwind hex** (inline style / data defs / canvas): see §6.4 for the canvas track;
inline JS hex (FeatureBar accent map, Notifications, TopHUD energy tiers, SkillTree/
Inventory category colours, data.ts crop/NPC colours, constants.ts season colours) migrate
to token reads in their owning phase.

### 6.2 Radius violations → 4px max (Phase 2)

176 classes violate the 4px rule: `rounded-lg` (71), `rounded-md` (50), `rounded-xl` (48),
`rounded-2xl` (5), `rounded-3xl` (2) → replace with `rounded` (4px). `rounded-full` (38) is
reviewed case-by-case (pills/avatars/coins stay; cards/buttons replace). `rounded-sm` (2px)
and `rounded-[2px]`/`rounded-[4px]` retain.

### 6.3 Blur / glassmorphism (Phase 2)

- `ContextPanel.tsx:108` `backdrop-blur-[1px]` — **replace** with solid overlay.
- `globals.css` `.glass-hud` `backdrop-filter: blur(8px)` — **exception decision pending**
  (conflicts with "no blur" rule; the HUD pill style depends on it). Phase 2 resolves: keep
  as a documented exception OR replace with a solid `--mf-wood` pill.

### 6.4 Canvas / procedural-renderer hex (Phase 3 farm, Phase 5 raid — separate track)

`src/components/game/textures.ts` (~150 hex) and `textures-legacy.ts` (frozen `?sprite=off`
fork) are the procedural pixel painter. Any change must be mirrored in both. Also:
`GameEngine.ts`, `MapPanel.tsx` + duplicated `visit-farm-canvas.tsx` `TILE_COLORS` (DRY),
`RaidCanvas.tsx`, `RaidView.tsx`, `replay-canvas-player.tsx`, `interact.ts` feedback flashes,
`phaser/game-config.ts` background. Tokenizing canvas paint is optional/lower priority — the
pixel art IS the palette; the rule is "no native emoji / soft-rounded rect as identity".

### 6.5 Emoji as gameplay identity (Phase 4 items, Phase 5 raid)

Centralised behind `resolveIcon` (already stubbed). **Definition sites (5):**
`data.ts` CROPS/TOOLS/SEEDS/RESOURCES/FORAGE/FOOD/NPCS, `constants.ts` SEASONS,
`bridge.ts` TRAVEL_SPOTS, `TrapConfigPanel.tsx` KINDS, `StartScreen.tsx` save-slot preview.
**Render sites (~14 + 2 canvas):** Hotbar, Inventory/Seeds/Crafting/Relationships/Calendar/
Map panels, Shop/Dialogue/Gift modals, NewDayToast, TopHUD, FeatureBar, textures.ts/
textures-legacy.ts NPC portrait. Note: TWEAK — emoji-based identity migrates family-by-family
as icon sheets enter the manifest; decorative emoji in prose (💡 tips, → arrows) stay.

### 6.6 z-index scale (Phase 2)

No documented scale existed; values were ad-hoc. The `--z-*` ladder is now the contract
(§2). Raid layers `z-[7]`/`z-[8]` (Lobby/Puzzle/RaidSummary) overlap dangerously and need a
Phase 5 pass to map onto `--z-modal`/`--z-mode`.

### 6.7 Shadow formulas (Phase 2)

4 hard-coded inline shadows to tokenize: `FeatureBar.tsx:68` (active glow),
`StartScreen.tsx:158` (sun glow), `ChapterToast.tsx:35`, `RaidHud.tsx:108`.

## 7. "Harvest Hollow" name/tone drift register

Phase 1 fixes document/browser title + i18n title/subtitle (pure metadata). Remaining
references are registered with their owning phase:

| Location | Content | Action / Phase |
|---|---|---|
| `src/app/layout.tsx` | metadata title/author/OG/appleWebApp | **fixed Phase 1** → "Masked Farm" |
| `src/i18n/messages/en.json`, `vi.json` | `start.title` / `start.subtitle` | **fixed Phase 1** → "Masked Farm" / "Farm by day, raid by night" |
| `src/components/layout/FeatureBar.tsx:118,125` | brand mark `aria-label` + visible `<p>` | Phase 2 (app shell) |
| `src/lib/game/save.ts:465` | default `farmName: "Harvest Hollow"` for new saves | Phase 4 (player/save management) |
| `src/lib/game/economy.json:2` | `_comment` provenance line | Phase 4 (inert; fix with economy pass) |
| `docs/codebase-summary.md`, `docs/project-overview-pdr.md` | "inherit Harvest Hollow engine" lineage | **retain** — accurate engine provenance, not product identity |

## 8. Visual approval checklist (Definition of Visual Quality)

- [ ] A first-time player identifies farm, tool, harvestable crop, NPC, chest/guard, active alert and exit without a tooltip.
- [ ] Mobile has no overlapping D-pad, hotbar, navigation or modal action zone.
- [ ] All essential states retain meaning in grayscale and with reduced motion.
- [ ] Vietnamese text fits and stays legible; Press Start 2P is never used for Vietnamese labels.
- [ ] Day and raid feel related by craft, not by indiscriminate purple/red/blur styling.
- [ ] No card has >4px corners, no functional glass blur, and no interactive identity relies on emoji.
