/**
 * W9 tutorial-catalog — 14 bước dạy TỪNG HỆ theo thứ tự wave (W1 cày → W8 festival).
 * Fallback an toàn cho game single-locale VN.
 *
 * THIẾT KẾ:
 * - Bước check() chỉ đọc TUTORIAL_PROBE (snapshot thuần, không import store) —
 *   test đủ nhánh không cần chạy engine.
 * - Thưởng vàng tăng dần 50→400 (giữ nhịp: mỗi bước mở khóa tiếp theo là đủ,
 *   không cần grind cũ).
 * - t_first_order: bán 1 lần (vendor hoặc giao đơn) — không gate cấp.
 *
 * Quy ước id: `t_` + động từ rút gọn — TUTORIAL_ORDER là nguồn sự thật thứ tự.
 */
export interface TutorialProbe {
  plotsHoed: number;
  cropsPlanted: number;
  cropsWatered: number;
  harvested: number;
  itemsSold: number;
  fishCaught: number;
  fryStocked: number;
  dishCooked: number;
  dishEaten: number;
  decorPlaced: number;
  mountRidden: number;
  visitorsOpened: number;
  monstersDefeated: number;
  raidEscaped: number;
  festivalClaimed: number;
  level: number;
  day: number;
}

export type TutorialNpc = "alaric" | "gaston" | "jack" | "elyria";

export interface TutorialReward {
  gold: number;
  xp?: number;
  /** Item vào inventory (phải tồn tại trong ITEMS — quest item dùng prefix ket_). */
  item?: { id: string; qty: number };
  /** Các item phụ (quest item vẫn dùng prefix ket_ để không trộm §7). */
  items?: { id: string; qty: number }[];
  /** Decor tặng quyền sở hữu (ownDecor) — KHÔNG vào inventory (decor def, không phải item). */
  decorId?: string;
}

export interface TutorialStep {
  id: string;
  title: string;
  hint: string;
  npc: TutorialNpc;
  check: (s: TutorialProbe) => boolean;
  progress: (s: TutorialProbe) => [number, number];
  reward: TutorialReward;
}

const atLeast = (v: number, target: number): [number, number] => [
  Math.min(v, target),
  target,
];

export const TUTORIAL_ORDER = [
  "t_till",
  "t_plant_water",
  "t_harvest",
  "t_first_order",
  "t_sleep",
  "t_fish",
  "t_fry",
  "t_cook",
  "t_eat",
  "t_decor",
  "t_visit",
  "t_deep_forest",
  "t_mount",
  "t_raid_first",
] as const;

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "t_till",
    title: "Cuốc đất đầu tiên",
    hint: "Dùng Cày trên ô đất vàng gần nhà — Alaric chờ ở lò rèn.",
    npc: "alaric",
    check: (s) => s.plotsHoed >= 1,
    progress: (s) => atLeast(s.plotsHoed, 1),
    reward: { gold: 50, item: { id: "parsnip_seed", qty: 3 }, items: [{ id: "ket_letter_sealed", qty: 1 }] },
  },
  {
    id: "t_plant_water",
    title: "Gieo hạt & tưới nước",
    hint: "Trồng hạt Parsnip lên đất đã cuốc, rồi tưới bằng Bình nước.",
    npc: "alaric",
    check: (s) => s.cropsPlanted >= 1 && s.cropsWatered >= 1,
    progress: (s) => [
      Math.min(Math.min(s.cropsPlanted, s.cropsWatered), 1),
      1,
    ],
    reward: { gold: 60, item: { id: "fry_sunfish", qty: 1 } },
  },
  {
    id: "t_harvest",
    title: "Vụ thu hoạch đầu tiên",
    hint: "Parsnip trưởng thành sau 4 ngày — thu hoạch rồi nói chuyện với Gaston.",
    npc: "gaston",
    check: (s) => s.harvested >= 1,
    progress: (s) => atLeast(s.harvested, 1),
    reward: { gold: 70, item: { id: "parsnip_seed", qty: 3 } },
  },
  {
    id: "t_first_order",
    title: "Giao đơn hàng đầu tiên",
    hint: "Bán nông sản vào Thùng giao hàng cạnh nhà hoặc giao đơn hàng trong ngày.",
    npc: "gaston",
    check: (s) => s.itemsSold >= 1,
    progress: (s) => atLeast(s.itemsSold, 1),
    reward: { gold: 80 },
  },
  {
    id: "t_sleep",
    title: "Ngủ qua đêm đầu tiên",
    hint: "Vào nhà và ấn Ngủ trước nửa đêm để bắt đầu ngày mới.",
    npc: "gaston",
    check: (s) => s.day >= 2,
    progress: (s) => atLeast(Math.max(0, s.day - 1), 1),
    reward: { gold: 90 },
  },
  {
    id: "t_fish",
    title: "Câu con cá đầu tiên",
    hint: "Ra cầu tàu gặp Jack, ấn Câu Cá và giữ nút khi cá cắn câu.",
    npc: "jack",
    check: (s) => s.fishCaught >= 1,
    progress: (s) => atLeast(s.fishCaught, 1),
    reward: { gold: 100, item: { id: "fry_sunfish", qty: 1 } },
  },
  {
    id: "t_fry",
    title: "Nuôi cá bột trong ao",
    hint: "Thả cá bột vào ao farm — cá lớn sau 2 ngày, thu bằng Hái.",
    npc: "jack",
    check: (s) => s.fryStocked >= 1,
    progress: (s) => atLeast(s.fryStocked, 1),
    reward: { gold: 110 },
  },
  {
    id: "t_cook",
    title: "Nấu món đầu tiên",
    hint: "Vào bếp trong nhà, chọn công thức từ nguyên liệu đã thu hoạch.",
    npc: "gaston",
    check: (s) => s.dishCooked >= 1,
    progress: (s) => atLeast(s.dishCooked, 1),
    reward: { gold: 120, item: { id: "parsnip_soup", qty: 1 } },
  },
  {
    id: "t_eat",
    title: "Ăn món có buff",
    hint: "Ăn một món ăn từ túi — buff tốc độ trồng trọt hữu ích cho ngày dài.",
    npc: "gaston",
    check: (s) => s.dishEaten >= 1,
    progress: (s) => atLeast(s.dishEaten, 1),
    reward: { gold: 130, item: { id: "boiled_egg", qty: 1 } },
  },
  {
    id: "t_decor",
    title: "Trang trí farm của bạn",
    hint: "Mở Bàn Trang Trí, chọn đồ trang trí và đặt lên farm.",
    npc: "elyria",
    check: (s) => s.decorPlaced >= 1,
    progress: (s) => atLeast(s.decorPlaced, 1),
    reward: { gold: 150, decorId: "birdhouse" },
  },
  {
    id: "t_visit",
    title: "Ghé thăm farm bạn bè",
    hint: "Mở tab Khách Thăm để xem lượt thích và lời nhắn — hoặc chơi cùng bạn bè.",
    npc: "elyria",
    check: (s) => s.visitorsOpened >= 1,
    progress: (s) => atLeast(s.visitorsOpened, 1),
    reward: { gold: 170 },
  },
  {
    id: "t_deep_forest",
    title: "Vào rừng sâu",
    hint: "Mang kiếm, vào rừng sâu phía bắc và hạ một con quái vật.",
    npc: "alaric",
    check: (s) => s.monstersDefeated >= 1,
    progress: (s) => atLeast(s.monstersDefeated, 1),
    reward: { gold: 200, item: { id: "sword", qty: 1 } },
  },
  {
    id: "t_mount",
    title: "Cưỡi ngựa hoặc xe đạp",
    hint: "Mua ngựa ở chuồng (cấp 4) hoặc xe đạp (cấp 2), rồi cưỡi quanh farm.",
    npc: "alaric",
    check: (s) => s.mountRidden >= 1,
    progress: (s) => atLeast(s.mountRidden, 1),
    reward: { gold: 250 },
  },
  {
    id: "t_raid_first",
    title: "Chuyến trộm đầu tiên",
    hint: "Chuẩn bị mặt nạ, chọn mục tiêu trên bản đồ trộm — thoát thành công là thắng!",
    npc: "jack",
    check: (s) => s.raidEscaped >= 1,
    progress: (s) => atLeast(s.raidEscaped, 1),
    reward: { gold: 400, item: { id: "tool_lockpick", qty: 1 }, items: [{ id: "ket_festival_trophy", qty: 1 }] },
  },
];

export function getTutorialStep(id: string): TutorialStep | undefined {
  return TUTORIAL_STEPS.find((t) => t.id === id);
}

export function tutorialStepIndex(id: string): number {
  return TUTORIAL_ORDER.indexOf(id as (typeof TUTORIAL_ORDER)[number]);
}

export function nextTutorialStep(index: number): string | null {
  return index >= 0 && index < TUTORIAL_ORDER.length - 1
    ? TUTORIAL_ORDER[index + 1]
    : null;
}

export function tutorialCheck(id: string, s: TutorialProbe): boolean {
  return getTutorialStep(id)?.check(s) ?? false;
}

export function tutorialProgress(id: string, s: TutorialProbe): [number, number] {
  return getTutorialStep(id)?.progress(s) ?? [0, 1];
}

export function tutorialReward(id: string): TutorialReward | undefined {
  return getTutorialStep(id)?.reward;
}

/** Skip cho phép chỉ khi người chơi THẬT SỰ đã làm việc bước đó (check pass) —
 *  chơi lệch thứ tự không kẹt vĩnh viễn. currentIndex < 0 (chưa từng claim) = chưa
 *  vào chuỗi → không skip. */
export function tutorialAllowedToSkip(
  id: string,
  s: TutorialProbe,
  currentIndex: number,
): boolean {
  if (currentIndex < 0) return false;
  return getTutorialStep(id)?.check(s) ?? false;
}

/**
 * Quest items KHÔNG THỂ TRỘM (§7 — ket 0% steal, khác decor potion cũng vậy):
 * prefix `ket_` → isKetItem() true → raid-server exclude khỏi steal pool.
 * Trophy cuối chuỗi (bước 13) + lá thư mở đầu (bước 0) — 2 item biểu tượng.
 * (Test quest-item-economy khóa 2 phía: prefix + tồn tại trong catalog reward.)
 */
export const QUEST_ITEMS: string[] = [
  "ket_letter_sealed",
  "ket_festival_trophy",
];