import { describe, it, expect } from "bun:test";
import { DOG_BREEDS, breedById, breedStats } from "../src/dog-catalog.js";

/** W7b-P1 — 5 giống stats khác nhau thật (§10.1). */
describe("dog-catalog", () => {
  it("5 giống: retriever/hound/shepherd/corgi/maan", () => {
    expect(DOG_BREEDS.map((b) => b.id)).toEqual(["retriever", "hound", "shepherd", "corgi", "maan"]);
  });
  it("stats khác nhau thật — hound hearing+2, shepherd speed 1.2, maan lureImmune + alertBonus", () => {
    expect(breedStats("hound").hearingAdd).toBe(2);
    expect(breedStats("shepherd").speedMul).toBe(1.2);
    expect(breedStats("maan").lureImmune).toBe(true);
    expect(breedStats("maan").alertSeeBonus).toBe(12);
    expect(breedById("corgi")!.squeeze).toBe(true); // squeeze trên Breed (stats không mang)
    expect(breedStats("retriever").speedMul).toBe(1);
  });
  it("breed lạ → retriever default (an toàn)", () => {
    expect(breedStats("ufo").speedMul).toBe(breedStats("retriever").speedMul);
    expect(breedById("ufo")).toBeUndefined();
  });
  it("giá tăng theo sức (maan đắt nhất)", () => {
    const maan = breedById("maan")!;
    for (const b of DOG_BREEDS) expect(b.price).toBeLessThanOrEqual(maan.price);
  });
});
