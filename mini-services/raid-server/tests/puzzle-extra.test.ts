import { describe, it, expect } from "bun:test";
import { genLockRotate, validateLockRotate, LOCK_RING_SIZES } from "../src/puzzle-lock-rotate.js";
import { genCircuit, validateCircuit, solvedRotations } from "../src/puzzle-circuit.js";
import { genJigsaw, validateJigsaw } from "../src/puzzle-jigsaw.js";

describe("W7c lock-rotate", () => {
  it("gen không sẵn thắng, offsets hợp lệ chu kỳ", () => {
    for (const seed of ["a", "b", "c"]) {
      const { offsets, sizes } = genLockRotate(seed);
      expect(sizes).toEqual(LOCK_RING_SIZES);
      expect(validateLockRotate(offsets)).toBe(false);
      offsets.forEach((o, i) => {
        expect(o).toBeGreaterThanOrEqual(0);
        expect(o).toBeLessThan(LOCK_RING_SIZES[i]);
      });
    }
  });
  it("validate: mọi vòng về 0 (kể cả xoay thừa vòng mod size)", () => {
    expect(validateLockRotate([0, 0, 0])).toBe(true);
    expect(validateLockRotate([4, 6, 8])).toBe(true);
    expect(validateLockRotate([0, 0, 1])).toBe(false);
    expect(validateLockRotate([0, 0])).toBe(false);
  });
});

describe("W7c circuit", () => {
  it("layout giải (rotation 0 toàn bộ) thắng", () => {
    const p = genCircuit("seed1");
    expect(validateCircuit(solvedRotations(), p.shapes)).toBe(true);
  });
  it("gen xáo không sẵn thắng (đa số seed)", () => {
    let anyUnsolved = false;
    for (let i = 0; i < 10; i++) {
      const p = genCircuit("s" + i);
      if (!validateCircuit(p.startRot, p.shapes)) anyUnsolved = true;
    }
    expect(anyUnsolved).toBe(true);
  });
  it("attempt sai độ dài → false", () => {
    const p = genCircuit("x");
    expect(validateCircuit([0, 0, 0], p.shapes)).toBe(false);
  });
});

describe("W7c jigsaw", () => {
  it("gen là hoán vị 16 phần tử, không identity", () => {
    const perm = genJigsaw("seed9");
    expect([...perm].sort((a, b) => a - b)).toEqual(Array.from({ length: 16 }, (_, i) => i));
    expect(validateJigsaw(perm)).toBe(false);
  });
  it("identity thắng; sai 1 ô thua; sai độ dài thua", () => {
    expect(validateJigsaw(Array.from({ length: 16 }, (_, i) => i))).toBe(true);
    const almost = Array.from({ length: 16 }, (_, i) => i);
    const t = almost[3];
    almost[3] = almost[4];
    almost[4] = t;
    expect(validateJigsaw(almost)).toBe(false);
    expect(validateJigsaw([0, 1, 2])).toBe(false);
  });
  it("gen deterministic cùng seed (replay)", () => {
    expect(genJigsaw("same")).toEqual(genJigsaw("same"));
  });
});
