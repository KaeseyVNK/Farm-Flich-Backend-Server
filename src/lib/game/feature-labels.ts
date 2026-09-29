// Feature labels — accessible names + mobile short labels + hints for the feature registry.
// Data only (no React). `label` is the accessible name (aria-label / desktop tooltip title);
// `short` is the mobile nav caption; `hint` is the tooltip description. Preserved verbatim
// from the pre-migration FeatureBar/MobileTabBar so existing a11y/E2E assertions (e.g. the
// raid button "Đi trộm") keep passing. The registry's labelKey remains the canonical i18n
// key for a future localization pass.
import type { FeatureId } from "./feature-registry";

export interface FeatureLabel {
  /** Accessible name (aria-label) + desktop tooltip title. */
  label: string;
  /** Short mobile navigation caption. */
  short: string;
  /** Tooltip description. */
  hint: string;
}

export const FEATURE_LABELS: Record<FeatureId, FeatureLabel> = {
  raid: { label: "Đi trộm", short: "Raid", hint: "Đột nhập farm khác" },
  inventory: { label: "Inventory & Tools", short: "Bag", hint: "Túi đồ, công cụ & bán hàng" },
  seeds: { label: "Farming & Seeds", short: "Plant", hint: "Mua hạt, xem mùa vụ" },
  crafting: { label: "Crafting", short: "Craft", hint: "Chế tạo từ nguyên liệu" },
  decor: { label: "Trang trí", short: "Decor", hint: "Mua & sắp đặt đồ trang trí" },
  map: { label: "Valley Map", short: "Map", hint: "Năm vùng Tidecrest — đi bộ, không dịch chuyển" },
  relationships: { label: "Relationships", short: "NPCs", hint: "Kết thân với dân làng" },
  visitors: { label: "Khách thăm", short: "Guests", hint: "Like, sticker & lời nhắn từ bạn bè" },
  calendar: { label: "Calendar & Quests", short: "Quests", hint: "Ngày, lễ hội & nhiệm vụ" },
  skills: { label: "Skill Trees", short: "Skills", hint: "Dùng điểm kỹ năng, mở đặc quyền" },
  shop: { label: "Cửa hàng", short: "Shop", hint: "Mua hạt & bán nông sản" },
  help: { label: "Help & Controls", short: "Help", hint: "Điều khiển & mẹo hay" },
  blackmarket: { label: "Chợ đen — Jack", short: "Chợ đen", hint: "Mặt nạ tier 2 + dụng cụ trộm (thief rep ≥ 50)" },
  bounty: { label: "Bảng truy nã", short: "Truy nã", hint: "Top trộm tuần + treo thưởng (§14)" },
  festival: { label: "Lễ Hội", short: "Lễ hội", hint: "Hoạt động lễ hội ngày 13/24 mỗi mùa (§14)" },
  settings: { label: "Settings & Save", short: "Settings", hint: "Lưu, tải, đặt lại" },
};
