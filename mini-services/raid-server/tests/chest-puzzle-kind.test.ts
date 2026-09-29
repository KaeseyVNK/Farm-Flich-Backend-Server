import { describe, it, expect } from "bun:test";
import { chestPuzzleKind, type PuzzleKind } from "../src/chest-puzzle-kind";
import { genCircuit, validateCircuit, solvedRotations } from "../src/puzzle-circuit";
import { genLockRotate, validateLockRotate } from "../src/puzzle-lock-rotate";
import { genJigsaw, validateJigsaw } from "../src/puzzle-jigsaw";

const TIER: Record<string, PuzzleKind[]> = {
  wood: ["memory", "circuit"],
  iron: ["timing", "lock-rotate"],
  safe: ["sequence", "jigsaw"],
};

describe("chestPuzzleKind", () => {
  it("deterministic — cùng sessionId+chestId luôn cùng kind", () => {
    for (let i = 0; i < 20; i++) {
      const chestId = `c${i}`;
      const a = chestPuzzleKind("iron", "sess", chestId);
      const b = chestPuzzleKind("iron", "sess", chestId);
      expect(a).toBe(b);
    }
  });

  it("mỗi tier chỉ ra 1 trong 2 puzzle của tier đó", () => {
    for (const [tier, kinds] of Object.entries(TIER)) {
      for (let i = 0; i < 60; i++) {
        const k = chestPuzzleKind(tier, "sess", `c${i}`);
        expect(kinds).toContain(k);
      }
    }
  });

  it("cả 2 puzzle mỗi tier đều xuất hiện (không lệch hẳn 1 kind)", () => {
    for (const [tier, kinds] of Object.entries(TIER)) {
      const seen = new Set<string>();
      for (let i = 0; i < 60; i++) seen.add(chestPuzzleKind(tier, "sess", `c${i}`));
      expect([...seen].sort()).toEqual([...kinds].sort());
    }
  });

  it("kind lạ (unknown chest) fallback tier wood", () => {
    const k = chestPuzzleKind("diamond", "sess", "c1");
    expect(["memory", "circuit"]).toContain(k);
  });
});

describe("puzzle wiring — gen/validate cùng seed index.ts dùng", () => {
  // index.ts gen bằng seed `sessionId + ":" + chestId` — cùng seed phải
  // reproduce cùng puzzle ở interact lẫn validate.
  it("circuit: gen lại cùng seed → validate nghiệm thắng", () => {
    const seed = "sess:chest-9";
    const pz = genCircuit(seed);
    const again = genCircuit(seed);
    expect(again.shapes).toEqual(pz.shapes);
    expect(again.startRot).toEqual(pz.startRot);
    expect(validateCircuit(solvedRotations(), pz.shapes)).toBe(true);
  });

  it("lock-rotate: offset gen ≠ toàn 0, xoay về 0 thắng", () => {
    const pz = genLockRotate("sess:chest-9");
    expect(pz.offsets.every((o) => o !== 0)).toBe(true);
    expect(validateLockRotate([0, 0, 0])).toBe(true);
    expect(validateLockRotate(pz.offsets)).toBe(false);
  });

  it("jigsaw: perm gen ≠ identity, submit identity thắng", () => {
    const perm = genJigsaw("sess:chest-9");
    expect(perm.some((p, i) => p !== i)).toBe(true);
    expect(validateJigsaw([...Array(16).keys()])).toBe(true);
    expect(validateJigsaw(perm)).toBe(false);
  });
});
