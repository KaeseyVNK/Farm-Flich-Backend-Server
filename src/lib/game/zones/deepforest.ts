// Wave 5 P1 — Deep Forest (rừng sâu): 36×28, quái tuần tra (scene spawn từ
// DEEPFOREST_SPAWNS), altar clearing. Tone cozy §1 — art slime/myconid dễ thương.
import { T } from "@/lib/game/constants";
import { fillTerrain, stampRect, zoneIdx, type ZoneLayout } from "./types";

export const DEEPFOREST_COLS = 36;
export const DEEPFOREST_ROWS = 28;

/** Điểm spawn quái — scene-local (không persist; respawn mỗi lần vào zone). */
export const DEEPFOREST_SPAWNS: { id: string; defId: string; x: number; y: number }[] = [
  { id: "df-a", defId: "sprout_slime", x: 10, y: 8 },
  { id: "df-b", defId: "sprout_slime", x: 24, y: 20 },
  { id: "df-c", defId: "slime_green", x: 16, y: 12 },
  { id: "df-d", defId: "slime_green", x: 28, y: 10 },
  { id: "df-e", defId: "slime_blue", x: 12, y: 20 },
  { id: "df-f", defId: "slime_blue", x: 26, y: 6 },
  { id: "df-g", defId: "myconid_purple", x: 19, y: 16 },
  { id: "df-h", defId: "myconid_purple", x: 30, y: 22 },
];

function build(): number[] {
  const terrain = fillTerrain(DEEPFOREST_COLS, DEEPFOREST_ROWS, T.GRASS);

  // Viền rừng đặc 2 tile TREE (không thể ra ngoài — leash tự nhiên).
  for (let x = 0; x < DEEPFOREST_COLS; x++) {
    terrain[zoneIdx(x, 0, DEEPFOREST_COLS)] = T.TREE;
    terrain[zoneIdx(x, 1, DEEPFOREST_COLS)] = T.TREE;
    terrain[zoneIdx(x, DEEPFOREST_ROWS - 1, DEEPFOREST_COLS)] = T.TREE;
    terrain[zoneIdx(x, DEEPFOREST_ROWS - 2, DEEPFOREST_COLS)] = T.TREE;
  }
  for (let y = 0; y < DEEPFOREST_ROWS; y++) {
    terrain[zoneIdx(0, y, DEEPFOREST_COLS)] = T.TREE;
    terrain[zoneIdx(1, y, DEEPFOREST_COLS)] = T.TREE;
    terrain[zoneIdx(DEEPFOREST_COLS - 1, y, DEEPFOREST_COLS)] = T.TREE;
    terrain[zoneIdx(DEEPFOREST_COLS - 2, y, DEEPFOREST_COLS)] = T.TREE;
  }

  // Đường mòn chính: từ cửa west (warp 2,14) ngang giữa map → altar clearing đông.
  stampRect(terrain, DEEPFOREST_COLS, 2, 14, 20, 2, T.PATH);
  stampRect(terrain, DEEPFOREST_COLS, 14, 8, 2, 12, T.PATH);
  stampRect(terrain, DEEPFOREST_COLS, 22, 14, 8, 2, T.PATH);

  // Altar clearing (đông) — sàn PATH tròn + hoa quanh rìa.
  stampRect(terrain, DEEPFOREST_COLS, 28, 10, 4, 8, T.PATH);
  stampRect(terrain, DEEPFOREST_COLS, 29, 9, 2, 10, T.GRASS_FLOWER);
  stampRect(terrain, DEEPFOREST_COLS, 29, 18, 2, 6, T.GRASS_FLOWER);

  // Clearing tây-bắc + nam (spawn quái thoáng).
  stampRect(terrain, DEEPFOREST_COLS, 8, 6, 8, 6, T.GRASS_FLOWER);
  stampRect(terrain, DEEPFOREST_COLS, 20, 18, 8, 6, T.GRASS_FLOWER);

  // Hồ nhỏ trung tâm (không câu được — chỉ phong cảnh; combat-sm coi WATER solid).
  stampRect(terrain, DEEPFOREST_COLS, 17, 10, 3, 2, T.WATER);

  return terrain;
}

export const DEEPFOREST_ZONE: ZoneLayout = {
  id: "deepforest",
  cols: DEEPFOREST_COLS,
  rows: DEEPFOREST_ROWS,
  spawn: { x: 3, y: 14 },
  terrain: build(),
  warps: [
    { x: 2, y: 14, to: "farm", spawn: { x: 56, y: 10 }, label: "Về nông trại" },
  ],
  beds: [],
  wells: [],
  ponds: [],
  npcs: [],
  rocks: [],
  slimes: [],
};
