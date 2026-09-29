// Wave 3 P1 — catalog decor (ngoài trời + trong nhà), data-driven pattern W1/W2.
// §7 concept HARD RULE: furniture/cosmetic thuộc nhóm "KHÔNG THỂ TRỘM" —
// DECOR_STEALABLE = false cho TOÀN BỘ catalog (không có ngoại lệ per-item),
// placedDecor/decorOwned là field riêng trong save ⇒ tự-loại khỏi pool trộm
// (raid-server chỉ đọc terrain/crops/objects/forage/shippingBoxes — xem loss-cap).
// frame = vùng crop trong sheet nguồn (px, tile nguồn 16px; renderer scale ×3).
// Frame là ước lượng tạm từ kích thước sheet — tinh chỉnh ở phase render/human gate.
import type { ZoneId } from "@/lib/game/zones/types";

export interface DecorFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DecorDef {
  id: string;
  name: string;
  /** Asset key trong ASSET_MANIFEST (obj.decor.*). */
  manifestKey: string;
  zone: Extract<ZoneId, "farm" | "house">;
  /** Rộng/cao theo tile (frame.w/16). */
  w: number;
  h: number;
  solid: boolean;
  rotatable: boolean;
  price: number;
  tier: "basic" | "nice" | "fancy" | "event";
  /** W8: event/trophy decor chỉ nhận qua festival (§17) — KHÔNG mua bằng gold. */
  source?: "festival";
  unlockLevel: number;
  frame: DecorFrame;
}

/** Concept §7: mọi decor không bao giờ là mồi trộm — const minh bạch, test chốt. */
export const DECOR_STEALABLE = false as const;

/** 20 item launch (asset pack Objects Exterior/Interior — tên file đã verify). */
export const DECOR: readonly DecorDef[] = [
  // ── Ngoài trời (farm) — basic ─────────────────────────────────────────────
  { id: "fence_wood", name: "Hàng Rào Gỗ", manifestKey: "obj.decor.fence-wood", zone: "farm", w: 1, h: 2, solid: true, rotatable: true, price: 80, tier: "basic", unlockLevel: 1, frame: { x: 0, y: 0, w: 16, h: 32 } },
  { id: "fence_stone", name: "Hàng Rào Đá", manifestKey: "obj.decor.fence-stone", zone: "farm", w: 1, h: 2, solid: true, rotatable: true, price: 120, tier: "basic", unlockLevel: 1, frame: { x: 0, y: 0, w: 16, h: 32 } },
  { id: "fence_iron", name: "Hàng Rào Sắt", manifestKey: "obj.decor.fence-iron", zone: "farm", w: 1, h: 2, solid: true, rotatable: true, price: 160, tier: "basic", unlockLevel: 2, frame: { x: 0, y: 0, w: 16, h: 32 } },
  { id: "birdhouse", name: "Nhà Chim", manifestKey: "obj.decor.birdhouse", zone: "farm", w: 2, h: 2, solid: true, rotatable: false, price: 150, tier: "basic", unlockLevel: 1, frame: { x: 0, y: 0, w: 32, h: 32 } },
  { id: "hay_bale", name: "Bó Rơm", manifestKey: "obj.decor.hay-bale", zone: "farm", w: 2, h: 1, solid: true, rotatable: false, price: 90, tier: "basic", unlockLevel: 1, frame: { x: 0, y: 0, w: 32, h: 16 } },
  { id: "bench", name: "Ghế Gỗ", manifestKey: "obj.decor.bench", zone: "farm", w: 2, h: 2, solid: true, rotatable: true, price: 200, tier: "basic", unlockLevel: 2, frame: { x: 0, y: 0, w: 32, h: 32 } },
  // ── Ngoài trời — nice ─────────────────────────────────────────────────────
  { id: "street_lamp", name: "Đèn Đường", manifestKey: "obj.decor.street-lamp", zone: "farm", w: 1, h: 3, solid: true, rotatable: true, price: 320, tier: "nice", unlockLevel: 3, frame: { x: 0, y: 0, w: 16, h: 48 } },
  { id: "street_lamp2", name: "Đèn Đường Cổ", manifestKey: "obj.decor.street-lamp2", zone: "farm", w: 1, h: 3, solid: true, rotatable: true, price: 380, tier: "nice", unlockLevel: 3, frame: { x: 0, y: 0, w: 16, h: 48 } },
  { id: "picnic", name: "Bàn Picnic", manifestKey: "obj.decor.picnic", zone: "farm", w: 3, h: 3, solid: true, rotatable: true, price: 450, tier: "nice", unlockLevel: 3, frame: { x: 0, y: 0, w: 48, h: 48 } },
  { id: "notice_board", name: "Bảng Tin", manifestKey: "obj.decor.notice-board", zone: "farm", w: 2, h: 2, solid: true, rotatable: false, price: 260, tier: "nice", unlockLevel: 2, frame: { x: 0, y: 0, w: 32, h: 32 } },
  { id: "scarecrow", name: "Bù Nhìn", manifestKey: "obj.decor.scarecrow", zone: "farm", w: 2, h: 2, solid: true, rotatable: false, price: 300, tier: "nice", unlockLevel: 2, frame: { x: 0, y: 0, w: 32, h: 32 } },
  { id: "statue", name: "Tượng Đá", manifestKey: "obj.decor.statue", zone: "farm", w: 2, h: 3, solid: true, rotatable: false, price: 520, tier: "nice", unlockLevel: 4, frame: { x: 0, y: 0, w: 32, h: 48 } },
  // ── Ngoài trời — fancy ────────────────────────────────────────────────────
  { id: "fountain", name: "Đài Phun Nước", manifestKey: "obj.decor.fountain", zone: "farm", w: 3, h: 4, solid: true, rotatable: false, price: 1200, tier: "fancy", unlockLevel: 5, frame: { x: 0, y: 0, w: 48, h: 64 } },
  { id: "flower_sign", name: "Biển Hoa", manifestKey: "obj.balloons", zone: "farm", w: 2, h: 1, solid: false, rotatable: false, price: 640, tier: "fancy", unlockLevel: 4, frame: { x: 0, y: 0, w: 32, h: 16 } },
  // ── Trong nhà (house) ─────────────────────────────────────────────────────
  { id: "candle", name: "Nến Trang Trí", manifestKey: "obj.decor.candle", zone: "house", w: 1, h: 2, solid: false, rotatable: false, price: 100, tier: "basic", unlockLevel: 1, frame: { x: 0, y: 0, w: 16, h: 32 } },
  { id: "table_small", name: "Bàn Gỗ Nhỏ", manifestKey: "obj.decor.table", zone: "house", w: 2, h: 2, solid: true, rotatable: false, price: 280, tier: "basic", unlockLevel: 2, frame: { x: 0, y: 0, w: 32, h: 32 } },
  { id: "sofa_arm", name: "Sofa Bành", manifestKey: "obj.decor.sofa", zone: "house", w: 4, h: 2, solid: true, rotatable: false, price: 560, tier: "nice", unlockLevel: 3, frame: { x: 0, y: 0, w: 64, h: 32 } },
  { id: "cat_furn", name: "Giường Mèo", manifestKey: "obj.decor.cat-furn", zone: "house", w: 4, h: 2, solid: true, rotatable: false, price: 480, tier: "nice", unlockLevel: 3, frame: { x: 0, y: 0, w: 64, h: 32 } },
  { id: "xmas_tree", name: "Cây Thông Lễ", manifestKey: "obj.decor.xmas", zone: "house", w: 2, h: 4, solid: true, rotatable: false, price: 900, tier: "fancy", unlockLevel: 4, frame: { x: 0, y: 0, w: 32, h: 64 } },
  { id: "dresser", name: "Tủ Quần Áo", manifestKey: "obj.decor.dresser", zone: "house", w: 1, h: 3, solid: true, rotatable: false, price: 750, tier: "fancy", unlockLevel: 5, frame: { x: 0, y: 0, w: 16, h: 48 } },

  // ── W8 Festival event decor (§17/§7 — tier "event", source "festival") ────
  // KHÔNG mua được (decorFor lọc + buyDecor guard) — chỉ thưởng festival theo mùa.
  // Frame ước lượng như W3 — tinh chỉnh human gate W8.
  { id: "ev_spring_balloons", name: "Cổng Bóng Bay Lễ Hoa", manifestKey: "obj.balloons", zone: "farm", w: 2, h: 2, solid: false, rotatable: false, price: 0, tier: "event", source: "festival", unlockLevel: 1, frame: { x: 0, y: 0, w: 32, h: 32 } },
  { id: "ev_spring_cottoncandy", name: "Quầy Bông Đường", manifestKey: "obj.cottoncandy.cart", zone: "farm", w: 3, h: 2, solid: true, rotatable: false, price: 0, tier: "event", source: "festival", unlockLevel: 1, frame: { x: 0, y: 0, w: 48, h: 32 } },
  { id: "ev_summer_umbrella", name: "Ô Biển Hội", manifestKey: "obj.beach.umbrella", zone: "farm", w: 2, h: 2, solid: true, rotatable: false, price: 0, tier: "event", source: "festival", unlockLevel: 1, frame: { x: 0, y: 0, w: 32, h: 32 } },
  { id: "ev_summer_icecream", name: "Quầy Kem", manifestKey: "obj.icecream.cart", zone: "farm", w: 3, h: 2, solid: true, rotatable: false, price: 0, tier: "event", source: "festival", unlockLevel: 1, frame: { x: 0, y: 0, w: 48, h: 32 } },
  { id: "ev_fall_popcorn", name: "Quầy Bỏng Ngô", manifestKey: "obj.popcorn.cart", zone: "farm", w: 3, h: 2, solid: true, rotatable: false, price: 0, tier: "event", source: "festival", unlockLevel: 1, frame: { x: 0, y: 0, w: 48, h: 32 } },
  { id: "ev_fall_noticeboard", name: "Bảng Tin Hội Gặt", manifestKey: "obj.noticeboard", zone: "farm", w: 2, h: 2, solid: true, rotatable: false, price: 0, tier: "event", source: "festival", unlockLevel: 1, frame: { x: 0, y: 0, w: 32, h: 32 } },
  { id: "ev_winter_pine", name: "Cây Thông Tuyết", manifestKey: "obj.tree.pine", zone: "farm", w: 2, h: 3, solid: true, rotatable: false, price: 0, tier: "event", source: "festival", unlockLevel: 1, frame: { x: 0, y: 0, w: 32, h: 48 } },
  { id: "ev_winter_xmas_outdoor", name: "Thông Lễ Băng Giá", manifestKey: "obj.decor.xmas", zone: "farm", w: 2, h: 4, solid: true, rotatable: false, price: 0, tier: "event", source: "festival", unlockLevel: 1, frame: { x: 0, y: 0, w: 32, h: 64 } },
  // Trophy §17 — 4 hoạt động, đặt được 1×1, chỉ đạt ngưỡng vàng.
  { id: "trophy_contest", name: "Cúp Thi Trang Trí", manifestKey: "obj.decor.statue", zone: "farm", w: 1, h: 2, solid: true, rotatable: false, price: 0, tier: "event", source: "festival", unlockLevel: 1, frame: { x: 0, y: 0, w: 16, h: 32 } },
  { id: "trophy_derby", name: "Cúp Đua Câu Cá", manifestKey: "obj.decor.statue", zone: "farm", w: 1, h: 2, solid: true, rotatable: false, price: 0, tier: "event", source: "festival", unlockLevel: 1, frame: { x: 0, y: 0, w: 16, h: 32 } },
  { id: "trophy_cookoff", name: "Cúp Nấu Ăn", manifestKey: "obj.decor.statue", zone: "farm", w: 1, h: 2, solid: true, rotatable: false, price: 0, tier: "event", source: "festival", unlockLevel: 1, frame: { x: 0, y: 0, w: 16, h: 32 } },
  { id: "trophy_puzzle", name: "Cúp Giải Đố", manifestKey: "obj.decor.statue", zone: "farm", w: 1, h: 2, solid: true, rotatable: false, price: 0, tier: "event", source: "festival", unlockLevel: 1, frame: { x: 0, y: 0, w: 16, h: 32 } },
];

/** Shop list — KHÔNG chứa event decor (tier "event" chỉ thưởng festival §17). */
export function decorFor(zone: "farm" | "house", level: number): DecorDef[] {
  return DECOR.filter((d) => d.zone === zone && d.unlockLevel <= level && d.tier !== "event");
}

export function decorById(id: string): DecorDef | undefined {
  return DECOR.find((d) => d.id === id);
}
