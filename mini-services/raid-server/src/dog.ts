import { MAP_COLS, MAP_ROWS, SOLID_TILES } from "./constants.js";
import type { Tile } from "./types.js";

export type SolidFn = (x: number, y: number) => boolean;

/** Solid checker từ terrain array (raid load farm read-only). */
export function solidFromTerrain(terrain: number[]): SolidFn {
  return (x, y) => {
    if (x < 0 || y < 0 || x >= MAP_COLS || y >= MAP_ROWS) return true; // out of bounds = solid
    return SOLID_TILES.has(terrain[y * MAP_COLS + x]);
  };
}

/**
 * Bresenham line-of-sight. Trả true nếu đường nối a→b không đi qua tile solid.
 * Dog vision dùng (§10): thấy raider nếu LOS clear + trong tầm.
 */
export function lineOfSight(a: Tile, b: Tile, isSolid: SolidFn): boolean {
  let x0 = a.x, y0 = a.y;
  const x1 = b.x, y1 = b.y;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  // không check chính a (vị trí dog) — dog đứng trong tile hợp lệ
  while (x0 !== x1 || y0 !== y1) {
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
    if (x0 === x1 && y0 === y1) break; // tới đích, không check đích
    if (isSolid(x0, y0)) return false;
  }
  return true;
}

/**
 * BFS shortest path src→dst trên grid 660. Trả path (loại src, gồm dst) hoặc null.
 * 660 node — rebuild per tick OK (red-team #6: cache khi cần, MVP rebuild).
 */
export function bfs(src: Tile, dst: Tile, isSolid: SolidFn): Tile[] | null {
  if (src.x === dst.x && src.y === dst.y) return [];
  if (isSolid(dst.x, dst.y)) return null;
  const key = (x: number, y: number) => y * MAP_COLS + x;
  const prev = new Map<number, number>();
  const visited = new Uint8Array(MAP_COLS * MAP_ROWS);
  const queue: number[] = [key(src.x, src.y)];
  visited[key(src.x, src.y)] = 1;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let found = false;
  while (queue.length) {
    const cur = queue.shift()!;
    const cx = cur % MAP_COLS, cy = Math.floor(cur / MAP_COLS);
    if (cx === dst.x && cy === dst.y) { found = true; break; }
    for (const [ddx, ddy] of dirs) {
      const nx = cx + ddx, ny = cy + ddy;
      if (nx < 0 || ny < 0 || nx >= MAP_COLS || ny >= MAP_ROWS) continue;
      const k = key(nx, ny);
      if (visited[k]) continue;
      if (isSolid(nx, ny) && !(nx === dst.x && ny === dst.y)) continue;
      visited[k] = 1;
      prev.set(k, cur);
      queue.push(k);
    }
  }
  if (!found) return null;
  // reconstruct
  const path: Tile[] = [];
  let cur = key(dst.x, dst.y);
  while (cur !== key(src.x, src.y)) {
    path.push({ x: cur % MAP_COLS, y: Math.floor(cur / MAP_COLS) });
    const p = prev.get(cur);
    if (p === undefined) break;
    cur = p;
  }
  path.reverse();
  return path;
}

/** Tile kế tiếp dog nên bước tới (path[0]). null nếu không cần di chuyển. */
export function bfsNext(src: Tile, dst: Tile, isSolid: SolidFn): Tile | null {
  const path = bfs(src, dst, isSolid);
  if (!path || path.length === 0) return null;
  return path[0];
}
