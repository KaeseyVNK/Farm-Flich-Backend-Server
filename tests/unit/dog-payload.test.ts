// W7b-P2 — validateDogPayload (breed/tile/level/patrol bounds).
import { describe, expect, it } from "vitest";
import { validateDogPayload } from "@/lib/raid/defense-config-service";
import { MAP_SIZE, MAP_COLS, MAP_ROWS } from "@/lib/raid/constants";

describe("validateDogPayload", () => {
  const ok = { breed: "hound", tile: 100, level: 2, patrol: [{ x: 1, y: 1 }, { x: 5, y: 5 }] };
  it("payload hợp lệ → true", () => {
    expect(validateDogPayload(ok, MAP_SIZE)).toBe(true);
    expect(validateDogPayload({ breed: "retriever", tile: 0, level: 1 }, MAP_SIZE)).toBe(true);
  });
  it("breed lạ → false", () => {
    expect(validateDogPayload({ ...ok, breed: "ufo" }, MAP_SIZE)).toBe(false);
  });
  it("tile OOB / level sai → false", () => {
    expect(validateDogPayload({ ...ok, tile: MAP_SIZE }, MAP_SIZE)).toBe(false);
    expect(validateDogPayload({ ...ok, tile: -1 }, MAP_SIZE)).toBe(false);
    expect(validateDogPayload({ ...ok, level: 4 }, MAP_SIZE)).toBe(false);
  });
  it("patrol 2-6 điểm trong 30×22 — ngoài/không đủ → false", () => {
    expect(validateDogPayload({ ...ok, patrol: [{ x: 0, y: 0 }] }, MAP_SIZE)).toBe(false); // 1 điểm
    expect(
      validateDogPayload({ ...ok, patrol: Array.from({ length: 7 }, (_, i) => ({ x: i, y: 0 })) }, MAP_SIZE),
    ).toBe(false); // 7 điểm
    expect(validateDogPayload({ ...ok, patrol: [{ x: MAP_COLS, y: 0 }, { x: 0, y: 0 }] }, MAP_SIZE)).toBe(false);
    expect(validateDogPayload({ ...ok, patrol: [{ x: 0, y: MAP_ROWS }, { x: 0, y: 0 }] }, MAP_SIZE)).toBe(false);
  });
});
