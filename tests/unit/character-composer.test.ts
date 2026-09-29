// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  composeCharacter,
  variantKey,
  invalidateVariant,
  __resetForTest,
  type CharacterSelection,
} from "../../src/lib/game/assets/character-composer";
import { TILE_SIZE } from "../../src/lib/game/constants";

const SEL: CharacterSelection = { skin: "s1", hair: "h1", clothes: "c1", eyes: "e1" };

describe("CharacterComposer (skeleton)", () => {
  beforeEach(() => __resetForTest());

  it("compose trả canvas kích thước đúng (4 hướng × 4 frame × TILE_SIZE)", () => {
    const sheet = composeCharacter(SEL, TILE_SIZE);
    expect(sheet.canvas.width).toBe(4 * TILE_SIZE);
    expect(sheet.canvas.height).toBe(4 * TILE_SIZE);
  });

  it("variantKey ổn định + duy nhất theo selection", () => {
    const k1 = variantKey(SEL);
    const k2 = variantKey({ ...SEL, hair: "h2" });
    expect(k1).not.toBe(k2);
    expect(variantKey(SEL)).toBe(k1);
  });

  it("cache: compose cùng selection trả cùng object (không vẽ lại)", () => {
    const a = composeCharacter(SEL, TILE_SIZE);
    const b = composeCharacter(SEL, TILE_SIZE);
    expect(a).toBe(b);
  });

  it("invalidateVariant xóa cache → compose trả object mới", () => {
    const a = composeCharacter(SEL, TILE_SIZE);
    invalidateVariant(SEL);
    const b = composeCharacter(SEL, TILE_SIZE);
    expect(a).not.toBe(b);
  });
});
