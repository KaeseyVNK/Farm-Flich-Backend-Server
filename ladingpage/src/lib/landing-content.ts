export const EXTERNAL_LINKS = {
  play: "https://farmfilch.com/game/",
  x: "https://x.com/FarmFilch",
  discord: "https://discord.gg/GJWGFsXY",
  art: "https://maevedevs.itch.io/farm-rpg",
} as const;

export const SECTION_IDS = ["gameplay", "world", "trailer", "items"] as const;

export const NAV_ITEMS = [
  { href: "#gameplay", label: "Gameplay" },
  { href: "#world", label: "World" },
  { href: "#trailer", label: "Preview" },
  { href: "#items", label: "Items" },
] as const;

export const GAMEPLAY_PILLARS = [
  {
    id: "farm",
    number: "01",
    label: "Farm",
    title: "Grow something worth protecting.",
    description:
      "Plant, water, and harvest seasonal produce. Raise animals, collect resources, and expand your land and storage as your farm grows.",
    image: "/images/farm-filch-farming.png",
    alt: "A farmer watering varied crop beds beside a barn, animals, and a storage chest",
    tone: "day",
  },
  {
    id: "sell",
    number: "02",
    label: "Sell",
    title: "Turn your harvest into Gold.",
    description:
      "Sell harvested goods to village merchants, earn Gold, and bring home new seeds that keep your farming cycle moving.",
    image: "/images/farm-filch-village.png",
    alt: "A lively village market filled with produce stalls and neighboring farmers",
    tone: "gold",
  },
  {
    id: "filch",
    number: "03",
    label: "Filch",
    title: "Sometimes the best harvest isn’t yours.",
    description:
      "Visit neighboring farms, spot the right opportunity, answer a quick challenge, and make your move before the owner catches on.",
    image: "/images/farm-filch-adventure.png",
    alt: "A masked adventurer sneaking toward a glowing treasure chest",
    tone: "night",
  },
  {
    id: "protect",
    number: "04",
    label: "Protect",
    title: "Don’t make it easy for them.",
    description:
      "Move valuable harvests into chests and plan your defenses. Traps and new ways to outsmart Filchers are coming as the farm grows.",
    image: "/images/farm-filch-hero.png",
    alt: "A well-kept farm with fenced fields and safe storage",
    tone: "leaf",
  },
] as const;

export const WORLD_FEATURES = [
  {
    id: "farm-life",
    eyebrow: "A day on the farm",
    title: "Grow, raise & harvest",
    description:
      "Plant seeds, care for your land, and harvest what you grow. Raise livestock, collect resources, and sell your goods to villagers for Gold.",
    stats: ["50+ crops", "4 seasons", "12+ farm animals"],
    image: "/images/farm-filch-farming.png",
    alt: "A farmer tending varied crop beds near a barn, livestock, and secure storage",
  },
  {
    id: "fishing",
    eyebrow: "Fishing & treasure hunting",
    title: "Follow the water beyond the farm",
    description:
      "Cast your line in village ponds, winding rivers, and open waters. Dig for hidden finds, explore mines, and reach quiet corners of distant islands.",
    stats: ["40+ fish species", "Mines", "Hidden discoveries"],
    image: "/images/farm-filch-fishing.png",
    alt: "A young farmer fishing from a wooden dock",
  },
  {
    id: "adventure",
    eyebrow: "Combat & exploration",
    title: "Adventure starts after sunset",
    description:
      "Equip swords, bows, or magic and venture beyond the fields. Explore forests and caves, face recurring bosses, and hunt for rare gear.",
    stats: ["Swords · Bows · Magic", "Boss battles", "Rare gear"],
    image: "/images/farm-filch-adventure.png",
    alt: "An adventurer exploring a cave filled with gems",
  },
  {
    id: "village",
    eyebrow: "Village life & friends",
    title: "Your neighbors are part of the story",
    description:
      "Trade at the market, complete village orders, and visit your friends’ islands. Seasonal festivals bring the whole community together.",
    stats: ["Marketplace", "Village orders", "Seasonal festivals"],
    image: "/images/farm-filch-village.png",
    alt: "A colorful village market surrounded by trees and shops",
  },
] as const;

export const ITEM_STATS = [
  { value: "10+", label: "Plants" },
  { value: "14+", label: "Fish & pets" },
  { value: "8+", label: "Crafts" },
  { value: "73+", label: "Items" },
] as const;
