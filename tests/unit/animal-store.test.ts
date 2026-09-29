import { describe, expect, it, beforeEach } from "vitest";
import { ANIMAL_PRODUCT, useAnimalStore } from "@/store/animalStore";

// Phase 3 hayday: livestock gated theo level — STARTER rỗng, syncForLevel spawn.
// gà lv3 (hen-1/hen-2), bò lv4 (cow-1). Không spawn duck.
describe("animalStore", () => {
  beforeEach(() => {
    useAnimalStore.getState().reset();
  });

  it("reset → 0 livestock (phút 1 không có gà)", () => {
    expect(useAnimalStore.getState().animals.length).toBe(0);
  });

  it("syncForLevel(1) → vẫn 0", () => {
    useAnimalStore.getState().syncForLevel(1);
    expect(useAnimalStore.getState().animals.length).toBe(0);
  });

  it("syncForLevel(3) → hen-1 + hen-2 đúng tọa độ barnyard", () => {
    useAnimalStore.getState().syncForLevel(3);
    const animals = useAnimalStore.getState().animals;
    expect(animals.length).toBe(2);
    const hen1 = animals.find((a) => a.id === "hen-1");
    const hen2 = animals.find((a) => a.id === "hen-2");
    expect(hen1?.kind).toBe("chicken");
    expect(hen1?.tx).toBe(25);
    expect(hen1?.ty).toBe(8);
    expect(hen2?.tx).toBe(26);
    expect(hen2?.ty).toBe(9);
  });

  it("syncForLevel gọi lại không duplicate", () => {
    useAnimalStore.getState().syncForLevel(3);
    useAnimalStore.getState().syncForLevel(3);
    expect(useAnimalStore.getState().animals.length).toBe(2);
  });

  it("syncForLevel(4) thêm cow-1 (giữ 2 gà)", () => {
    useAnimalStore.getState().syncForLevel(3);
    useAnimalStore.getState().syncForLevel(4);
    const animals = useAnimalStore.getState().animals;
    expect(animals.length).toBe(3);
    const cow = animals.find((a) => a.id === "cow-1");
    expect(cow?.kind).toBe("cow");
    expect(cow?.tx).toBe(24);
    expect(cow?.ty).toBe(6);
    expect(animals.some((a) => a.kind === "duck")).toBe(false);
  });

  it("hydrate([]) set empty (bỏ early-return)", () => {
    useAnimalStore.getState().syncForLevel(3);
    useAnimalStore.getState().hydrate({ animals: [] });
    expect(useAnimalStore.getState().animals.length).toBe(0);
  });

  it("feed once per day, product sáng hôm sau (sau syncForLevel)", () => {
    useAnimalStore.getState().syncForLevel(4);
    expect(useAnimalStore.getState().feed("hen-1")).toBe(true);
    expect(useAnimalStore.getState().feed("hen-1")).toBe(false);
    useAnimalStore.getState().newDay();
    const hen = useAnimalStore.getState().animals.find((a) => a.id === "hen-1");
    expect(hen?.hasProduct).toBe(true);
    expect(useAnimalStore.getState().collect("hen-1")).toBe(ANIMAL_PRODUCT.chicken);
    expect(useAnimalStore.getState().collect("hen-1")).toBeNull();
  });

  it("unfed animals do not produce", () => {
    useAnimalStore.getState().syncForLevel(4);
    useAnimalStore.getState().newDay();
    expect(useAnimalStore.getState().collect("cow-1")).toBeNull();
  });
});
