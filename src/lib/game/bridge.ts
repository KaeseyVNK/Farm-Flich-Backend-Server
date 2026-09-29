// Bridge between React UI and the canvas game engine.
// The engine registers callbacks on startup; UI panels invoke them.

import { useFarmStore } from "@/store/farmStore";
import { MAP_COLS, MAP_ROWS } from "@/lib/game/constants";

export interface GameBridge {
  teleportToTile?: (x: number, y: number) => void;
  getPlayerTile?: () => { x: number; y: number };
  /** W5: combat scene-local state (e2e/test đọc — null khi chưa mount). */
  getCombatSnapshot?: () => {
    enemies: { id: string; defId: string; x: number; y: number; hp: number; fsm: string }[];
    pickups: { itemId: string; qty: number; x: number; y: number }[];
  } | null;
  /** W5: spawn enemy thử nghiệm (e2e — chỉ deepforest hợp lệ). */
  spawnEnemy?: (defId: string, tx: number, ty: number) => boolean;
  focusCameraOnTile?: (x: number, y: number) => void;
  // Touch input: set a virtual key (w/a/s/d) as pressed/released
  setVirtualKey?: (key: string, down: boolean) => void;
  // Touch input: trigger the interact action (same as pressing Space)
  triggerInteract?: () => void;
  /** W9P5: hướng facing hiện tại (e2e debug — kitchenpot interact theo facing). */
  getFacing?: () => "up" | "down" | "left" | "right";
}

const bridge: GameBridge = {};

export function registerGameBridge(b: GameBridge) {
  Object.assign(bridge, b);
  // Trả unregister để scene shutdown có thể xóa callback của chính nó. Trước đây
  // Object.assign ghi đè module-singleton, scene restart (locale switch / route
  // away→back) giữ callback cũ trỏ vào instance đã destroy → mobile D-pad/interact
  // kích hoạt scene chết.
  return () => {
    for (const key of Object.keys(b) as (keyof GameBridge)[]) {
      delete bridge[key];
    }
  };
}

export function getGameBridge(): GameBridge {
  return bridge;
}

/** Set a virtual movement key (used by the mobile D-pad). */
export function setVirtualKey(key: string, down: boolean) {
  bridge.setVirtualKey?.(key, down);
}

/** Trigger the interact action (used by the mobile action button). */
export function triggerInteract() {
  bridge.triggerInteract?.();
}

// Fast-travel locations (tile coords)
export interface TravelSpot {
  id: string;
  name: string;
  emoji: string;
  /** Short label for the SVG minimap marker (kept ASCII/locale-neutral). */
  short: string;
  x: number;
  y: number;
  desc: string;
}

// Travel spots khớp map 60×60 (zone-manager farm): footprints tại 16-21×14-19
// (house), 2-6×14-19 (shop), 22-28×14-19 (barn). Đặt spot NGAY CẠNH footprint
// (không trong, không trên nước/river 52-54) để teleport không dính collision.
export const TRAVEL_SPOTS: TravelSpot[] = [
  { id: "farmhouse", name: "Farmhouse", short: "NHÀ", emoji: "🏠", x: 18, y: 20, desc: "Nhà bạn & giường ngủ" },
  { id: "field", name: "Farm Field", short: "RUỘNG", emoji: "🌱", x: 18, y: 10, desc: "Đất cày tốt để trồng trọt" },
  { id: "pond", name: "Fishing Pond", short: "AO", emoji: "🎣", x: 8, y: 8, desc: "Nạp đầy bình tưới nước" },
  { id: "forest", name: "Forest", short: "RỪNG", emoji: "🌲", x: 35, y: 12, desc: "Chặt cây lấy gỗ" },
  { id: "quarry", name: "Quarry", short: "HẦM", emoji: "⛰️", x: 35, y: 35, desc: "Đập đá lấy đá" },
  { id: "town", name: "Town Square", short: "CHỢ", emoji: "🏛️", x: 25, y: 26, desc: "Gặp gỡ người dân thị trấn" },
  { id: "robins", name: "Robin's Shop", short: "XƯỞNG", emoji: "🛠️", x: 4, y: 20, desc: "Thợ mộc & xây dựng" },
];

/**
 * Tìm tile thẻ (walkable) gần nhất quanh (x,y) bằng BFS ring ngắn.
 * Dùng cho fast-travel: nếu spot rơi vào solid (water/tree/rock/fence/object)
 * hoặc out-of-bounds → teleport sẽ kẹt player. Trả fallback GRASS in-bounds.
 */
function nearestWalkable(x: number, y: number): { x: number; y: number } {
  const farm = useFarmStore.getState();
  const inB = (cx: number, cy: number) => cx >= 0 && cy >= 0 && cx < MAP_COLS && cy < MAP_ROWS;
  if (inB(x, y) && !farm.isSolid(x, y)) return { x, y };
  // BFS ring ra 8 hướng (Manhattan tăng dần) — cap radius 6.
  for (let radius = 1; radius <= 6; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const cx = x + dx;
        const cy = y + dy;
        if (inB(cx, cy) && !farm.isSolid(cx, cy)) return { x: cx, y: cy };
      }
    }
  }
  // Fallback: clamp trong bounds (player có thể vẫn solid nhưng teleport scene
  // sẽ snap pixel → ít nhất không out-of-world).
  return { x: Math.max(0, Math.min(MAP_COLS - 1, x)), y: Math.max(0, Math.min(MAP_ROWS - 1, y)) };
}

export function fastTravel(spot: TravelSpot) {
  const b = getGameBridge();
  if (b.teleportToTile) {
    const dest = nearestWalkable(spot.x, spot.y);
    b.teleportToTile(dest.x, dest.y);
    return true;
  }
  return false;
}

/**
 * Teleport từ nguồn KHÔNG tin cậy (save/load — coords có thể OOB hoặc solid do
 * map changed sau khi save). Clamp bounds + tìm nearestWalkable. Trước đây
 * applySaveData gọi bridge.teleportToTile(tx,ty) trực tiếp → save {x:100,y:100}
 * (OOB farm 60×60) → player rơi ra world, camera kẹt, stuck đến khi input move.
 */
export function teleportToTileSafe(x: number, y: number): boolean {
  const b = getGameBridge();
  if (!b.teleportToTile) return false;
  const dest = nearestWalkable(x, y);
  b.teleportToTile(dest.x, dest.y);
  return true;
}
