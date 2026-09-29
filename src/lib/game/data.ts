import type { Season } from "./constants";

export type ItemType = "tool" | "seed" | "crop" | "forage" | "resource" | "food";

export interface ItemDef {
  id: string;
  name: string;
  type: ItemType;
  emoji: string;
  // stack size
  stack?: number;
  // sell price (0 = cannot sell)
  sellPrice?: number;
  // if seed -> cropId it grows into
  growsInto?: string;
  // seasons this seed can be planted in
  seasons?: Season[];
  // energy restored (food)
  energy?: number;
  // tool specific
  toolKind?: "hoe" | "axe" | "pickaxe" | "water" | "scythe" | "hand" | "rod" | "sword";
  toolEnergy?: number; // energy cost per use
  description?: string;
}

// ---- CROPS ----
export interface CropDef {
  id: string;
  name: string;
  emoji: string;
  seasons: Season[];
  growthDays: number; // total days to mature (with daily watering)
  sellPrice: number;
  // Seed buy price lives in economy.json (seedBuyPrice) — single source of truth
  // for what the shop actually charges. Keeping a duplicate here caused a drift
  // where UI showed 80g but buySeed charged 40g (blueberry/corn).
  // stages: indices into growth visuals (0 seedling -> final)
  stages: number;
  // color for sprite rendering
  color: string;
  fruitColor: string;
}

export const CROPS: Record<string, CropDef> = {
  parsnip: {
    id: "parsnip",
    name: "Parsnip",
    emoji: "🌰", // audit: trước đây 🥕 trùng carrot → item identity nhầm lẫn trong hotbar/shop.
    seasons: ["Spring"],
    growthDays: 4,
    sellPrice: 35,
    stages: 5,
    color: "#7cc36b",
    fruitColor: "#e8c87a",
  },
  cauliflower: {
    id: "cauliflower",
    name: "Cauliflower",
    emoji: "🥦",
    seasons: ["Spring"],
    growthDays: 6,
    sellPrice: 175,
    stages: 5,
    color: "#6fae4a",
    fruitColor: "#f3f0e0",
  },
  potato: {
    id: "potato",
    name: "Potato",
    emoji: "🥔",
    seasons: ["Spring"],
    growthDays: 4,
    sellPrice: 80,
    stages: 5,
    color: "#6fae4a",
    fruitColor: "#b58a4a",
  },
  tomato: {
    id: "tomato",
    name: "Tomato",
    emoji: "🍅",
    seasons: ["Summer"],
    growthDays: 5,
    sellPrice: 60,
    stages: 5,
    color: "#6fae4a",
    fruitColor: "#e0473a",
  },
  blueberry: {
    id: "blueberry",
    name: "Blueberry",
    emoji: "🫐",
    seasons: ["Summer"],
    growthDays: 6,
    sellPrice: 50,
    stages: 5,
    color: "#6fae4a",
    fruitColor: "#3a5fd9",
  },
  pumpkin: {
    id: "pumpkin",
    name: "Pumpkin",
    emoji: "🎃",
    seasons: ["Fall"],
    growthDays: 7,
    sellPrice: 320,
    stages: 5,
    color: "#6fae4a",
    fruitColor: "#e08a2a",
  },
  carrot: {
    id: "carrot",
    name: "Carrot",
    emoji: "🥕",
    seasons: ["Fall"],
    growthDays: 4,
    sellPrice: 55,
    stages: 5,
    color: "#6fae4a",
    fruitColor: "#e88a2a",
  },
  corn: {
    id: "corn",
    name: "Corn",
    emoji: "🌽",
    seasons: ["Summer", "Fall"],
    growthDays: 6,
    sellPrice: 50,
    stages: 5,
    color: "#6fae4a",
    fruitColor: "#e7b94e",
  },
  cabbage: {
    id: "cabbage",
    name: "Cabbage",
    emoji: "🥬",
    seasons: ["Spring"],
    growthDays: 5,
    sellPrice: 70,
    stages: 5,
    color: "#6fae4a",
    fruitColor: "#7cc36b",
  },
  strawberry: {
    id: "strawberry",
    name: "Strawberry",
    emoji: "🍓",
    seasons: ["Spring"],
    growthDays: 6,
    sellPrice: 90,
    stages: 5,
    color: "#6fae4a",
    fruitColor: "#e0473a",
  },
  onion: {
    id: "onion",
    name: "Onion",
    emoji: "🧅",
    seasons: ["Spring"],
    growthDays: 4,
    sellPrice: 45,
    stages: 5,
    color: "#6fae4a",
    fruitColor: "#c9a86a",
  },
};

// ---- ITEMS ----
export const ITEMS: Record<string, ItemDef> = {
  // Tools
  hoe: { id: "hoe", name: "Hoe", type: "tool", emoji: "⛏️", toolKind: "hoe", toolEnergy: 2, description: "Cuốc đất trồng hạt giống." },
  watering_can: { id: "watering_can", name: "Watering Can", type: "tool", emoji: "💧", toolKind: "water", toolEnergy: 2, description: "Tưới cây để chúng lớn mỗi ngày." },
  axe: { id: "axe", name: "Axe", type: "tool", emoji: "🪓", toolKind: "axe", toolEnergy: 4, description: "Chặt cây lấy gỗ." },
  pickaxe: { id: "pickaxe", name: "Pickaxe", type: "tool", emoji: "⛏️", toolKind: "pickaxe", toolEnergy: 4, description: "Đập đá lấy đá." },
  scythe: { id: "scythe", name: "Scythe", type: "tool", emoji: "🌿", toolKind: "scythe", toolEnergy: 1, description: "Cắt cỏ và thu hoạch cây trồng." },
  hand: { id: "hand", name: "Hands", type: "tool", emoji: "✋", toolKind: "hand", toolEnergy: 0, description: "Nhặt, thu hoạch, và tương tác." },
  // Wave 1 P3 — cần câu (hybrid 2 lớp: tap cast/bite + reel hold/release).
  fishing_rod: { id: "fishing_rod", name: "Fishing Rod", type: "tool", emoji: "🎣", toolKind: "rod", toolEnergy: 2, description: "Câu cá ở ao, hồ và biển. Đứng cạnh nước rồi nhấn tương tác." },
  sword: { id: "sword", name: "Kiếm Gỗ Tập", type: "tool", emoji: "🗡️", toolKind: "sword", toolEnergy: 1, description: "Đánh quái rừng sâu — vung theo hướng đang nhìn." },

  // Seeds
  parsnip_seed: { id: "parsnip_seed", name: "Parsnip Seeds", type: "seed", emoji: "🌱", growsInto: "parsnip", seasons: ["Spring"], sellPrice: 10, stack: 99, description: "Trồng vào mùa xuân. Thu hoạch sau 4 ngày." },
  cauliflower_seed: { id: "cauliflower_seed", name: "Cauliflower Seeds", type: "seed", emoji: "🌱", growsInto: "cauliflower", seasons: ["Spring"], sellPrice: 40, stack: 99, description: "Trồng vào mùa xuân. Thu hoạch sau 6 ngày." },
  potato_seed: { id: "potato_seed", name: "Potato Seeds", type: "seed", emoji: "🌱", growsInto: "potato", seasons: ["Spring"], sellPrice: 25, stack: 99, description: "Trồng vào mùa xuân. Thu hoạch sau 4 ngày." },
  tomato_seed: { id: "tomato_seed", name: "Tomato Seeds", type: "seed", emoji: "🌱", growsInto: "tomato", seasons: ["Summer"], sellPrice: 25, stack: 99, description: "Trồng vào mùa hè. Thu hoạch sau 5 ngày." },
  blueberry_seed: { id: "blueberry_seed", name: "Blueberry Seeds", type: "seed", emoji: "🌱", growsInto: "blueberry", seasons: ["Summer"], sellPrice: 20, stack: 99, description: "Trồng vào mùa hè. Thu hoạch sau 6 ngày." },
  pumpkin_seed: { id: "pumpkin_seed", name: "Pumpkin Seeds", type: "seed", emoji: "🌱", growsInto: "pumpkin", seasons: ["Fall"], sellPrice: 50, stack: 99, description: "Trồng vào mùa thu. Thu hoạch sau 7 ngày." },
  carrot_seed: { id: "carrot_seed", name: "Carrot Seeds", type: "seed", emoji: "🌱", growsInto: "carrot", seasons: ["Fall"], sellPrice: 15, stack: 99, description: "Trồng vào mùa thu. Thu hoạch sau 4 ngày." },
  corn_seed: { id: "corn_seed", name: "Corn Seeds", type: "seed", emoji: "🌱", growsInto: "corn", seasons: ["Summer", "Fall"], sellPrice: 20, stack: 99, description: "Trồng vào mùa hè hoặc thu. Thu hoạch sau 6 ngày." },
  cabbage_seed: { id: "cabbage_seed", name: "Cabbage Seeds", type: "seed", emoji: "🌱", growsInto: "cabbage", seasons: ["Spring"], sellPrice: 20, stack: 99, description: "Trồng vào mùa xuân. Thu hoạch sau 5 ngày." },
  strawberry_seed: { id: "strawberry_seed", name: "Strawberry Seeds", type: "seed", emoji: "🌱", growsInto: "strawberry", seasons: ["Spring"], sellPrice: 30, stack: 99, description: "Trồng vào mùa xuân. Thu hoạch sau 6 ngày." },
  onion_seed: { id: "onion_seed", name: "Onion Seeds", type: "seed", emoji: "🌱", growsInto: "onion", seasons: ["Spring"], sellPrice: 15, stack: 99, description: "Trồng vào mùa xuân. Thu hoạch sau 4 ngày." },

  // Crops (harvested)
  // audit: emoji phải khớp CROPS.parsnip (🌰) — 🥕 trùng carrot → item identity
  // nhầm lẫn trong hotbar/inventory/toast khi thu hoạch.
  parsnip: { id: "parsnip", name: "Parsnip", type: "crop", emoji: "🌰", sellPrice: 35, stack: 99, energy: 25 },
  cauliflower: { id: "cauliflower", name: "Cauliflower", type: "crop", emoji: "🥦", sellPrice: 175, stack: 99, energy: 40 },
  potato: { id: "potato", name: "Potato", type: "crop", emoji: "🥔", sellPrice: 80, stack: 99, energy: 30 },
  tomato: { id: "tomato", name: "Tomato", type: "crop", emoji: "🍅", sellPrice: 60, stack: 99, energy: 35 },
  blueberry: { id: "blueberry", name: "Blueberry", type: "crop", emoji: "🫐", sellPrice: 50, stack: 99, energy: 20 },
  pumpkin: { id: "pumpkin", name: "Pumpkin", type: "crop", emoji: "🎃", sellPrice: 320, stack: 99, energy: 50 },
  carrot: { id: "carrot", name: "Carrot", type: "crop", emoji: "🥕", sellPrice: 55, stack: 99, energy: 28 },
  corn: { id: "corn", name: "Corn", type: "crop", emoji: "🌽", sellPrice: 50, stack: 99, energy: 22 },
  cabbage: { id: "cabbage", name: "Cabbage", type: "crop", emoji: "🥬", sellPrice: 70, stack: 99, energy: 30 },
  strawberry: { id: "strawberry", name: "Strawberry", type: "crop", emoji: "🍓", sellPrice: 90, stack: 99, energy: 25 },
  onion: { id: "onion", name: "Onion", type: "crop", emoji: "🧅", sellPrice: 45, stack: 99, energy: 20 },
  wheat: { id: "wheat", name: "Wheat", type: "resource", emoji: "🌾", sellPrice: 8, stack: 99, description: "Thức ăn cho gà, bò, vịt." },
  egg: { id: "egg", name: "Egg", type: "crop", emoji: "🥚", sellPrice: 50, stack: 99, energy: 20, description: "Trứng gà hoặc vịt, lấy vào sáng hôm sau khi cho ăn." },
  milk: { id: "milk", name: "Milk", type: "crop", emoji: "🥛", sellPrice: 80, stack: 99, energy: 35, description: "Sữa bò, lấy vào sáng hôm sau khi cho ăn." },
  copper_ore: { id: "copper_ore", name: "Copper Ore", type: "resource", emoji: "🟠", sellPrice: 15, stack: 99, description: "Quặng từ hang cũ. Alaric cần để sửa bơm giếng." },

  // Wave 1 P1 — cá (type food: vào silo + bán được; giá/energy single source fish-catalog.ts;
  // emoji unique từng con — quy tắc item identity, GameIcon thật nằm icon-manifest).
  sunfish: { id: "sunfish", name: "Cá Mặt Trời", type: "food", emoji: "🐠", sellPrice: 25, stack: 99, energy: 12 },
  perch: { id: "perch", name: "Cá Rô", type: "food", emoji: "🐟", sellPrice: 30, stack: 99, energy: 12 },
  carp: { id: "carp", name: "Cá Chép", type: "food", emoji: "🐋", sellPrice: 60, stack: 99, energy: 20 },
  chub: { id: "chub", name: "Cá Chub", type: "food", emoji: "🐬", sellPrice: 65, stack: 99, energy: 20 },
  bass: { id: "bass", name: "Cá Vược", type: "food", emoji: "🦈", sellPrice: 35, stack: 99, energy: 14 },
  pike: { id: "pike", name: "Cá Pike", type: "food", emoji: "🦑", sellPrice: 85, stack: 99, energy: 22 },
  tiger_trout: { id: "tiger_trout", name: "Cá Hồi Vằn", type: "food", emoji: "🐡", sellPrice: 160, stack: 99, energy: 30 },
  sturgeon: { id: "sturgeon", name: "Cá Tầm", type: "food", emoji: "🐊", sellPrice: 180, stack: 99, energy: 30 },
  anchovy: { id: "anchovy", name: "Cá Cơm", type: "food", emoji: "🦐", sellPrice: 25, stack: 99, energy: 10 },
  sardine: { id: "sardine", name: "Cá Mòi", type: "food", emoji: "🦀", sellPrice: 40, stack: 99, energy: 14 },
  red_snapper: { id: "red_snapper", name: "Cá Hồng", type: "food", emoji: "🦞", sellPrice: 90, stack: 99, energy: 24 },
  tuna: { id: "tuna", name: "Cá Ngừ", type: "food", emoji: "🐙", sellPrice: 220, stack: 99, energy: 32 },

  // Wave 1 P5 — cá bột nuôi ao (resource — không bán lại, thả vào ao farm).
  fry_sunfish: { id: "fry_sunfish", name: "Cá Bột Mặt Trời", type: "resource", emoji: "🪼", stack: 99, description: "Thả vào ao farm — lớn sau 2 ngày." },
  fry_perch: { id: "fry_perch", name: "Cá Bột Rô", type: "resource", emoji: "🐌", stack: 99, description: "Thả vào ao farm — lớn sau 2 ngày." },
  fry_carp: { id: "fry_carp", name: "Cá Bột Chép", type: "resource", emoji: "🦪", stack: 99, description: "Thả vào ao farm — lớn sau 3 ngày." },
  // ── W5: nguyên liệu rừng sâu (loot quái — feed recipe nấu ăn §7) ──────────
  slime_jelly: { id: "slime_jelly", name: "Thạch Slime", type: "resource", emoji: "🟢", stack: 99, sellPrice: 18, description: "Thạch dẻo từ slime — nguyên liệu bếp." },
  glow_mushroom: { id: "glow_mushroom", name: "Nấm Phát Sáng", type: "resource", emoji: "🍄", stack: 99, sellPrice: 26, description: "Nấm rừng phát sáng dịu." },
  forest_herb: { id: "forest_herb", name: "Cỏ Thần Nông", type: "resource", emoji: "🌿", stack: 99, sellPrice: 34, description: "Thảo mộc hiếm chỉ mọc ở rừng sâu." },
  sprout_leaf: { id: "sprout_leaf", name: "Lá Mầm Vàng", type: "resource", emoji: "🍃", stack: 99, sellPrice: 14, description: "Lá non lấp lánh từ slime mầm cây." },

  // Wave 2 P1 — món nấu (kitchen station, single source giá/energy: recipe-catalog đồng bộ;
  // emoji unique từng món — quy tắc item identity, GameIcon thật nằm icon.food.*).
  parsnip_soup: { id: "parsnip_soup", name: "Canh Củ Từ", type: "food", emoji: "🍲", sellPrice: 110, stack: 99, energy: 60, description: "Món khai vị ấm bụng từ củ từ." },
  boiled_egg: { id: "boiled_egg", name: "Trứng Luộc", type: "food", emoji: "🧆", sellPrice: 80, stack: 99, energy: 45, description: "Đơn giản mà chắc bụng." },
  baked_fish: { id: "baked_fish", name: "Cá Nướng", type: "food", emoji: "🍤", sellPrice: 55, stack: 99, energy: 75, description: "Cá mặt trời nướng vàng ruộm." },
  pancakes: { id: "pancakes", name: "Bánh Pancake", type: "food", emoji: "🥞", sellPrice: 110, stack: 99, energy: 85, description: "Ăn vào nhẹ nhõm chân tay — tăng tốc độ." },
  veggie_mix: { id: "veggie_mix", name: "Rau Củ Trộn", type: "food", emoji: "🥣", sellPrice: 260, stack: 99, energy: 70, description: "Đậm đà vườn nhà — tăng tốc độ." },
  fruit_salad: { id: "fruit_salad", name: "Salad Trái Cây", type: "food", emoji: "🍇", sellPrice: 290, stack: 99, energy: 65, description: "Ngọt mát — tăng kinh tế thu được." },
  // ── W5: món từ nguyên liệu rừng sâu ──────────────────────────────────────
  jelly_salad: { id: "jelly_salad", name: "Salad Thạch", type: "food", emoji: "🍮", sellPrice: 120, stack: 99, energy: 80, description: "Giòn mát từ thạch slime." },
  mushroom_risotto: { id: "mushroom_risotto", name: "Cơm Nấm Kem", type: "food", emoji: "🍚", sellPrice: 260, stack: 99, energy: 120, description: "Béo bùi nấm phát sáng." },
  forest_herb_tea: { id: "forest_herb_tea", name: "Trà Thảo Mộc", type: "food", emoji: "🍵", sellPrice: 150, stack: 99, energy: 50, description: "Thanh nhiệt — uống xong học nhanh." },
  sprout_wrap: { id: "sprout_wrap", name: "Bánh Lá Mầm", type: "food", emoji: "🌯", sellPrice: 180, stack: 99, energy: 100, description: "Cuộn rau củ trong lá mầm vàng." },
  omelet: { id: "omelet", name: "Trứng Chiên", type: "food", emoji: "🍳", sellPrice: 290, stack: 99, energy: 90, description: "Phồng vàng hai mặt." },
  fish_stew: { id: "fish_stew", name: "Cá Hầm Khoai Tây", type: "food", emoji: "🍜", sellPrice: 180, stack: 99, energy: 95, description: "Nồi hầm chiều đông." },
  sashimi: { id: "sashimi", name: "Sashimi Cá Ngừ", type: "food", emoji: "🍣", sellPrice: 340, stack: 99, energy: 110, description: "Dao pháp của đầu bếp Gaston." },
  pumpkin_soup: { id: "pumpkin_soup", name: "Súp Bí Đỏ", type: "food", emoji: "🫕", sellPrice: 620, stack: 99, energy: 120, description: "Đặc sản mùa thu." },
  fish_tacos: { id: "fish_tacos", name: "Taco Cá Mòi", type: "food", emoji: "🌮", sellPrice: 150, stack: 99, energy: 130, description: "Hương vị bãi biển — tăng kinh tế." },
  stuffed_peppers: { id: "stuffed_peppers", name: "Ớt Nhồi", type: "food", emoji: "🌶️", sellPrice: 260, stack: 99, energy: 140, description: "Cay nồng ấm cổ." },
  casserole: { id: "casserole", name: "Món Hầm Rau Củ", type: "food", emoji: "🥘", sellPrice: 450, stack: 99, energy: 150, description: "Cả nồi cho cả ngày — tăng tốc độ." },
  complete_breakfast: { id: "complete_breakfast", name: "Bữa Sáng Đầy Đủ", type: "food", emoji: "🍽️", sellPrice: 420, stack: 99, energy: 180, description: "Bữa của vua — tăng kinh tế cả ngày." },

  // Resources
  // W7d-P2 — tools chợ đen Jack (§14): mỗi tool 1 lần/raid, gate thief rep ≥ 50.
  // W9P3: quest items không thể trộm (§7 — prefix ket_ → isKetItem() true trên
  // raid-server exclude khỏi steal pool). Không có sellPrice → không bán được.
  ket_letter_sealed: { id: "ket_letter_sealed", name: "Lá Thư Niêm Phong", type: "resource", emoji: "📜", stack: 1, description: "Thư mời tham gia hội — vật kỷ niệm khởi đầu. KHÔNG bán, KHÔNG bị trộm." },
  ket_festival_trophy: { id: "ket_festival_trophy", name: "Cúp Hội Làng", type: "resource", emoji: "🏆", stack: 1, description: "Cúp hoàn thành hành trình tutorial — thành tựu đầu tiên. KHÔNG bán, KHÔNG bị trộm." },
  tool_lockpick: { id: "tool_lockpick", name: "Lockpick", type: "tool", emoji: "🔓", sellPrice: 50, stack: 5, description: "Mở khóa nhanh: +2s deadline puzzle (1 lần/raid)." },
  tool_smoke: { id: "tool_smoke", name: "Smoke Bomb", type: "tool", emoji: "💨", sellPrice: 60, stack: 5, description: "Khói cay: mọi chó đứng hình 3s (1 lần/raid)." },
  tool_toy: { id: "tool_toy", name: "Dog Toy", type: "tool", emoji: "🦴", sellPrice: 70, stack: 5, description: "Đồ chơi giữ chó mải chơi 10s (qua mồi dụ)." },
  wood: { id: "wood", name: "Wood", type: "resource", emoji: "🪵", sellPrice: 5, stack: 999, description: "Chặt từ cây. Dùng để chế tạo." },
  stone: { id: "stone", name: "Stone", type: "resource", emoji: "🪨", sellPrice: 5, stack: 999, description: "Đập từ đá. Dùng để chế tạo." },
  fiber: { id: "fiber", name: "Fiber", type: "resource", emoji: "🌾", sellPrice: 3, stack: 999, description: "Cắt từ cỏ bằng lưỡi hái." },
  sap: { id: "sap", name: "Sap", type: "resource", emoji: "🟤", sellPrice: 2, stack: 999, description: "Nhựa cây dính từ thân cây." },

  // Forage
  dandelion: { id: "dandelion", name: "Dandelion", type: "forage", emoji: "🌼", sellPrice: 30, stack: 99, energy: 15 },
  leek: { id: "leek", name: "Leek", type: "forage", emoji: "🪴", sellPrice: 60, stack: 99, energy: 20 },
  mushroom: { id: "mushroom", name: "Mushroom", type: "forage", emoji: "🍄", sellPrice: 40, stack: 99, energy: 25 },

  // Food / cooked
  bread: { id: "bread", name: "Bread", type: "food", emoji: "🍞", sellPrice: 60, stack: 99, energy: 80, description: "Hồi nhiều năng lượng." },
  salad: { id: "salad", name: "Salad", type: "food", emoji: "🥗", sellPrice: 110, stack: 99, energy: 120, description: "Một bữa ăn lành mạnh." },
  fence_item: { id: "fence_item", name: "Wood Fence", type: "resource", emoji: "🚧", sellPrice: 5, stack: 999, description: "Đặt hàng rào để tổ chức nông trại." },
  sprinkler: { id: "sprinkler", name: "Sprinkler", type: "resource", emoji: "🚿", sellPrice: 50, stack: 99, description: "Tự tưới ô đất kế bên mỗi sáng." },
  shipping_box: { id: "shipping_box", name: "Shipping Box", type: "resource", emoji: "📦", sellPrice: 15, stack: 99, description: "Bỏ đồ vào; chúng bán qua đêm ở 60% giá trị." },
};

// ---- CRAFTING RECIPES ----
export interface Recipe {
  id: string;
  result: string; // item id
  resultQty: number;
  ingredients: { item: string; qty: number }[];
  unlocked: boolean;
}

export const RECIPES: Recipe[] = [
  { id: "r_fence", result: "fence_item", resultQty: 1, ingredients: [{ item: "wood", qty: 2 }], unlocked: true },
  { id: "r_bread", result: "bread", resultQty: 1, ingredients: [{ item: "fiber", qty: 4 }, { item: "wood", qty: 1 }], unlocked: true },
  { id: "r_sprinkler", result: "sprinkler", resultQty: 1, ingredients: [{ item: "stone", qty: 5 }, { item: "fiber", qty: 2 }], unlocked: true },
  { id: "r_salad", result: "salad", resultQty: 1, ingredients: [{ item: "dandelion", qty: 1 }, { item: "leek", qty: 1 }, { item: "mushroom", qty: 1 }], unlocked: true },
  { id: "r_shipping_box", result: "shipping_box", resultQty: 1, ingredients: [{ item: "wood", qty: 10 }], unlocked: true },
];

// ---- NPCS ----
// Schedule: array of { hour, x, y } — NPC walks to that tile when the hour arrives.
// Friendship: 0..2500 points, 250 = 1 heart, max 10 hearts.
export interface NpcSchedulePoint {
  hour: number; // 0-26 (in-game hour, 26 = 2AM next day)
  x: number;
  y: number;
  label: string;
}
export interface NpcDef {
  id: string;
  name: string;
  emoji: string;
  color: string;
  role: string;
  home: { x: number; y: number }; // tile coords
  schedule: string;
  schedulePoints: NpcSchedulePoint[];
  loves: string[]; // loved gifts
  likes: string[];
  hates: string[]; // hated gifts (negative friendship)
  dialogue: string[];
  /** Branch choices (phase 7; story wire RETIRED W9P3). DialogueModal vẫn render
   *  choices làm flavor — chọn chỉ notify, không còn flag/ending (storyStore đã xóa).
   *  Optional — NPC không choices giữ hành vi cũ (talk random line).
   *  `text` = nhãn hiển thị (game single-locale VN); `setFlag` = key choice (giữ lại
   *  cho UI state local). */
  dialogueChoices?: { text: string; setFlag: string }[];
}

export const NPCS: Record<string, NpcDef> = {
  alaric: {
    id: "alaric",
    name: "Alaric",
    emoji: "🔨",
    color: "#5a4a36",
    role: "Thợ rèn",
    home: { x: 10, y: 15 },
    schedule: "Ở lò rèn làng cả ngày.",
    schedulePoints: [
      { hour: 6, x: 10, y: 15, label: "Forge" },
      { hour: 12, x: 10, y: 15, label: "Forge" },
      { hour: 20, x: 10, y: 15, label: "Forge" },
    ],
    loves: ["copper_ore", "stone"],
    likes: ["parsnip", "wood"],
    hates: ["fiber", "sap"],
    dialogue: [
      "Giếng Tidecrest cạn vì slime chiếm mỏ đá cũ. Mang quặng về, ta sửa bơm.",
      "Lò vẫn nóng. Đập đá trong hang, đừng để slime nuốt búa.",
      "Sửa xong giếng thì ao và giếng đều đầy nước tưới.",
      "Lễ Hội Thủy Triều ngày 7 — làng cần ngươi sống sót đến đó.",
    ],
  },
  gaston: {
    id: "gaston",
    name: "Gaston",
    emoji: "👨‍🍳",
    color: "#a65143",
    role: "Đầu bếp",
    home: { x: 33, y: 15 },
    schedule: "Ở bếp làng, chuẩn bị giỏ lễ hội.",
    schedulePoints: [
      { hour: 6, x: 33, y: 15, label: "Kitchen" },
      { hour: 12, x: 33, y: 15, label: "Kitchen" },
      { hour: 20, x: 33, y: 15, label: "Kitchen" },
    ],
    loves: ["egg", "milk", "parsnip"],
    likes: ["cabbage", "strawberry", "onion"],
    hates: ["sap", "stone"],
    dialogue: [
      "Ngày 7 là Lễ Hội Thủy Triều. Ta cần rau, trứng và sữa.",
      "Củ cải trắng từ nông trại ven biển ngọt hơn phố.",
      "Cho gà ăn lúa mì, sáng mai sẽ có trứng.",
      "Cửa hàng hạt mùa xuân mở cạnh bếp — mua rồi trồng ngay.",
    ],
  },
  elyria: {
    id: "elyria",
    name: "Elyria",
    emoji: "🧜‍♀️",
    color: "#3a7ec9",
    role: "Tiên cá",
    home: { x: 20, y: 1 },
    schedule: "Ngồi trên đá đầu cầu tàu, chờ thủy triều dâng.",
    schedulePoints: [
      { hour: 6, x: 20, y: 1, label: "Pier end" },
      { hour: 12, x: 20, y: 1, label: "Pier end" },
      { hour: 20, x: 20, y: 1, label: "Pier end" },
    ],
    loves: ["strawberry", "blueberry"],
    likes: ["milk", "egg"],
    hates: ["fiber"],
    dialogue: [
      "Giếng chảy, triều dâng — ta nghe được tiếng ruộng của ngươi.",
      "Lễ hội này không phải mặt nạ. Chỉ sóng, muối, và bàn tay đất.",
      "Cảm ơn vì đã trả nước cho bờ.",
      "Hẹn gặp lại khi thủy triều cao.",
    ],
  },
  jack: {
    id: "jack",
    name: "Jack",
    emoji: "🏴‍☠️",
    color: "#8b3a2e",
    role: "Cướp biển nghỉ hưu",
    home: { x: 32, y: 13 },
    schedule: "Cả ngày ngồi cảng cá, nhìn sóng và ngắm mồi chai.",
    schedulePoints: [
      { hour: 6, x: 32, y: 13, label: "Wharf" },
      { hour: 12, x: 32, y: 13, label: "Wharf" },
      { hour: 20, x: 32, y: 13, label: "Wharf" },
    ],
    loves: ["corn", "bread"],
    likes: ["parsnip", "egg"],
    hates: ["sap", "fiber"],
    dialogue: [
      "Yo-ho! Jack từng đuổi theo ba tàu thương gia, giờ chỉ đuổi chim biển trên cầu tàu này.",
      "Cảng cá xưa đông lắm — tới Lễ Hội Thủy Triều, cá tươi chất cao như núi thùng kia.",
      "Elyria ở đầu cầu ư? Đừng nghe tiên cá dụ Jack về bờ — biển mới là nhà.",
      "Mang cho ta bắp hay bánh mì nhé, bụng cướp biển nào cũng mê đồ no.",
    ],
  },
};

export const SHOP_SEEDS = [
  "parsnip_seed",
  "cauliflower_seed",
  "potato_seed",
  "cabbage_seed",
  "strawberry_seed",
  "onion_seed",
];

export const SHOP_GOODS = ["wheat", "sword"];

export const SHOP_TOOLS_FOR_SALE: string[] = []; // tools start owned

export function getCrop(id: string): CropDef | undefined {
  return CROPS[id];
}

export function getItem(id: string): ItemDef | undefined {
  return ITEMS[id];
}

