import { describe, it, expect } from "bun:test";
import { genMemorySeq, validateMemory, WOOD_MEMORY_LEN } from "../src/puzzle";

describe("genMemorySeq (deterministic từ seed)", () => {
  it("cùng seed → cùng seq", () => {
    expect(genMemorySeq("farm1:chest2:raid3")).toEqual(genMemorySeq("farm1:chest2:raid3"));
  });
  it("khác seed → (gần như chắc chắn) khác seq", () => {
    // xác suất va chạm 2 seq len-3 random < 1/64; chạy vài seed
    const a = genMemorySeq("seed-a");
    const b = genMemorySeq("seed-b");
    expect(a).not.toEqual(b);
  });
  it("độ dài đúng + giá trị trong [0,4)", () => {
    const seq = genMemorySeq("any");
    expect(seq).toHaveLength(WOOD_MEMORY_LEN);
    expect(seq.every((v) => v >= 0 && v < 4)).toBe(true);
  });
});

describe("validateMemory", () => {
  it("đúng full seq → true", () => {
    expect(validateMemory([1, 3, 0], [1, 3, 0])).toBe(true);
  });
  it("sai 1 vị trí → false", () => {
    expect(validateMemory([1, 3, 0], [1, 2, 0])).toBe(false);
  });
  it("khác độ dài → false", () => {
    expect(validateMemory([1, 3, 0], [1, 3])).toBe(false);
  });
});
