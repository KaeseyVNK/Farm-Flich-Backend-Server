/**
 * W7c — pure logic cho 3 puzzle renderer client (lock-rotate / circuit / jigsaw).
 * KHÔNG import từ mini-services (raid-server là process riêng) — circuit mask
 * logic là BẢN COPY của mini-services/raid-server/src/puzzle-circuit.ts
 * (SYNC-COMMENT: sửa 2 nơi — bảng SHAPE_TABLE + rotateMask phải giống hệt).
 * Server luôn validate lại attempt — hàm circuit-solved client CHỈ là UX hint.
 */

// ===== Circuit (copy từ raid-server puzzle-circuit.ts) =====

/** Shape id → bitmask hướng kết nối khi rotation 0 (N=0b0100 E=0b0010 S=0b1000 W=0b0001). */
export const CIRCUIT_SHAPE_MASKS: number[] = [
  0b0100, // 0: N
  0b0010, // 1: E
  0b1000, // 2: S
  0b0001, // 3: W
  0b0110, // 4: NE
  0b1010, // 5: ES
  0b1001, // 6: SW
  0b0101, // 7: WN
  0b1100, // 8: NS dọc
  0b0011, // 9: EW ngang
];

export const CIRCUIT_SIZE = 4;

/**
 * Xoay bitmask 90° theo chiều kim đồng hồ dir lần: N→E→S→W→N. (copy server)
 * Per-bit (không dịch bit): thứ tự bit N,E,S,W = 2,1,3,0 KHÔNG theo vòng tròn
 * nên dịch trái làm ống NE quay thành NS (không phải xoay hình học).
 */
function rotateMask(mask: number, dir: number): number {
  let m = mask;
  const d = ((dir % 4) + 4) % 4;
  for (let i = 0; i < d; i++) {
    let r = 0;
    if (m & 0b0100) r |= 0b0010; // N→E
    if (m & 0b0010) r |= 0b1000; // E→S
    if (m & 0b1000) r |= 0b0001; // S→W
    if (m & 0b0001) r |= 0b0100; // W→N
    m = r;
  }
  return m;
}

/** Mask kết nối hiển thị của cell shape ở rotation rot. (copy server) */
export function circuitCellMask(shape: number, rot: number): number {
  const base = CIRCUIT_SHAPE_MASKS[shape] ?? 0;
  return rotateMask(base, rot);
}

/** UX hint: đường nối A(0,0)→B(3,3) đã liền? (copy validateCircuit server — KHÔNG authoritative) */
export function circuitSolvedClient(attempt: number[], shapes: number[]): boolean {
  if (attempt.length !== CIRCUIT_SIZE * CIRCUIT_SIZE) return false;
  if (shapes.length !== attempt.length) return false;
  const masks = attempt.map((r, i) => circuitCellMask(shapes[i], r));
  const maskAt = (x: number, y: number) => masks[y * CIRCUIT_SIZE + x];
  const seen = new Set<number>([0]);
  const stack = [0];
  const dirs: [number, number, number, number][] = [
    [0, -1, 0b0100, 0b1000], // N↔S
    [1, 0, 0b0010, 0b0001], // E↔W
    [0, 1, 0b1000, 0b0100],
    [-1, 0, 0b0001, 0b0010],
  ];
  while (stack.length) {
    const cur = stack.pop()!;
    const cx = cur % CIRCUIT_SIZE;
    const cy = Math.floor(cur / CIRCUIT_SIZE);
    for (const [dx, dy, bitFrom, bitTo] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= CIRCUIT_SIZE || ny >= CIRCUIT_SIZE) continue;
      const ni = ny * CIRCUIT_SIZE + nx;
      if (seen.has(ni)) continue;
      if ((maskAt(cx, cy) & bitFrom) && (maskAt(nx, ny) & bitTo)) {
        if (ni === CIRCUIT_SIZE * CIRCUIT_SIZE - 1) return true;
        seen.add(ni);
        stack.push(ni);
      }
    }
  }
  return false;
}

/** Click cell i → rotation +1 (mod 4). */
export function circuitRotateCell(rot: number[], i: number): number[] {
  return rot.map((r, j) => (j === i ? (r + 1) % 4 : r));
}

// ===== Lock-rotate =====

/** Click vòng i → offset +1 (mod size[i]). */
export function lockRotateRing(offsets: number[], i: number, sizes: number[]): number[] {
  return offsets.map((o, j) => (j === i ? (o + 1) % sizes[j] : o));
}

/** Mọi vòng về 0 — thắng (mirror validateLockRotate server). */
export function lockRotateSolved(offsets: number[], sizes: number[]): boolean {
  return offsets.every((o, i) => ((o % sizes[i]) + sizes[i]) % sizes[i] === 0);
}

// ===== Jigsaw =====

export const JIGSAW_SIZE = 4;

/** Swap 2 ô (chọn ô i rồi ô j). */
export function jigsawSwap(perm: number[], i: number, j: number): number[] {
  const next = [...perm];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** Mảnh i về đúng ô i (mirror validateJigsaw server). */
export function jigsawSolved(perm: number[]): boolean {
  return perm.length === JIGSAW_SIZE * JIGSAW_SIZE && perm.every((v, i) => v === i);
}
