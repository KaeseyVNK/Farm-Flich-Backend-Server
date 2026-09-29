// Asset manifest — Farm RPG Tiny Pack (EmanuelleDev) curated subset.
// Source of truth cho asset keys. Curated Maeve pack entries copy → public/assets/farm-rpg/.
// License: commercial OK, modify OK, NO resell/redistribute. Credit "EmanuelleDev" (emanuelledev.itch.io).
// Raw pack gitignored; curated subset committed via scripts/copy-assets.mjs.

import type { AssetEntry, AssetKind, AssetProvenance } from "./asset-types";

// Curated subset. Key = stable programmatic id; src = path inside raw pack; dest = path under public/assets/farm-rpg/.
//
// License/credit (applies to every curated entry below):
//   Farm RPG Tiny Asset Pack by EmanuelleDev (emanuelledev.itch.io).
//   Terms: commercial use OK, modification OK, NO resell/redistribution of the raw pack.
//   Raw pack is gitignored/local-only; only this curated subset ships under /assets/farm-rpg.
const CURATED_PROVENANCE: AssetProvenance = {
  pack: "Farm RPG Tiny Asset Pack (EmanuelleDev)",
  license: "Commercial-OK / modify-OK / no-resale (pack terms)",
  credit: "EmanuelleDev (emanuelledev.itch.io)",
};

/** Infer semantic family from the stable key namespace. Keep in sync with key prefixes. */
function inferKind(key: string): AssetKind {
  if (key.startsWith("tile.")) return "tile";
  if (key.startsWith("crop.")) return "crop";
  if (key.startsWith("char.")) return "character";
  if (key.startsWith("animal.")) return "animal";
  if (key.startsWith("enemy.")) return "enemy";
  if (key.startsWith("ui.")) return "ui";
  if (key.startsWith("obj.")) return "object";
  if (key.startsWith("tree.")) return "object";
  if (key.startsWith("int.")) return "object";
  if (key.startsWith("icon.")) return "item";
  return "item";
}

// Raw curated entries (key/src/dest only). Stamped into the public ASSET_MANIFEST below.
const RAW_MANIFEST: readonly AssetEntry[] = [
  { key: "tile.grass.spring", src: "Tileset/Tileset Grass Spring.png", dest: "tiles/grass-spring.png" },
  { key: "tile.grass.summer", src: "Tileset/Tileset Grass Summer.png", dest: "tiles/grass-summer.png" },
  { key: "tile.grass.fall", src: "Tileset/Tileset Grass Fall.png", dest: "tiles/grass-fall.png" },
  { key: "tile.grass.winter", src: "Tileset/Tileset Grass Winter.png", dest: "tiles/grass-winter.png" },
  { key: "tile.water.spring", src: "Tileset/Tileset Grass Water Spring.png", dest: "tiles/water-spring.png" },
  { key: "tile.water.summer", src: "Tileset/Tileset Grass Water Summer.png", dest: "tiles/water-summer.png" },
  { key: "tile.water.fall", src: "Tileset/Tileset Grass Water Fall.png", dest: "tiles/water-fall.png" },
  { key: "tile.water.winter", src: "Tileset/Tileset Grass Water Winter.png", dest: "tiles/water-winter.png" },
  { key: "tile.water.base", src: "Tileset/Water tile.png", dest: "tiles/water-base.png" },
  { key: "tile.water.anim", src: "Tileset/Water Ground animations tiles.png", dest: "tiles/water-anim.png" },
  { key: "tile.path", src: "Tileset/Path tiles.png", dest: "tiles/path.png" },
  { key: "tile.tilled", src: "Tileset/Tilled Soil and wet soil.png", dest: "tiles/tilled.png" },
  { key: "tile.cliff.spring", src: "Tileset/Tileset Grass Cliff Tileset Spring.png", dest: "tiles/cliff-spring.png" },
  { key: "tile.cliff.summer", src: "Tileset/Tileset Grass Cliff Tileset Summer.png", dest: "tiles/cliff-summer.png" },
  { key: "tile.cliff.fall", src: "Tileset/Tileset Grass Cliff Tileset Fall.png", dest: "tiles/cliff-fall.png" },
  { key: "tile.cliff.winter", src: "Tileset/Tileset Grass Cliff Tileset Winter.png", dest: "tiles/cliff-winter.png" },
  { key: "tile.house", src: "Tileset/Tileset House.png", dest: "tiles/house.png" },
  { key: "tile.barn", src: "Tileset/Barn tileset.png", dest: "tiles/barn.png" },
  { key: "tile.shadow", src: "Tileset/Shadow.png", dest: "tiles/shadow.png" },
  { key: "tile.caves", src: "Tileset/Caves.png", dest: "tiles/caves.png" },
  { key: "tile.beach", src: "Tileset/Beach animations tiles.png", dest: "tiles/beach.png" },

  // --- Crops ---
  { key: "crop.atlas", src: "Crops/All Crops.png", dest: "crops/all-crops.png" },
  { key: "crop.parsnip", src: "Crops/Spring/Parsnip.png", dest: "crops/parsnip.png" },
  { key: "crop.cauliflower", src: "Crops/Spring/Cauliflower.png", dest: "crops/cauliflower.png" },
  { key: "crop.potato", src: "Crops/Spring/Potato.png", dest: "crops/potato.png" },
  { key: "crop.carrot", src: "Crops/Spring/Carrot.png", dest: "crops/carrot.png" },
  { key: "crop.blueberry", src: "Crops/Spring/Blueberry.png", dest: "crops/blueberry.png" },
  { key: "crop.tomato", src: "Crops/Summer/Tomato.png", dest: "crops/tomato.png" },
  { key: "crop.pumpkin", src: "Crops/Fall/Pumpkin.png", dest: "crops/pumpkin.png" },
  { key: "crop.corn", src: "Crops/Fall/Corn.png", dest: "crops/corn.png" },
  { key: "crop.cabbage", src: "Crops/Spring/Cabbage.png", dest: "crops/cabbage.png" },
  { key: "crop.strawberry", src: "Crops/Spring/Strawberry.png", dest: "crops/strawberry.png" },
  { key: "crop.onion", src: "Crops/Spring/Onion.png", dest: "crops/onion.png" },
  { key: "crop.wheat", src: "Crops/Summer/Wheat.png", dest: "crops/wheat.png" },

  { key: "char.alex.idle", src: "Character/Character/Pre-made/Alex/Idle.png", dest: "characters/alex-idle.png" },
  { key: "char.alex.walk", src: "Character/Character/Pre-made/Alex/Walk.png", dest: "characters/alex-walk.png" },
  { key: "char.alex.run", src: "Character/Character/Pre-made/Alex/Run.png", dest: "characters/alex-run.png" },
  { key: "char.alex.hoe", src: "Character/Character/Pre-made/Alex/Hoe.png", dest: "characters/alex-hoe.png" },
  { key: "char.alex.water", src: "Character/Character/Pre-made/Alex/Watering.png", dest: "characters/alex-water.png" },
  { key: "char.alex.axe", src: "Character/Character/Pre-made/Alex/Axe.png", dest: "characters/alex-axe.png" },
  { key: "char.alex.pickaxe", src: "Character/Character/Pre-made/Alex/Pickaxe.png", dest: "characters/alex-pickaxe.png" },
  { key: "char.alex.sword", src: "Character/Character/Pre-made/Alex/Sword.png", dest: "characters/alex-sword.png" },
  { key: "char.alex.horse.idle", src: "Character/Character/Pre-made/Alex/Horse/Horse idle.png", dest: "characters/alex-horse-idle.png" },
  { key: "char.alex.horse.run", src: "Character/Character/Pre-made/Alex/Horse/Horse run.png", dest: "characters/alex-horse-run.png" },
  { key: "char.alex.bicycle.run", src: "Character/Character/Pre-made/Alex/Bicycle/Run Bicycle.png", dest: "characters/alex-bicycle-run.png" },
  { key: "obj.stable", src: "Objects/Exterior/Houses/Farm Buildings/Stable/Stable.png", dest: "objects/stable.png" },
  { key: "char.josh.idle", src: "Character/Character/Pre-made/Josh/Idle.png", dest: "characters/josh-idle.png" },
  { key: "char.lyria.idle", src: "Character/Character/Pre-made/Lyria/Idle.png", dest: "characters/lyria-idle.png" },
  { key: "char.tori.idle", src: "Character/Character/Pre-made/Tori/Idle.png", dest: "characters/tori-idle.png" },
  { key: "char.alaric.idle", src: "Character/NPC'S/Blacksmith/Premade/Alaric/Blacksmith Idle.png", dest: "characters/alaric-idle.png" },
  { key: "char.gaston.idle", src: "Character/NPC'S/Chef/Premade/Gaston/Chef Sprites Idle.png", dest: "characters/gaston-idle.png" },
  { key: "char.elyria.idle", src: "Character/NPC'S/Mermaid/Premade/Elyria/Sprite.png", dest: "characters/elyria-idle.png" },

  // --- Pre-made characters (phase 1 dùng premade, phase 4 compose Skin/Hair/Clothes) ---
  // Placeholder keys — actual premade sheet paths resolve ở phase 4 visual gate.
  // Giữ 5 entry cho compose skeleton test (dest wires phase 4).

  // --- Animals (8 loài × idle sheet) ---
  { key: "animal.chicken", src: "Animals/Farm/Chicken/Chicken Full.png", dest: "animals/chicken.png" },
  { key: "animal.cow", src: "Animals/Farm/Cow/Common Cow/Female Cow Brown.png", dest: "animals/cow.png" },
  { key: "animal.duck", src: "Animals/Farm/Ducks/Duck White.png", dest: "animals/duck.png" },
  { key: "animal.goat", src: "Animals/Farm/Goat/Goat Female Brown.png", dest: "animals/goat.png" },
  { key: "animal.horse", src: "Animals/Farm/Horse/1/idle.png", dest: "animals/horse.png" },
  { key: "animal.ostrich", src: "Animals/Farm/Ostrich/Ostrich Baby Brown.png", dest: "animals/ostrich.png" },
  { key: "animal.pig", src: "Animals/Farm/Pig/Pig Mud Pink.png", dest: "animals/pig.png" },
  { key: "animal.sheep", src: "Animals/Farm/Sheep/Sheep Female.png", dest: "animals/sheep.png" },

  // --- Enemy (1 representative sheet/type) ---
  { key: "enemy.slime.green", src: "Enemy/Slimes/Green", dest: "enemy/slime-green.png" },
  { key: "enemy.slime.blue", src: "Enemy/Slimes/Blue", dest: "enemy/slime-blue.png" },
  { key: "enemy.slime.pink", src: "Enemy/Slimes/Pink", dest: "enemy/slime-pink.png" },
  { key: "enemy.goblin", src: "Enemy/Goblins", dest: "enemy/goblin.png" },
  { key: "enemy.myconid", src: "Enemy/Myconid", dest: "enemy/myconid.png" },
  { key: "enemy.venom", src: "Enemy/Venom Bloom", dest: "enemy/venom-bloom.png" },

  // --- UI ---
  { key: "ui.hud", src: "UI/HUD.png", dest: "ui/hud.png" },
  { key: "ui.bars", src: "UI/Bars.png", dest: "ui/bars.png" },
  { key: "ui.money", src: "UI/Money.png", dest: "ui/money.png" },
  { key: "ui.button", src: "UI/button.png", dest: "ui/button.png" },
  { key: "ui.dialogue", src: "UI/dialogue box.png", dest: "ui/dialogue-box.png" },
  { key: "ui.extras", src: "UI/Extras.png", dest: "ui/extras.png" },
  { key: "ui.weather", src: "UI/weather icons.png", dest: "ui/weather-icons.png" },
  { key: "ui.slots", src: "UI/Inventory/Slots.png", dest: "ui/slots.png" },

  // --- Objects/Decor ---
  { key: "obj.house", src: "Objects/Exterior/Houses/9.png", dest: "objects/house.png" },
  { key: "obj.tree", src: "Objects/Tree/Common/Shadow/Maple Tree.png", dest: "objects/tree.png" },
  { key: "obj.tree.pine", src: "Objects/Tree/Common/Shadow/Pine Tree.png", dest: "objects/pine.png" },
  { key: "obj.fence", src: "Objects/Exterior/Fence and Bridge/Fence Wood.png", dest: "objects/fence.png" },
  { key: "obj.well", src: "Objects/Exterior/Well .png", dest: "objects/well.png" },
  { key: "icon.hoe", src: "Icons/RPG icons/Weapons and Armor/1. Wood/Hoe.png", dest: "icons/hoe.png" },
  { key: "icon.water", src: "Icons/RPG icons/Weapons and Armor/1. Wood/Watering can.png", dest: "icons/water.png" },
  { key: "icon.axe", src: "Icons/RPG icons/Weapons and Armor/1. Wood/Axe.png", dest: "icons/axe.png" },
  { key: "icon.pickaxe", src: "Icons/RPG icons/Weapons and Armor/1. Wood/Pickaxe.png", dest: "icons/pickaxe.png" },
  { key: "icon.scythe", src: "Icons/RPG icons/Weapons and Armor/1. Wood/Sickle.png", dest: "icons/scythe.png" },
  { key: "icon.rod", src: "Icons/RPG icons/Weapons and Armor/1. Wood/Fishing Rod.png", dest: "icons/rod.png" },
  { key: "icon.parsnip", src: "Icons/Food Icons/Parsnip.png", dest: "icons/parsnip.png" },
  { key: "icon.cauliflower", src: "Icons/Food Icons/Cauliflower.png", dest: "icons/cauliflower.png" },
  { key: "icon.potato", src: "Icons/Food Icons/Potato.png", dest: "icons/potato.png" },
  { key: "icon.carrot", src: "Icons/Food Icons/Carrot.png", dest: "icons/carrot.png" },
  { key: "icon.blueberry", src: "Icons/Food Icons/Blueberry.png", dest: "icons/blueberry.png" },
  { key: "icon.tomato", src: "Icons/Food Icons/Tomato.png", dest: "icons/tomato.png" },
  { key: "icon.pumpkin", src: "Icons/Food Icons/Pumpkin.png", dest: "icons/pumpkin.png" },
  { key: "icon.corn", src: "Icons/Food Icons/Corn.png", dest: "icons/corn.png" },
  { key: "icon.cabbage", src: "Icons/Food Icons/Cabbage.png", dest: "icons/cabbage.png" },
  { key: "icon.strawberry", src: "Icons/Food Icons/Strawberry.png", dest: "icons/strawberry.png" },
  { key: "icon.onion", src: "Icons/Food Icons/Onion.png", dest: "icons/onion.png" },
  { key: "icon.wheat", src: "Icons/Food Icons/Wheat.png", dest: "icons/wheat.png" },
  { key: "icon.egg", src: "Icons/Food Icons/Chicken Egg.png", dest: "icons/egg.png" },
  { key: "icon.milk", src: "Icons/Food Icons/Small Cow Milk.png", dest: "icons/milk.png" },

  // ── Wave 1 P1: fish icons (River = ao/hồ, Sea = biển) ──────────────────────
  { key: "icon.fish.sunfish", src: "Icons/Fish/River/Sunfish.png", dest: "icons/fish/sunfish.png" },
  { key: "icon.fish.perch", src: "Icons/Fish/River/Perch.png", dest: "icons/fish/perch.png" },
  { key: "icon.fish.carp", src: "Icons/Fish/River/Carp.png", dest: "icons/fish/carp.png" },
  { key: "icon.fish.chub", src: "Icons/Fish/River/Chub.png", dest: "icons/fish/chub.png" },
  { key: "icon.fish.bass", src: "Icons/Fish/River/Large Mouth Bass.png", dest: "icons/fish/bass.png" },
  { key: "icon.fish.pike", src: "Icons/Fish/River/Pike Fish.png", dest: "icons/fish/pike.png" },
  { key: "icon.fish.tiger-trout", src: "Icons/Fish/River/Tiger Trout.png", dest: "icons/fish/tiger-trout.png" },
  { key: "icon.fish.sturgeon", src: "Icons/Fish/River/Sturgeon.png", dest: "icons/fish/sturgeon.png" },
  { key: "icon.fish.anchovy", src: "Icons/Fish/Sea/Anchovy.png", dest: "icons/fish/anchovy.png" },
  { key: "icon.fish.sardine", src: "Icons/Fish/Sea/Sardine.png", dest: "icons/fish/sardine.png" },
  { key: "icon.fish.red-snapper", src: "Icons/Fish/Sea/Red Snapper.png", dest: "icons/fish/red-snapper.png" },
  { key: "icon.fish.tuna", src: "Icons/Fish/Sea/Tuna.png", dest: "icons/fish/tuna.png" },

  // ── Wave 2 P1: Food Icons — 14 món nấu (kitchen station) ─────────────────
  { key: "icon.food.parsnip-soup", src: "Icons/Food Icons/Parsnip Soup.png", dest: "icons/food/parsnip-soup.png" },
  { key: "icon.food.boiled-egg", src: "Icons/Food Icons/Boiled Egg.png", dest: "icons/food/boiled-egg.png" },
  { key: "icon.food.baked-fish", src: "Icons/Food Icons/Baked Fish.png", dest: "icons/food/baked-fish.png" },
  { key: "icon.food.pancakes", src: "Icons/Food Icons/Pancakes.png", dest: "icons/food/pancakes.png" },
  { key: "icon.food.veggie-mix", src: "Icons/Food Icons/Vegetable Mix.png", dest: "icons/food/veggie-mix.png" },
  { key: "icon.food.fruit-salad", src: "Icons/Food Icons/Fruit Salad.png", dest: "icons/food/fruit-salad.png" },
  { key: "icon.food.omelet", src: "Icons/Food Icons/Omelet.png", dest: "icons/food/omelet.png" },
  { key: "icon.food.fish-stew", src: "Icons/Food Icons/Fish Stew.png", dest: "icons/food/fish-stew.png" },
  { key: "icon.food.sashimi", src: "Icons/Food Icons/Sashimi.png", dest: "icons/food/sashimi.png" },
  { key: "icon.food.pumpkin-soup", src: "Icons/Food Icons/Pumpkin Soup.png", dest: "icons/food/pumpkin-soup.png" },
  { key: "icon.food.fish-tacos", src: "Icons/Food Icons/Fish Tacos.png", dest: "icons/food/fish-tacos.png" },
  { key: "icon.food.stuffed-peppers", src: "Icons/Food Icons/Stuffed Peppers.png", dest: "icons/food/stuffed-peppers.png" },
  { key: "icon.food.casserole", src: "Icons/Food Icons/Casserole.png", dest: "icons/food/casserole.png" },
  { key: "icon.food.complete-breakfast", src: "Icons/Food Icons/Complete Breakfast.png", dest: "icons/food/complete-breakfast.png" },
  { key: "icon.food.bread", src: "Icons/Food Icons/Bread .png", dest: "icons/food/bread.png" },

  // ── Wave 3 P1: Decor — 19 sheet mới (flower_sign tái dùng obj.balloons) ───
  { key: "obj.decor.fence-wood", src: "Objects/Exterior/Fence and Bridge/Fence Wood.png", dest: "objects/decor/fence-wood.png" },
  { key: "obj.decor.fence-stone", src: "Objects/Exterior/Fence and Bridge/Fence Stone.png", dest: "objects/decor/fence-stone.png" },
  { key: "obj.decor.fence-iron", src: "Objects/Exterior/Fence and Bridge/Fence Iron.png", dest: "objects/decor/fence-iron.png" },
  { key: "obj.decor.birdhouse", src: "Objects/Exterior/Birdhouse.png", dest: "objects/decor/birdhouse.png" },
  { key: "obj.decor.hay-bale", src: "Objects/Exterior/Hay Bales.png", dest: "objects/decor/hay-bale.png" },
  { key: "obj.decor.bench", src: "Objects/Exterior/Beach/Wooden Bench.png", dest: "objects/decor/bench.png" },
  { key: "obj.decor.street-lamp", src: "Objects/Exterior/Street Lamp.png", dest: "objects/decor/street-lamp.png" },
  { key: "obj.decor.street-lamp2", src: "Objects/Exterior/Street Lamp 2.png", dest: "objects/decor/street-lamp2.png" },
  { key: "obj.decor.picnic", src: "Objects/Exterior/Picnic.png", dest: "objects/decor/picnic.png" },
  { key: "obj.decor.notice-board", src: "Objects/Exterior/Notice Boards.png", dest: "objects/decor/notice-board.png" },
  { key: "obj.decor.scarecrow", src: "Objects/Exterior/Scarescrow.png", dest: "objects/decor/scarecrow.png" },
  { key: "obj.decor.statue", src: "Objects/Exterior/Stone Statue.png", dest: "objects/decor/statue.png" },
  { key: "obj.decor.fountain", src: "Objects/Exterior/Water fountain.png", dest: "objects/decor/fountain.png" },
  { key: "obj.decor.candle", src: "Objects/Interior/Candle 1.png", dest: "objects/decor/candle.png" },
  { key: "obj.decor.table", src: "Objects/Interior/Tables and desks.png", dest: "objects/decor/table.png" },
  { key: "obj.decor.sofa", src: "Objects/Interior/Sofa and armchair.png", dest: "objects/decor/sofa.png" },
  { key: "obj.decor.cat-furn", src: "Objects/Interior/cats furniture.png", dest: "objects/decor/cat-furn.png" },
  { key: "obj.decor.xmas", src: "Objects/Interior/Xmas.png", dest: "objects/decor/xmas.png" },
  { key: "obj.decor.dresser", src: "Objects/Interior/Dressers.png", dest: "objects/decor/dresser.png" },

  // ── Wave 1 P4: Alex fishing pre-made (frame 64×48; hàng 0=down 1=up 2=side 3=side-wide) ──
  { key: "char.alex.fishing.cast", src: "Character/Character/Pre-made/Alex/Fishing/Casting.png", dest: "characters/alex-fishing-cast.png" },
  { key: "char.alex.fishing.wait", src: "Character/Character/Pre-made/Alex/Fishing/Wait Idle.png", dest: "characters/alex-fishing-wait.png" },
  { key: "char.alex.fishing.bite", src: "Character/Character/Pre-made/Alex/Fishing/Hooked.png", dest: "characters/alex-fishing-bite.png" },
  { key: "char.alex.fishing.reel", src: "Character/Character/Pre-made/Alex/Fishing/Roll.png", dest: "characters/alex-fishing-reel.png" },
  { key: "char.alex.fishing.catch", src: "Character/Character/Pre-made/Alex/Fishing/Captured Fish.png", dest: "characters/alex-fishing-catch.png" },
  { key: "obj.bed", src: "Objects/Interior/Beds.png", dest: "objects/bed.png" },
  { key: "obj.props", src: "Objects/Props", dest: "objects/props.png" },
  { key: "obj.exterior", src: "Objects/Exterior", dest: "objects/exterior.png" },
  { key: "obj.workbench", src: "Objects/Work Benches", dest: "objects/workbench.png" },

  // ── Map enrichment (phase: map-enrichment) ────────────────────────────────
  // ── Village: buildings ─────────────────────────────────────────────────────
  { key: "obj.house.1", src: "Objects/Exterior/Houses/1.png", dest: "objects/house1.png" },
  { key: "obj.house.2", src: "Objects/Exterior/Houses/2.png", dest: "objects/house2.png" },
  { key: "obj.house.3", src: "Objects/Exterior/Houses/3.png", dest: "objects/house3.png" },
  { key: "obj.house.4", src: "Objects/Exterior/Houses/4.png", dest: "objects/house4.png" },
  { key: "obj.house.5", src: "Objects/Exterior/Houses/5.png", dest: "objects/house5.png" },
  { key: "obj.house.6", src: "Objects/Exterior/Houses/6.png", dest: "objects/house6.png" },
  { key: "obj.house.7", src: "Objects/Exterior/Houses/7.png", dest: "objects/house7.png" },
  { key: "obj.house.9", src: "Objects/Exterior/Houses/9.png", dest: "objects/house9.png" },
  // ── Village: plaza & street ────────────────────────────────────────────────
  { key: "obj.fountain", src: "Objects/Exterior/Water fountain.png", dest: "objects/fountain.png" },
  { key: "obj.streetlamp", src: "Objects/Exterior/Street Lamp.png", dest: "objects/streetlamp.png" },
  { key: "obj.noticeboard", src: "Objects/Exterior/Notice Boards.png", dest: "objects/noticeboard.png" },
  { key: "obj.newsstand", src: "Objects/Exterior/Newsstand.png", dest: "objects/newsstand.png" },
  { key: "obj.village.barrels", src: "Objects/Exterior/Village Barrels.png", dest: "objects/village-barrels.png" },
  { key: "obj.village.signs", src: "Objects/Exterior/Village Signs.png", dest: "objects/village-signs.png" },
  { key: "obj.village.clothesline", src: "Objects/Exterior/Village Clotheslines.png", dest: "objects/village-clothesline.png" },
  { key: "obj.stone.statue", src: "Objects/Exterior/Stone Statue.png", dest: "objects/stone-statue.png" },
  { key: "obj.oldtree", src: "Objects/Exterior/Old Tree.png", dest: "objects/oldtree.png" },
  { key: "obj.birdhouse", src: "Objects/Exterior/Birdhouse.png", dest: "objects/birdhouse.png" },
  { key: "obj.bus", src: "Objects/Exterior/Bus.png", dest: "objects/bus.png" },
  // ── Village: market + playground ───────────────────────────────────────────
  { key: "obj.popcorn.cart", src: "Objects/Exterior/Popcorn .png", dest: "objects/popcorn-cart.png" },
  { key: "obj.icecream.cart", src: "Objects/Exterior/ice cream cart.png", dest: "objects/icecream-cart.png" },
  { key: "obj.cottoncandy.cart", src: "Objects/Exterior/Cotton candy cart.png", dest: "objects/cottoncandy-cart.png" },
  { key: "obj.playground.slide", src: "Objects/Exterior/Playground Slide.png", dest: "objects/playground-slide.png" },
  { key: "obj.playground.swing", src: "Objects/Exterior/Swing.png", dest: "objects/playground-swing.png" },
  { key: "obj.playground.seesaw", src: "Objects/Exterior/Seesaw.png", dest: "objects/playground-seesaw.png" },
  { key: "obj.playground.sandbox", src: "Objects/Exterior/sandbox.png", dest: "objects/playground-sandbox.png" },
  // ── Beach ──────────────────────────────────────────────────────────────────
  { key: "obj.beach.umbrella", src: "Objects/Exterior/Beach/Beach Umbrella.png", dest: "objects/beach-umbrella.png" },
  { key: "obj.beach.chair", src: "Objects/Exterior/Beach/Beach Chair.png", dest: "objects/beach-chair.png" },
  { key: "obj.beach.towel", src: "Objects/Exterior/Beach/Beach Towel.png", dest: "objects/beach-towel.png" },
  { key: "obj.beach.coconut", src: "Objects/Exterior/Beach/Coconut Tree.png", dest: "objects/beach-coconut.png" },
  { key: "obj.beach.fishcrate", src: "Objects/Exterior/Beach/Fish Crate.png", dest: "objects/beach-fishcrate.png" },
  { key: "obj.beach.fishbarrel", src: "Objects/Exterior/Beach/Fish Barrel.png", dest: "objects/beach-fishbarrel.png" },
  { key: "obj.beach.grill", src: "Objects/Exterior/Beach/Grill.png", dest: "objects/beach-grill.png" },
  { key: "obj.beach.moai", src: "Objects/Exterior/Beach/Moai.png", dest: "objects/beach-moai.png" },
  { key: "obj.beach.lifering", src: "Objects/Exterior/Beach/Life Ring.png", dest: "objects/beach-lifering.png" },
  { key: "obj.beach.volleyball", src: "Objects/Exterior/Beach/Beach Volleyball Ball.png", dest: "objects/beach-volleyball.png" },
  { key: "obj.balloons", src: "Objects/Exterior/Beach/Balloons.png", dest: "objects/beach-balloons.png" },
  { key: "obj.picnic", src: "Objects/Exterior/Picnic.png", dest: "objects/picnic.png" },
  { key: "animal.seagull", src: "Animals/Forest/Beach/seagull.png", dest: "animals/seagull.png" },
  { key: "animal.pelican", src: "Animals/Forest/Beach/Pelican.png", dest: "animals/pelican.png" },
  { key: "animal.dolphin.green", src: "Animals/Forest/Beach/Green Dolphin.png", dest: "animals/dolphin-green.png" },
  { key: "animal.dolphin.pink", src: "Animals/Forest/Beach/Pink Dolphin.png", dest: "animals/dolphin-pink.png" },
  { key: "animal.fox", src: "Animals/Forest/Fox/Red Fox.png", dest: "animals/fox.png" },
  { key: "animal.deer", src: "Animals/Forest/Deer/Male/Idle.png", dest: "animals/deer.png" },
  { key: "animal.cat", src: "Animals/Pets/Cats/1/Black.png", dest: "animals/cat.png" },
  { key: "animal.dog", src: "Animals/Pets/Dogs/1/1.png", dest: "animals/dog.png" },
  // ── Cave / mine / shrine ───────────────────────────────────────────────────
  { key: "obj.cave.lamp", src: "Objects/Exterior/Mine and Dungeon/Lamp .png", dest: "objects/cave-lamp.png" },
  { key: "obj.cave.minerals", src: "Objects/Exterior/Mine and Dungeon/stone with minerals.png", dest: "objects/cave-minerals.png" },
  { key: "obj.cave.minerals2", src: "Objects/Exterior/Mine and Dungeon/stone with minerals2.png", dest: "objects/cave-minerals2.png" },
  { key: "obj.cave.web", src: "Objects/Exterior/Mine and Dungeon/web spider.png", dest: "objects/cave-web.png" },
  { key: "obj.cave.bonfire", src: "Objects/Exterior/Mine and Dungeon/bonfire.png", dest: "objects/cave-bonfire.png" },
  { key: "obj.cave.statue", src: "Objects/Exterior/Mine and Dungeon/statue.png", dest: "objects/cave-statue.png" },
  { key: "obj.cave.chest", src: "Objects/Exterior/chest.png", dest: "objects/cave-chest.png" },
  { key: "obj.cave.mineprops", src: "Objects/Exterior/Mine and Dungeon/Mine props.png", dest: "objects/cave-mineprops.png" },
  { key: "obj.cave.lavastone", src: "Objects/Exterior/Mine and Dungeon/Lava Stone.png", dest: "objects/cave-lavastone.png" },
  { key: "obj.cave.trap", src: "Objects/Exterior/Mine and Dungeon/Trap.png", dest: "objects/cave-trap.png" },
  { key: "obj.shrine.altar", src: "Objects/Exterior/Deep Forest/Altar.png", dest: "objects/shrine-altar.png" },
  { key: "obj.shrine.pillar", src: "Objects/Exterior/Deep Forest/Stone Pillar.png", dest: "objects/shrine-pillar.png" },
  { key: "obj.shrine.column.broken", src: "Objects/Exterior/Deep Forest/Broken Stone Column.png", dest: "objects/shrine-column-broken.png" },
  { key: "obj.shrine.portal", src: "Objects/Exterior/Deep Forest/Root portal.png", dest: "objects/shrine-portal.png" },
  // ── Farm ───────────────────────────────────────────────────────────────────
  { key: "obj.farm.scarecrow", src: "Objects/Exterior/Scarescrow.png", dest: "objects/farm-scarecrow.png" },
  { key: "obj.farm.mailbox", src: "Objects/Exterior/Mailbox.png", dest: "objects/farm-mailbox.png" },
  { key: "obj.farm.haybale", src: "Objects/Exterior/Hay Bales.png", dest: "objects/farm-haybale.png" },
  { key: "obj.farm.trough", src: "Objects/Exterior/Feed Trough.png", dest: "objects/farm-trough.png" },
  { key: "obj.farm.shippingbox", src: "Objects/Exterior/shipping box.png", dest: "objects/farm-shippingbox.png" },
  { key: "obj.farm.beehive", src: "Objects/Work Benches/Beehive.png", dest: "objects/farm-beehive.png" },
  { key: "obj.farm.berry.pile", src: "Objects/Exterior/Berry Piles.png", dest: "objects/farm-berry-pile.png" },
  { key: "obj.farm.barrels", src: "Objects/Exterior/Stacked Barrels.png", dest: "objects/farm-barrels.png" },
  { key: "obj.farm.waterbuckets", src: "Objects/Exterior/Wooden Buckets.png", dest: "objects/farm-waterbuckets.png" },
  { key: "obj.farm.anvil", src: "Objects/Work Benches/Anvil.png", dest: "objects/farm-anvil.png" },
  { key: "obj.farm.churn", src: "Objects/Work Benches/Butter Churn.png", dest: "objects/farm-churn.png" },
  { key: "obj.farm.jammaker", src: "Objects/Work Benches/Jam Maker.png", dest: "objects/farm-jammaker.png" },
  // ── Orchard fruit trees (seasonal) ─────────────────────────────────────────
  { key: "tree.cherry", src: "Crops/Fruits Tree/Spring/Cherry Tree.png", dest: "objects/tree-cherry.png" },
  { key: "tree.apricot", src: "Crops/Fruits Tree/Spring/Apricot Tree.png", dest: "objects/tree-apricot.png" },
  { key: "tree.peach", src: "Crops/Fruits Tree/Summer/Peach Tree.png", dest: "objects/tree-peach.png" },
  { key: "tree.orange", src: "Crops/Fruits Tree/Summer/Orange Tree.png", dest: "objects/tree-orange.png" },
  { key: "tree.apple", src: "Crops/Fruits Tree/Fall/Apple Tree.png", dest: "objects/tree-apple.png" },
  { key: "tree.banana", src: "Crops/Fruits Tree/Summer/Banana Tree.png", dest: "objects/tree-banana.png" },
  // ── Animals: forest visitors + pets ────────────────────────────────────────
  // (goat/horse/pig/sheep/ostrich keys existed since phase 1 — their srcs are pinned
  //  to specific variant sheets above per map-enrichment follow-up.)
  // ── House interior ─────────────────────────────────────────────────────────
  { key: "int.bed", src: "Objects/Interior/Beds.png", dest: "interior/bed.png" },
  { key: "int.fireplace", src: "Objects/Interior/Fireplace.png", dest: "interior/fireplace.png" },
  { key: "int.sofa", src: "Objects/Interior/Sofa and armchair.png", dest: "interior/sofa.png" },
  { key: "int.closet", src: "Objects/Interior/Closet.png", dest: "interior/closet.png" },
  { key: "int.dresser", src: "Objects/Interior/Dressers.png", dest: "interior/dresser.png" },
  { key: "int.kitchenpot", src: "Objects/Work Benches/Kitchen pot.png", dest: "interior/kitchenpot.png" },
  { key: "int.candle", src: "Objects/Interior/Candle 1.png", dest: "interior/candle.png" },
  { key: "int.chairs", src: "Objects/Interior/Chairs.png", dest: "interior/chairs.png" },
  { key: "int.carpet", src: "Tileset/carpet.png", dest: "interior/carpet.png" },
  // ── NPC: pirate ────────────────────────────────────────────────────────────
  { key: "char.pirate.idle", src: "Character/NPC'S/Pirate/Premade/OLD/Idle.png", dest: "characters/pirate-idle.png" },
  // ── Tilesets ───────────────────────────────────────────────────────────────
  { key: "tile.beach.bridge", src: "Tileset/Bridge Beach Tileset.png", dest: "tiles/beach-bridge.png" },
  { key: "tile.cave.walls", src: "Tileset/Rock Caves.png", dest: "tiles/cave-walls.png" },
  { key: "tile.path.stones", src: "Tileset/Path tiles.png", dest: "tiles/path-stones.png" },
];

// Stamp every curated entry with approved readiness + provenance + inferred kind.
// Additive: key/src/dest are untouched, so the loader, copy-assets mirror and sync test
// are unaffected. New/non-curated entries may override these fields explicitly.
const STAMPED: readonly AssetEntry[] = RAW_MANIFEST.map((e) => ({
  ...e,
  kind: e.kind ?? inferKind(e.key),
  readiness: e.readiness ?? "approved",
  provenance: e.provenance ?? CURATED_PROVENANCE,
}));

export const ASSET_MANIFEST: readonly AssetEntry[] = STAMPED;

// Resolve a manifest entry key → public URL path (runtime loader dùng cái này).
const BASE = "/assets/farm-rpg";
export function assetUrl(key: string): string {
  const entry = ASSET_MANIFEST.find((e) => e.key === key);
  if (!entry) throw new Error(`[asset] unknown key: ${key}`);
  return `${BASE}/${entry.dest}`;
}

/**
 * An asset whose readiness has been verified approved. The narrowed `readiness` lets
 * callers rely on the value at the type level, not only at runtime.
 */
export type ApprovedAsset = AssetEntry & { readiness: "approved" };

/**
 * Strict consumer gate: returns the entry only when `readiness === "approved"`.
 * Callers that need a URL for any known key (e.g. the loader, which owns per-asset
 * fallback) use {@link assetUrl}; callers that render an asset as gameplay identity use
 * this and MUST switch to a documented fallback when it throws.
 */
export function resolveApprovedAsset(key: string): ApprovedAsset {
  const entry = ASSET_MANIFEST.find((e) => e.key === key);
  if (!entry) throw new Error(`[asset] unknown key: ${key}`);
  if (entry.readiness !== "approved") {
    throw new Error(
      `[asset] ${key} is ${entry.readiness}; caller must use documented fallback`,
    );
  }
  return entry as ApprovedAsset;
}

// All keys (cho loader preload + test).
export const ASSET_KEYS: readonly string[] = ASSET_MANIFEST.map((e) => e.key);

/** A detected manifest collision (duplicate key or destination). */
export interface ManifestCollision {
  kind: "key" | "dest";
  value: string;
  keys: string[];
}

/**
 * Pure collision detector: finds duplicate keys and duplicate destinations in a manifest.
 * Used by tests and mirrored by scripts/copy-assets.mjs so the destructive copy step can
 * fail fast with a clear message instead of silently overwriting/clobbering.
 */
export function findManifestCollisions(
  entries: readonly AssetEntry[],
): ManifestCollision[] {
  const byKey = new Map<string, string[]>();
  const byDest = new Map<string, string[]>();
  for (const e of entries) {
    byKey.set(e.key, [...(byKey.get(e.key) ?? []), e.key]);
    byDest.set(e.dest, [...(byDest.get(e.dest) ?? []), e.key]);
  }
  const hits: ManifestCollision[] = [];
  for (const [value, keys] of byKey) if (keys.length > 1) hits.push({ kind: "key", value, keys });
  for (const [value, keys] of byDest) if (keys.length > 1) hits.push({ kind: "dest", value, keys });
  return hits;
}
