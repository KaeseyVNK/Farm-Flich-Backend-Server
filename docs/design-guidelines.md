# Design Guidelines — Masked Farm

> Pixel top-down nông trại + trộm/phòng thủ multiplayer. Cozy farm (ngày) ↔ mysterious night-heist (trộm).
> Base từ theme pixel sẵn trong `src/app/globals.css` (Stardew-inspired earthy palette). Hướng dẫn này mở rộng cho hệ trộm/phòng thủ.

## 0. Canonical contract (read first)

- **Art direction + migration register:** [masked-farm-visual-direction.md](./masked-farm-visual-direction.md) — locked Phase 1 style target, asset readiness register, and the literal-pattern (hex/radius/blur/emoji/z-index) inventory that drives Phase 2+.
- **Runtime token source of truth:** `src/app/globals.css` (`:root`). The `--mf-*` semantic colour tokens + the `--z-*` z-index ladder are the canonical contract for the redesign, guarded by `tests/unit/masked-farm-tokens.test.ts`. The legacy tokens below (`--ink`, `--surface`, `--primary`, …) remain for compatibility; do not invent new raw hex/radius/blur/z-index in component code. Visual redesign (all 6 phases) **hoàn tất** — primitives trong `src/components/game-ui/` (`pixel-frame`, `pixel-button`, `game-icon`, shared `item-icon`).
- **Asset readiness contract:** `src/lib/game/assets/asset-manifest.ts` (`AssetEntry` kind/readiness/provenance + `resolveApprovedAsset`). Icons resolve through `resolveIcon` → typed `IconResolution`; no consumer may render a non-existent key.

### Prohibited patterns (enforced by the migration register)

- **No CSS glass / `backdrop-filter`** on functional UI; no blur on the canvas. ✅ asserted — `.glass-hud` đã xoá (commit `2ae08c3`), không còn functional UI blur.
- **No corner > 4px** on cards/buttons/modals (`0/2/4px` only; `9999px` only for an intentional status dot). ✅ asserted — corner only `2/4px`.
- **No native emoji as gameplay/UI identity.** Decorative emoji in prose is allowed; identity (item/tool/crop/NPC/feature/alert) resolves through the manifest/icon contract. ✅ asserted — interactive emoji đã migrate sang `GameIcon`/`item-icon` (Phase 4); chỉ còn emoji decor trong tiếng Việt helper copy, không nằm interactive identity.
- **No arbitrary `z-*` value.** Use the named `--z-*` ladder.
- **No soft card elevation / glow glow as the sole state signal.** State is text + shape + colour together; reduced-motion keeps the signal.
- **No Press Start 2P for Vietnamese text** (missing diacritics). PS2P is ASCII numerals/keycaps only.

The detailed rules in the sections below remain in force; where a value above and a section below differ, the `--mf-*` / `--z-*` token layer and this §0 win for new redesign work.

## 1. Brand & Mood

- **Chủ farm (ngày)**: ấm, cozy — parchment, wheat, forest green, ánh vàng harvest.
- **Trộm (đêm/night overlay)**: tối, căng thẳng — nền `--night` indigo, vignette `--night-deep`, gold glow là điểm nhấn, đỏ chỉ cho Alarm (`--alarm`), tím `--mystic` chỉ dùng cho hệ trộm/mask.
- **Visual style**: pixel art top-down, farm gọn đủ nhìn toàn cảnh một màn hình (tension từ thời gian/chó/bẫy, không từ map ẩn). Crisp pixel, không blur — đổi MÀU + TỐC ĐỘ pulse để báo trạng thái.
- **Tone**: vui + bí ẩn — mặt nạ trộm nên "ngộ nghĩnh đáng ngờ" thay vì đáng sợ.

## 2. Design Tokens

### Màu (14 tokens — thêm 5: `--night-deep`, `--mystic`, `--teal`, `--alarm` + `--night` đổi từ overlay sang màu nền solid)

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--bg` | `#f6efe0` (light) / `#20211c` (dark) | Nền ngoài canvas |
| `--surface` | `#fffaf0` | Panel, card, modal |
| `--surface-2` | `#f3e8cf` | Panel con, input nền |
| `--primary` | `#4e7d3a` | Nút chính, active, thành công |
| `--accent` | `#e7b94e` | CTA, selection, gold glow, focus ring |
| `--danger` | `#c0452f` | Alert thường, nút hủy, stun, HP thấp |
| `--gold` | `#d99a2a` | Coin/currency text (on light) |
| `--coin` | `#f0c964` | Coin icon fill |
| `--night` | `#151b38` | Raid overlay nền (indigo — phân biệt vụ trộm vs đêm thường) |
| `--night-deep` | `#0c1126` | Vignette, panel, alert bar trong raid |
| `--mystic` | `#8b5cf6` | Mask, heist UI, CTA ĐI TRỘM — KHÔNG dùng nơi khác |
| `--teal` | `#2f9e8f` | Bẫy, manh mối, thông tin chưa biết, trạng thái Stealth |
| `--alarm` | `#ff4438` | Đỏ báo động sáng hơn `--danger` — RIÊNG trạng thái Alarm |
| `--ink` | `#3b2f23` | Text chính |

- Ink phụ `#6b5b45` (muted text — nâng tương phản từ `#8a7a5e` ~3.8:1 lên ~5:1 để đạt AA 4.5:1 cho text nhỏ). Viền `#6b4a2b` (wood-frame).
- Overlay raid = `rgba(21,27,56, α)` — α theo cấp alert (55/65/75%), không dùng `--night` solid làm overlay trực tiếp (cần xuyên thấy canvas).
- Triết lý: ngày = cozy (palette cũ), raid = invert indigo + tím/teal signal.

### Font — VERIFIED: Press Start 2P thiếu ~50 ký tự tiếng Việt (ơ, ư, ạ, ả, ấ, ầ, ậ, ẹ, ệ, ỳ, ỵ...), fallback về Geist làm vỡ pixel identity. Glyph check bằng fontTools.

- **Body/UI → `VT323`** — pixel terminal, **full tiếng Việt** (verified 72/72 glyph), x-height cao dễ đọc. Cỡ UI 16–17px, HUD 12–13px.
- **Display/title/CTA → `Bungee`** — poster retro dày, **full tiếng Việt**. Dùng: logo, title panel, HUD title, nút CTA (ĐI TRỘM, THOÁT). Chữ việt trong Bungee viết HOA (text-transform: uppercase) cho chắc glyph.
- **Số/icon-key → `Press Start 2P`** — CHỈ ký tự không dấu: 0–9, A–Z, phím (I, P, C, R...), số loot/timer. Không dùng PS2P cho text tiếng Việt.
- Load (Next, `src/app/layout.tsx`): `next/font/google` — VT323 + Bungee subsets `['vietnamese','latin']`; PS2P giữ `['latin']`.
- Không dùng font pixel cho paragraph >1 dòng — VT323 tối đa 1–2 dòng ngắn; văn bản dài vẫn Geist.

### Spacing & shape

- Grid 4px (mọi margin/padding/gap theo bội số 4).
- Corner panel **4px max** (panel, button, modal, card — KHÔNG bo tròn mềm kiểu rounded-xl 10px). Chip/kbd: 2px. (Thực thi trong `pixel-frame`/`pixel-button`, không literal radius tự do.)
- Border **2px solid**, viền `#4a3119` (dark wood) — nét pixel rõ. Bootstrap 3px+ không dùng; ngoại lệ: viền 4px `--alarm` khi Alert cấp cao (cảnh báo toàn canvas).
- Icon 24px trong button 44×44 (min touch target). Nút di chuyển raid/dàn phím touch qua `RaidTouchControls` + farm D-pad raid-safe gate; vùng chơi nằm trong reserved CSS layout zones — D-pad/Use/hotbar/nav không overlap.

## 3. Layout & Components

### FeatureBar (sidebar)

- Desktop (≥768px): cột dọc trái rộng **72px**, `wood-panel-flat`, icon 48×48, gap 8px, kbd badge góc (PS2P). Pattern có sẵn: `src/components/layout/FeatureBar.tsx`. Groups (daily/making/explore/progress/utility/mode) render từ `src/lib/game/feature-registry.ts` — một nguồn cho desktop rail, mobile nav, hotkey hint, entry raid.
- Mobile (<768px): bottom bar **60px** — **4 primary actions + More sheet**, không horizontal scroll 10 tabs. Cùng thứ tự FEATURES, bỏ tooltip (long-press hoặc label chữ nhỏ).
- Active state: viền accent + glow accent; indicator sọc trái 6px (desktop) / sọc trên (mobile).
- Nút **mask `--mystic`**: trong FeatureBar (farm view) — mở danh sách farm mục tiêu / vào chế độ trộm. Icon qua `GameIcon` (không emoji).

### HUD chính (farm view)

Farm RPG 4-corner HUD — **không** thanh header web trải full chiều ngang.

| Góc | Nội dung | Lý do |
|---|---|---|
| **Trên-trái** | 3 nút gỗ: Menu · Túi · Kỹ năng. Bên dưới (desktop): pin **Việc hôm nay** (quest tuần lễ hội). | Hành động hệ thống + việc tiếp theo, không phải trạng thái |
| **Trên-phải** | Đĩa mùa/thời tiết + ngày/giờ + thanh vàng (icon xu + số) | Đồng hồ và tiền đọc trong 1 cụm |
| **Dưới-giữa** | Hotbar công cụ/vật phẩm | Tương tác chính, gần tay |
| **Dưới-phải** | 2 thanh dọc: thể lực (xanh, sấm) + ánh sáng còn lại trong ngày (vàng, mặt trời) | Chỉ meter có thật — **không** vẽ thanh máu giả |

- Khung gỗ đậm (`#2a1810` + bevel pixel), corner 4px, **không** glass blur, **không** che playfield.
- Ngủ = giường trong nhà (không nút teleport "Về nhà" trên HUD). Pause nằm trong Settings.
- Body VT323 13–20px, số vàng Press Start 2P 10px. Cảnh báo quan trọng: banner center-top overlay.

### Raid HUD (góc nhìn trộm)

- HUD trên: **Loot counter** (số PS2P + giá trị loot) · **Exit timer** (dưới 10s → đỏ `--alarm`) · **Alert level** 3 cấp · **Thoát** button (`--alarm`). Bố cục survival — desktop button + 44px touch target narrow/mobile.
- Touch movement/interact/exit: `RaidTouchControls` reuse `interact-chest` intent server-validated; desktop input tách khỏi puzzle/modal focus.
- Trạng thái 3 cấp — đổi MÀU + TỐC ĐỘ pulse, không dùng blur (phá crisp pixel):

| Cấp | Overlay | Viền/pulse |
|---|---|---|
| **Stealth** | `--night` 55% + vignette | viền 2px `--teal` (tĩnh) · timer teal |
| **Caution** (sai 1–2) | 65% | viền 2px `--accent` nhấp nháy 1.5s |
| **Alarm** (sai 3) | 75% | viền 4px `--alarm` pulse 0.5s |

- Alert bar (center-top trên canvas): nền `--night-deep` + viền theo cấp (Alarm = `--alarm` + pulse 0.5s). Cảnh báo **luôn kèm text** (icon màu không đủ — accessibility).
- Lockdown (chủ về): overlay dày hơn + banner "Lockdown" (nền `--night-deep`, viền `--alarm`) — chủ điều khiển cổng/đèn/chó, không đánh trực tiếp.

### StartScreen

- Logo + title **Bungee**, backdrop sky → hills → grass (như StartScreen hiện có).
- Farm select list (slot Load/New) — entry vào farm thường: ngày/giờ, coin, trạng thái shield.
- CTA **ĐI TRỘM** (`--mystic`, border 2px, text trắng + viền đậm `#5b3fd6` cho contrast) — entry heist, tách biệt khỏi CTA farm thường (`--primary`/`--accent`).

### Panel & Modal

- Panel (inventory/farm/defense): trượt từ trái dọc theo sidebar (`animate-slide-in-left`), nền `parchment`, corner 4px, header VT323/Bungee + nút close 44×44.
- Modal (nghiệp vụ: xác nhận rời farm, chọn farm để trộm): back overlay `rgba(0,0,0,0.5)` + card `pop-in`, border 2px `#4a3119`, max-w phù hợp.
- Slot rương: gỗ/sắt/lớn → viền khác nhau; đang giải puzzle = focus glow accent.

## 4. Interaction States

| State | Rule |
|---|---|
| hover | lift `translateY(-2px)` + brightness 1.08 (desktop only) |
| active/pressed | `scale(0.96)` |
| selected/on | viền accent + glow `0 0 14px --accent` |
| disabled | opacity 0.45, không glow, `cursor: not-allowed` |
| danger | viền danger + text danger — KHÔNG dùng đỏ cho trạng thái thường; `--alarm` chỉ dùng ở Alarm raid |
| focus-visible | outline 3px `#f0c964` + offset 2px (đã global trong globals.css) |

- Mọi trạng thái màu đều đi kèm text/icon (không phụ thuộc màu đơn).
- Anim: slide/pop 0.22–0.28s cubic-bezier(0.22,1,0.36,1); tắt hết khi `prefers-reduced-motion: reduce`.

## 5. Accessibility

- Contrast ≥ WCAG AA: text trên `--surface` dùng `--ink`; trên wood-panel dùng `#fbf7ec`; gold/text sáng chỉ trên nền tối. `--mystic` CTA: text trắng + viền `#5b3fd6` để đủ contrast trên nền tím.
- Touch target ≥ 44×44 (mobile, safety net trong globals.css `@media max-width:767px`). Nút HUD gỗ `.rpg-wood-btn` 44×44.
- Font pixel: PS2P ≥ 10px (chỉ số/key), VT323 body ≥ 16px, Bungee ≥ 14px.
- Alert đổi màu kèm text label + (khi có audio) kèm icon.
- Focus ring vàng trên mọi nền (light + dark).

## 6. Canvas

- Farm canvas placeholder: tối đa **960×704** (tỷ lệ 15:11 — TILE 32 × map 30×22 tiles), `.pixelated`, scale-down responsive giữ nguyên tỷ lệ, bo bởi frame `wood-panel`.
- Renderer display-only theo layer (`src/components/game/phaser/`): terrain → crop → entity; geometric fallback rõ ràng, integer-aligned, không subpixel blur. `?sprite=off` = internal fallback procedural Canvas 2D (`textures-legacy.ts`, ADR-013) — render-only, không public feature.
- Night overlay: `.vignette` + `rgba(21,27,56, α)` (α theo cấp alert, xem Raid HUD) lớp trên canvas khi trộm/lockdown.
- HUD label trên canvas: `.hud-text` (text-shadow 0 2px đen).

## 7. Wireframe Tham Chiếu

- `docs/wireframes/start-screen.html` — entry: login ẩn danh, farm select list, CTA **ĐI TRỘM** (mystic).
- `docs/wireframes/farm-view.html` — farm toàn cảnh + HUD + FeatureBar (có nút 🎭 mask mystic).
- `docs/wireframes/raid-view.html` — trộm: HUD raid (loot/timer/alert/Thoát) + night overlay 3 cấp + alert bar `--night-deep`.

## 8. TBD / Mở

- **Resolved (phase 7):** VT323/Bungee full tiếng Việt verified (fontTools glyph check 72/72); PS2P latin-only (chỉ số/key). Raid map reuse 960×704 confirmed (wireframe `docs/wireframes/raid-view.html`). Raid = realtime multiplayer confirmed (MVP plan).
- **Resolved (visual redesign, 2026-08-14):** replay timeline visual **đã xong** — replay canvas player dùng chung `raid-display-mapper.ts` (`mapRaidEntity`) với live RaidCanvas, non-emoji pixel primitives; nhãn "reconstructed" khi không phải forensic capture. Chi tiết style scrubber vẫn TBD theo từng screen.
- Palette màu face mask (3 loại) — chờ design asset.