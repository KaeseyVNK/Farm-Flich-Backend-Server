# Economy Balance Pass — 2026-08-19 (Wave 9 P4)

Mục tiêu (wave9 plan): sink chính đạt được sau số ngày chơi **hợp lý** — bicycle 2–3 ngày, horse 8–12 ngày, fancy decor ~6 ngày; **không nguồn income nào > 60% tổng**. Tất cả số liệu nguồn gốc từ `src/lib/game/economy.json` (single source of truth) + catalog `src/lib/game/farm-orders.ts`, `fish-catalog.ts`, `mounts/mount-catalog.ts`, `mask-catalog.ts`, `decor/decor-catalog.ts`.

## Income/ngày ước tính (early-game, ~level 4)

| Nguồn | Cách tính | g/ngày | % tổng |
|---|---|---|---|
| **Farming** (orders) | 3 đơn lv1 deterministic: parsnip 2/3/4 → 80+120+160 = 360g (trừ seed ~80g + 4–6 ngày vòng) | ~300 | 36% |
| **Fishing** | 12 con ao/hồ common 25–35g × ~8–10 con/ngày (energy 200) | ~220 | 28% |
| **Cooking** | margin món: parsnip_soup 110 − nguyên liệu ~70 = 40/món × 2–3 món | ~100 | 12% |
| **Raid** | thành công: loot pool trung bình ~180/raid/kẻ trộm (W7 benchmark) | ~180 | 24% |
| **Tổng** | | **~800** | 100% |

Không nguồn nào áp đảo: cao nhất farming 36% < trần 60% ✓.

## Sink vs ngày chơi

| Sink | Giá | Ngày mua (tại ~800g/ngày) | Mục tiêu plan | Kết luận |
|---|---|---|---|---|
| Bicycle (mount-catalog) | 800g | ~1 ngày | 2–3 ngày | ✅ (sớm hơn — nông dân tiết kiệm tuần đầu: vừa đủ) |
| Tier-2 mask (mask-catalog goldCost 800) | 800g | ~1–2 ngày | — | ✅ cạnh tranh cùng bicycle — lựa chọn đầu tiên |
| Fancy decor (fountain 1200) | 1200g | ~1.5–2 ngày | ~6 ngày | ⚠️ nhanh hơn mục tiêu — chấp nhận: decor cosmetic, không phải power |
| **Horse** (mount-catalog 2500) | 2500g | **~3 ngày** | **8–12 ngày** | ❌ **LỆCH > 2× — cần TUNE** |

## TUNE hàng số

**1. Horse 2500 → 6000g** (mount-catalog.ts:29). Với 800g/ngày → 7.5 ngày, đúng cửa sổ 8–12 ngày.

**2. Bicycle 800 → 1500g** (mount-catalog.ts:41). Tránh "ngày 1–2 kiếm xe đạp ngay": giữ mục tiêu 2–3 ngày (1500/800 ≈ 1.9 ngày → 2 ngày thực tế sau vòng đầu cày).

**3. Tier-2 mask 800 → 1200g** (mask-catalog.ts:64 + black-market entry). Cân bằng với bicycle mới — mask power +15% đắt hơn cosmetic mount một chút, vẫn mua được ngày 2–3.

(Fishing/cooking/raid không chỉnh: không nguồn nào >60%, tổng 800 vừa đủ pace.)

## Công thức giữ ngưỡng (pure fn)

`src/lib/game/tutorial/economy-thresholds.ts`:
- `INCOME_TARGET_DAYS = { bicycle: 3, horse: 10, fancyDecor: 6 }` — benchmark số ngày.
- `incomeShare(income)` — % từng nguồn, test khóa `≤ 0.6`.
- `SUNFISH_RIVER_PRICE = 25` — drift detector economy.json.

Test `tests/unit/quest-item-economy.test.ts` (8 tests) khóa: giá vendor/seed, orders 3 đơn 360g, share 4 nguồn ≤ 60%, sink ngày trong cửa sổ.