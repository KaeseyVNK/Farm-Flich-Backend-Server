import { describe, it, expect } from "bun:test";
import {
  genSequence,
  validateSequence,
  withinDeadline,
  SAFE_SEQ_LEN,
  SEQ_BUTTONS,
} from "../src/puzzle-sequence";

describe("genSequence", () => {
  it("deterministic — cùng seed+chestId → cùng seq", () => {
    expect(genSequence("s1", "c1")).toEqual(genSequence("s1", "c1"));
  });
  it("độ dài SAFE_SEQ_LEN, mỗi phần tử < SEQ_BUTTONS", () => {
    const seq = genSequence("s", "c");
    expect(seq.length).toBe(SAFE_SEQ_LEN);
    expect(seq.every((v) => v >= 0 && v < SEQ_BUTTONS)).toBe(true);
  });
});

describe("validateSequence", () => {
  it("đúng thứ tự + độ dài → true", () => {
    expect(validateSequence([0, 2, 1, 3], [0, 2, 1, 3])).toBe(true);
  });
  it("sai thứ tự → false", () => {
    expect(validateSequence([0, 2, 1, 3], [0, 1, 2, 3])).toBe(false);
  });
  it("khác độ dài → false", () => {
    expect(validateSequence([0, 2, 1, 3], [0, 2, 1])).toBe(false);
  });
});

describe("withinDeadline", () => {
  it("trong deadline → true", () => {
    expect(withinDeadline(1000, 5000, 4000)).toBe(true);
  });
  it("hết deadline → false", () => {
    expect(withinDeadline(1000, 5000, 7000)).toBe(false);
  });
});
