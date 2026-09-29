// AutoTile — bitmask shoreline auto-tiling cho water tile.
// Bit layout (bit index):  N=1, NE=2, E=4, SE=8, S=16, SW=32, W=64, NW=128
// Bit set = neighbor LÀ NƯỚC. TerrainSpriteRenderer dùng decomposeShore để
// chọn shore cell (bờ lồi) + vẽ góc lõm; mọi combo bitmask đều được phân tích
// chính xác thay vì rơi về "peninsula" như bảng 16-case cũ.

export type EdgeDir = "n" | "s" | "e" | "w";
export type CornerDir = "nw" | "ne" | "sw" | "se";
export type InnerCorner = "ne" | "nw" | "se" | "sw";

/** Bờ lồi: đất nằm ở cardinal phía đó. Corner khi đúng 2 cardinal kề nhau là đất. */
export interface ShoreDecomp {
  edge?: EdgeDir;
  corner?: CornerDir;
  /** Góc lõm: đường chéo là đất nhưng cả 2 cardinal kề nó là nước → viền bị khuyết ở góc này. */
  innerCorners: InnerCorner[];
}

/** Build 8-neighbor bitmask cho tile tại (r,c). isMatch(t) check neighbor type. */
export function neighborBitmask(
  terrain: number[][],
  r: number,
  c: number,
  isMatch: (t: number) => boolean,
): number {
  const h = terrain.length;
  const w = h > 0 ? terrain[0].length : 0;
  let mask = 0;
  const at = (rr: number, cc: number) =>
    rr < 0 || rr >= h || cc < 0 || cc >= w ? false : isMatch(terrain[rr][cc]);
  if (at(r - 1, c)) mask |= 1; // N
  if (at(r - 1, c + 1)) mask |= 2; // NE
  if (at(r, c + 1)) mask |= 4; // E
  if (at(r + 1, c + 1)) mask |= 8; // SE
  if (at(r + 1, c)) mask |= 16; // S
  if (at(r + 1, c - 1)) mask |= 32; // SW
  if (at(r, c - 1)) mask |= 64; // W
  if (at(r - 1, c - 1)) mask |= 128; // NW
  return mask;
}

const isWater = (t: number) => t === 3; // T.WATER

/**
 * Phân tích bitmask thành phần bờ:
 * - Đúng 1 cardinal là đất → edge thẳng phía đó.
 * - Đúng 2 cardinal kề nhau là đất → corner (góc lồi).
 * - Diagonal là đất nhưng cả 2 cardinal kề nó là nước → innerCorner (góc lõm,
 *   cần vá quarter-arc vì shore cell không phủ được).
 * - Nước cô lập / mọi hướng đều nước → không có bờ nào.
 * Cardinal bits: N=1, E=4, S=16, W=64. Diagonal: NE=2, SE=8, SW=32, NW=128.
 */
export function decomposeShore(mask: number): ShoreDecomp {
  const landN = !(mask & 1);
  const landE = !(mask & 4);
  const landS = !(mask & 16);
  const landW = !(mask & 64);

  const result: ShoreDecomp = { innerCorners: [] };

  const landCardinals: EdgeDir[] = [];
  if (landN) landCardinals.push("n");
  if (landE) landCardinals.push("e");
  if (landS) landCardinals.push("s");
  if (landW) landCardinals.push("w");

  if (landCardinals.length === 1) {
    result.edge = landCardinals[0];
  } else if (
    landCardinals.length === 2 &&
    ((landN && landE) || (landE && landS) || (landS && landW) || (landW && landN))
  ) {
    result.corner =
      landN && landW ? "nw" : landN && landE ? "ne" : landS && landW ? "sw" : "se";
  }
  // ≥3 cardinal đất hoặc 2 cardinal đối nhau (dải nước mảnh): không có cell phù
  // hợp — renderer tự bo bằng graphics.

  // Góc lõm: diagonal đất + cả 2 cardinal kề nó là nước.
  if (!(mask & 2) && !landN && !landE) result.innerCorners.push("ne");
  if (!(mask & 8) && !landS && !landE) result.innerCorners.push("se");
  if (!(mask & 32) && !landS && !landW) result.innerCorners.push("sw");
  if (!(mask & 128) && !landN && !landW) result.innerCorners.push("nw");
  return result;
}

/** Convenience: decompose cho water tile tại (r,c). */
export function waterShoreDecomp(terrain: number[][], r: number, c: number): ShoreDecomp {
  return decomposeShore(neighborBitmask(terrain, r, c, isWater));
}
