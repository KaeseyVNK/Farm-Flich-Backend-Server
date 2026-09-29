import { describe, it, expect } from "vitest";
import {
  CIRCUIT_SHAPE_MASKS,
  CIRCUIT_SIZE,
  circuitCellMask,
  circuitRotateCell,
  circuitSolvedClient,
  jigsawSolved,
  jigsawSwap,
  lockRotateRing,
  lockRotateSolved,
} from "@/lib/raid/puzzle-extra-interactions";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Sync-check: client copy phải giống hệt server. mini-services là process riêng
// (tsconfig root không include, KHÔNG import runtime) → test đọc file server và
// so literal bảng mask bằng số.
function serverShapeMasks(): number[] {
  const f = readFileSync(
    join(process.cwd(), "mini-services/raid-server/src/puzzle-circuit.ts"),
    "utf8",
  );
  const m = f.match(/SHAPE_TABLE: number\[\] = \[([\s\S]*?)\];/);
  if (!m) throw new Error("SHAPE_TABLE không tìm thấy ở server puzzle-circuit.ts");
  return [...m[1].matchAll(/0b[01]{4}/g)].map((x) => parseInt(x[0].slice(2), 2));
}

// Nghiệm circuit thật (layout snake server): rotation toàn 0.
const SOLVED_SHAPES = [1, 9, 9, 6, 5, 9, 9, 7, 4, 9, 9, 6, 9, 9, 9, 0];

describe("puzzle-extra-interactions — lock-rotate", () => {
  const sizes = [4, 6, 8];
  it("xoay vòng i chỉ tăng offset i (wrap mod size)", () => {
    expect(lockRotateRing([3, 0, 7], 0, sizes)).toEqual([0, 0, 7]);
    expect(lockRotateRing([0, 5, 0], 1, sizes)).toEqual([0, 0, 0]);
    expect(lockRotateRing([1, 2, 3], 2, sizes)).toEqual([1, 2, 4]);
  });
  it("solved khi mọi vòng về 0 — khớp validateLockRotate server", () => {
    expect(lockRotateSolved([0, 0, 0], sizes)).toBe(true);
    expect(lockRotateSolved([4, 6, 8], sizes)).toBe(true); // full vòng = 0 mod size
    expect(lockRotateSolved([0, 1, 0], sizes)).toBe(false);
    // Full vòng (4/6/8) cũng thắng — mod size, không chỉ literal 0
    expect(lockRotateSolved([4, 6, 8], sizes)).toBe(true);
  });
});

describe("puzzle-extra-interactions — circuit", () => {
  it("click cell i → rotation +1 mod 4, cell khác giữ nguyên", () => {
    expect(circuitRotateCell([0, 3, 1], 1)).toEqual([0, 0, 1]);
    expect(circuitRotateCell([0, 0, 0], 0)).toEqual([1, 0, 0]);
  });
  it("client bảng mask sync với server (đọc file — chống drift)", () => {
    expect(CIRCUIT_SHAPE_MASKS).toEqual(serverShapeMasks());
  });
  it("cellMask xoay đúng hướng (N→E→S→W mỗi click)", () => {
    expect(circuitCellMask(0, 0) & 0b0100).not.toBe(0); // shape N, rot 0 → N
    expect(circuitCellMask(0, 1) & 0b0010).not.toBe(0); // rot 1 → E
    expect(circuitCellMask(0, 2) & 0b1000).not.toBe(0); // rot 2 → S
    expect(circuitCellMask(0, 3) & 0b0001).not.toBe(0); // rot 3 → W
  });
  it("layout snake nghiệm (rot toàn 0): client-hint thắng", () => {
    expect(circuitSolvedClient(zero(), SOLVED_SHAPES)).toBe(true);
  });
  it("xoay 1 cell giữa đường → đứt mạch (client-hint thua)", () => {
    const broken = circuitRotateCell(zero(), 1); // cell(1,0) là ống ngang
    expect(circuitSolvedClient(broken, SOLVED_SHAPES)).toBe(false);
  });
  it("toàn bảng xoay đều 1-3 lần → không thắng (filler cắt đường A→B)", () => {
    expect(circuitSolvedClient(allRot(1), SOLVED_SHAPES)).toBe(false);
    expect(circuitSolvedClient(allRot(2), SOLVED_SHAPES)).toBe(false);
    expect(circuitSolvedClient(allRot(3), SOLVED_SHAPES)).toBe(false);
  });
});

describe("puzzle-extra-interactions — jigsaw", () => {
  it("swap 2 ô đổi mảnh, không đột biến mảng gốc", () => {
    const perm = [1, 0, 2, 3];
    const next = jigsawSwap(perm, 0, 1);
    expect(next).toEqual([0, 1, 2, 3]);
    expect(perm).toEqual([1, 0, 2, 3]);
  });
  it("solved = identity; sai 1 cặp ô → thua", () => {
    const id = Array.from({ length: 16 }, (_, i) => i);
    expect(jigsawSolved(id)).toBe(true);
    const shuffled = [...id];
    [shuffled[0], shuffled[5]] = [shuffled[5], shuffled[0]];
    expect(jigsawSolved(shuffled)).toBe(false);
  });
});

function zero(): number[] {
  return new Array(CIRCUIT_SIZE * CIRCUIT_SIZE).fill(0);
}
function allRot(r: number): number[] {
  return new Array(CIRCUIT_SIZE * CIRCUIT_SIZE).fill(r);
}
function mixed(): number[] {
  return zero().map((_, i) => i % 4);
}
