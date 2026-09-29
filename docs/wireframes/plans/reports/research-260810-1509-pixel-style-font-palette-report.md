# RESEARCH REPORT — Pixel Style: Palette, Font, Raid Pacing

**Date:** 2026-08-10 | **Agent:** researcher (pixel style) | **Trạng thái:** DONE

## 1. Bảng màu — thêm 6 token (giữ nguyên palette cozy hiện có)

| Token | Giá trị | Vai trò |
|---|---|---|
| `--night` | `#151b38` | raid overlay nền (indigo, phân biệt vụ trộm vs đêm thường) |
| `--night-deep` | `#0c1126` | vignette + panel trong raid |
| `--mystic` | `#8b5cf6` | mask, heist UI, bí ẩn — không dùng nơi khác |
| `--teal` | `#2f9e8f` | bẫy, manh mối, thông tin chưa biết |
| `--alarm` | `#ff4438` | đỏ báo động sáng hơn `--danger`, riêng trạng thái Alarm |

Triết lý: day = cozy (giữ), raid = invert indigo + tím/teal signal.

## 2. Font — CRITICAL: tiếng Việt

**Press Start 2P hiện tại THIẾU ~50 ký tự tiếng Việt** (ơ, ư, ạ, ả, ấ, ầ, ậ, ẹ, ệ, ỳ, ỵ...). Mọi chữ "vụ trộm", "cảnh báo" fallback về Geist — vỡ pixel identity. Verified bằng glyph check (fontTools), không chỉ tin web.

**Đề xuất:**
- **Body/UI → `VT323`** (full 72/72 tiếng Việt, pixel terminal, x-height cao dễ đọc)
- **Display (title/CTA) → `Bungee`** (full tiếng Việt, poster retro dày)
- Giữ Press Start 2P chỉ cho số/icon-key (0-9, A-Z không dấu — verified đủ)

## 3. Pacing raid view — 3 cấp trạng thái

| Cấp | Overlay | Viền/pulse |
|---|---|---|
| Stealth | `--night` 55% + vignette | timer `--teal` |
| Caution (sai 1-2) | 65% | viền 2px `--accent` nhấp nháy 1.5s |
| Alarm (sai 3) | 75% | viền 4px `--alarm` pulse 0.5s |

Nguyên tắc: đổi MÀU + TỐC ĐỘ pulse, không dùng blur (phá crisp pixel).

## 4. Spacing/Size

- Grid 4px, corner panel 4px max (hiện rounded-xl 10px quá mềm), border 2px solid, touch min 44×44px
- Mobile: canvas full-width, HUD dồn top, tab bar bottom 56px

## 5. Wireframe đề xuất (3 màn)

- **StartScreen:** title Bungee + farm select list + CTA "ĐI TRỘM" (mystic, 2px border)
- **Farm view:** kế thừa GameLayout hiện tại + FeatureBar, thêm nút 🎭 mask (mystic)
- **Raid view:** HUD raid (timer/loot/alert/Thoát) + night overlay + alert bar 3 cấp + viền pulse

## Ưu tiên triển khai

1. Swap `--font-pixel` → VT323 + thêm Bungee (fix bug tiếng Việt, rẻ nhất)
2. Thêm 6 color token + `.font-pixel-display`
3. Raid view: overlay + 3-cấp pulse (kế thừa `.vignette`, `energy-pulse`)
4. Rounded-4px sweep trên game components

## Câu hỏi bỏ ngõ

1. Live preview VT323 vs Bungee cỡ 12-16px — chưa so mắt, cần test TopHUD trước khi thay toàn bộ
2. Raid map có reuse 960×704 hay cần texture night variant
3. Raid v1 là solo/offline farm hay realtime multiplayer — cần confirm scope
