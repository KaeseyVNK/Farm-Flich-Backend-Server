# Visual Redesign — Release Checklist (Phase 6)

Gate thả phát hành cho toàn bộ Masked Farm Whole-Game Visual Redesign (plan `260813-2050-masked-farm-visual-redesign`). Chạy đúng thứ tự; fail tầng nào thì fix và chạy lại từ tầng đó — build xanh sau một test bị bỏ không tính là pass.

## 1. Command suite (clean env)

| # | Command | Evidence (ngày chạy) |
|---|---------|----------------------|
| 1 | `npm run lint` | 0 errors, 0 warnings (2026-08-14) |
| 2 | `npm test` | 677/677 pass |
| 3 | `npm run test:integration` (local DB env) | 101/101 pass |
| 4 | `cd mini-services/raid-server && bun test` | 295/295 pass, 813 expects |
| 5 | `npm run test:e2e` (dev:3000 + raid-server:3001) | 75 pass / 5 fixme |
| 6 | `npm run build` | ✓ (dynamic routes) |

E2E prerequisites: `NEXT_PUBLIC_E2E=1` next dev (port 3000), raid-server bun (port 3001, `bun run --env-file=../../.env src/index.ts`), Supabase env trong root `.env` (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY). Local run: `E2E_SKIP_WEBSERVER=1`.

5 fixme raid states (stealth/caution/alarm-lockdown/puzzle-result/summary): snapshot server 5Hz + random position → pixel-pin không ổn định; coverage behavioural nằm ở `raid-join.spec.ts` + video/đường dẫn tương ứng. **Không phải** lỗi bị bỏ.

## 2. Screenshot catalogue (đã review native-scale)

Snapshot dir: `e2e/visual-baseline.spec.ts-snapshots/`. Baseline đầu tiên chỉ accept sau khi review ở native scale — snapshot không bao giờ được chấp nhận chỉ vì được regenerate.

| State ID | Viewport | Behavioural assertion trước shot |
|----------|----------|----------------------------------|
| entry-save-slots | 1280×800 | save-slot list + focusable new-game |
| farm-day-idle | 1280×800 | canvas ready + store hydrated |
| raid-lobby | 1280×800 | 3 map selector buttons + Đóng |
| replay-timeline | 1280×800 | Replay Raid title + Timeline label |
| social-village | 1280×800 | Làng title + canvas |
| mobile-farm-controls | 375×667 | D-pad/hotbar/nav rects không chồng |

Cập nhật baseline: `npx playwright test e2e/visual-baseline.spec.ts --update-snapshots`, kèm lý do trong PR. Threshold `{ maxDiffPixelRatio: 0.02, threshold: 0.2 }`.

## 3. Responsive + accessibility evidence

- **Viewport matrix**: desktop 1280×800, tablet-portrait 768×1024, mobile 375×667, mobile-narrow 320×568, landscape 667×375 **DPR2** — `responsive.spec.ts` (no horizontal overflow, no control collision) + `visual-baseline.spec.ts` viewport smoke.
- **Input lifecycle**: `overlay-policy.spec.ts` (block/pause/Escape/resume mọi surface), `touch-controls.spec.ts` (farm D-pad move thật + 44px target), `raid-join.spec.ts` (raid input + socket finish guard), `focus-trap.spec.ts` (modal focus/Tab/restore).
- **Accessibility**: `accessibility-navigation.spec.ts` — landmarks/roles, accessible names khớp feature-labels registry (VN diacritics nguyên), Tab order, không infinite CSS animation dưới reduced motion. Unit: `ui-gate`, `theme-tokens`, `safe-area`, `feedback-bundle`.
- **Renderer resilience**: `renderer-resilience.spec.ts` — Phaser remount sạch, error boundary bọc canvas, `?sprite=off` fallback render + input sống. `farm-renderer-characterization.spec.ts` — data/coordinate contract.
- **Performance**: `performance.spec.ts` — boot 1766ms (diagnostic, không budget cứng), panel open+close median 66ms, single canvas + không resource-fetch leak sau churn. Raid 5Hz + socket cleanup: `raid-join.spec.ts`.

## 4. Rollback

Mỗi phase là presentation-only commit độc lập; revert commit presentation mà không cần data repair. Order an toàn: revert Phase 6 → 5 → 4 → 3 → 2 → 1; adapters/compat seam (Phase 2) giữ nguyên. `?sprite=off` fallback là đường rollback nội bộ — giữ core path đã smoke test (renderer-resilience) đến Phase 6; **chưa** xóa.

Revert list (branch `feat/masked-farm-mvp`): mỗi phase có commit riêng theo nhóm surface; kiểm tra `git log --oneline` trước khi release để ghi chính xác.

## 5. Asset provenance + locked decisions

- Asset pipeline: curated Farm RPG pack + manifest/provenance register từ Phase 1; mọi bổ sung asset mới phải qua manifest/dimension/frame/pivot/native-scale review.
- `?sprite=off` = internal migration/rollback path only, không public parity, không advertise. Removal cần plan dọn riêng được duyệt.
- `DefenseUpgradePanel`/`TrapConfigPanel`: defer, unmounted, không navigation entry; plan gameplay riêng phải định route/data/action owner/auth/tests trước khi public.
- Không emoji interactive/gameplay identity; không `backdrop-filter` hay corner >4px trên game UI mới; touch target ≥44px trừ HUD compact đã kiểm chứng; respect reduced-motion/flashing.

## 6. Known limitations (owner + mitigation)

| Limitation | Owner | User impact | Mitigation / follow-up |
|-----------|-------|-------------|------------------------|
| 5 raid snapshot states không pixel-pin | Phase 5 | Không — behavioural test bao phủ | video + raid-join behavioural evidence |
| Fallback `?sprite=off` không parity visual | ADR-013 | Không (internal) | core smoke qua Phase 6; removal cần approval |
| Defense/trap config UI chưa có | gameplay plan sau | Không public | route/auth/tests trước khi expose |
