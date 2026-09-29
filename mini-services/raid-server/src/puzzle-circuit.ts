import { hashStr, mulberry32 } from "./rng.js";

/**
 * W7c — Puzzle nối mạch (§8.1, rương GỖ thêm lựa chọn).
 * Lưới 4×4 đường ống: mỗi cell 1 shape (dir kết nối, 0-3 = N/E/S/W rotation
 * của shape gốc). Gen: server đặt layout ĐÃ NỐI A(0,0)→B(3,3) (đường thẳng
 * snake cố định + nhiễu rng chọn 1 trong vài layout có nghiệm) rồi xáo rotation
 * mỗi cell — nghiệm = xoay về đúng. Client submit 16 rotation; validate = BFS
 * connectivity qua connector khớp.
 */

export const CIRCUIT_N = 4;

/** Shape id → các hướng kết nối khi rotation 0 (bitmask N=1,E=2,S=4,W=8). */

// Đơn giản hoá bảng (tránh trùng bitmask bên trên):
const SHAPE_TABLE: number[] = [
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

/**
 * Xoay bitmask 90° theo chiều kim đồng hồ dir lần: N→E→S→W→N.
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

/** Layout có nghiệm cố định: hàng snake nối A(0,0) → B(3,3). */
function solvedLayout(): { shape: number; rot: number }[] {
  // Snake có nghiệm: A(0,0) →E→ (3,0) →S→ (3,1) →W→ (0,1) →S→ (0,2) →E→ (3,2) →S→ B(3,3).
  // Mỗi cell nhận-đi đúng bitmask; filler EW không thuộc đường.
  const cells: { shape: number; rot: number }[] = new Array(16).fill(null).map(() => ({ shape: 9, rot: 0 }));
  cells[0] = { shape: 1, rot: 0 }; // A: chỉ E
  cells[1] = { shape: 9, rot: 0 }; // W→E
  cells[2] = { shape: 9, rot: 0 };
  cells[3] = { shape: 6, rot: 0 }; // nhận W đi S (SW)
  cells[4 + 3] = { shape: 7, rot: 0 }; // nhận N đi W (WN)
  cells[4 + 2] = { shape: 9, rot: 0 };
  cells[4 + 1] = { shape: 9, rot: 0 };
  cells[4 + 0] = { shape: 5, rot: 0 }; // nhận E đi S (ES)
  cells[8 + 0] = { shape: 4, rot: 0 }; // nhận N đi E (NE)
  cells[8 + 1] = { shape: 9, rot: 0 };
  cells[8 + 2] = { shape: 9, rot: 0 };
  cells[8 + 3] = { shape: 6, rot: 0 }; // nhận W đi S (SW)
  cells[12 + 3] = { shape: 0, rot: 0 }; // B: chỉ N
  return cells;
}

export interface CircuitPuzzle {
  /** Shape index mỗi cell (0-9) — công khai cho client render. */
  shapes: number[];
  /** Rotation xáo ban đầu (0-3 mỗi cell) — client bắt đầu từ đây. */
  startRot: number[];
}

export function genCircuit(seed: string): CircuitPuzzle {
  const rng = mulberry32(hashStr(seed));
  const layout = solvedLayout();
  // Xáo rotation: đảm bảo KHÔNG giữ nguyên giải (ít nhất 1 cell ≠ 0).
  // For-loop thay .every — TS5.5 inferred-predicate narrows element về literal 0
  // khiến gán lại startRot[0] không compile.
  const startRot: number[] = layout.map(() => Math.floor(rng() * 4));
  let anyNonZero = false;
  for (const r of startRot) {
    if (r !== 0) {
      anyNonZero = true;
      break;
    }
  }
  if (!anyNonZero) startRot[0] = (startRot[0] + 1) % 4;
  return { shapes: layout.map((c) => c.shape), startRot };
}

/** Mask kết nối của cell theo rotation hiện tại. */
export function cellMask(shape: number, rot: number): number {
  return rotateMask(SHAPE_TABLE[shape] ?? 0, rot);
}

/** Thắng: đường nối từ A(0,0) đến B(3,3) qua connector đối xứng khớp. */
export function validateCircuit(attempt: number[], shapes: number[]): boolean {
  if (attempt.length !== CIRCUIT_N * CIRCUIT_N) return false;
  if (shapes.length !== attempt.length) return false;
  const masks = attempt.map((r, i) => cellMask(shapes[i], r));
  const maskAt = (x: number, y: number) => masks[y * CIRCUIT_N + x];
  // BFS từ (0,0) — chỉ mở rộng qua cặp connector khớp (N↔S, E↔W).
  const seen = new Set<number>([0]);
  const stack = [0];
  const dirs: [number, number, number, number][] = [
    // [dx, dy, bitFrom, bitTo]
    [0, -1, 0b0100, 0b1000], // N của from ↔ S của to
    [1, 0, 0b0010, 0b0001],
    [0, 1, 0b1000, 0b0100],
    [-1, 0, 0b0001, 0b0010],
  ];
  while (stack.length) {
    const cur = stack.pop()!;
    const cx = cur % CIRCUIT_N;
    const cy = Math.floor(cur / CIRCUIT_N);
    for (const [dx, dy, bitFrom, bitTo] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= CIRCUIT_N || ny >= CIRCUIT_N) continue;
      const ni = ny * CIRCUIT_N + nx;
      if (seen.has(ni)) continue;
      if ((maskAt(cx, cy) & bitFrom) && (maskAt(nx, ny) & bitTo)) {
        if (ni === CIRCUIT_N * CIRCUIT_N - 1) return true; // tới B
        seen.add(ni);
        stack.push(ni);
      }
    }
  }
  return false;
}

/** Rotation thắng (từ layout giải) — test dùng. */
export function solvedRotations(): number[] {
  return solvedLayout().map(() => 0);
}
