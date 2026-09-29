/**
 * W8 review fixes — festivalStore (cook-off cap 3 cumulative + session sống
 * qua unmount) + puzzleScore balance (10đ/lượt).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { useFestivalStore } from "@/store/festivalStore";
import { puzzleScore, PUZZLE_SCORE_PER_SOLVE, COOKOFF_MAX_DISHES } from "@/lib/game/festival/festival-scoring";

beforeEach(() => {
  useFestivalStore.getState().reset();
});

describe("festivalStore cook-off cap (review HIGH)", () => {
  it("chỉ nhận đúng 3 món/ngày — món thứ 4 bị từ chối", () => {
    const s = useFestivalStore.getState();
    expect(s.submitCookoffDish(20)).toBe(true);
    expect(s.submitCookoffDish(35)).toBe(true);
    expect(s.submitCookoffDish(75)).toBe(true);
    const st = useFestivalStore.getState();
    expect(st.cookoffDishes).toBe(3);
    expect(st.cookoffScore).toBe(130);
    expect(st.submitCookoffDish(20)).toBe(false);
    expect(useFestivalStore.getState().cookoffDishes).toBe(3); // không đổi
    expect(useFestivalStore.getState().cookoffScore).toBe(130);
  });

  it("điểm cộng dồn đúng từng món (từng lượt nộp — không bị reset)", () => {
    useFestivalStore.getState().submitCookoffDish(20);
    useFestivalStore.getState().submitCookoffDish(35);
    expect(useFestivalStore.getState().cookoffScore).toBe(55);
  });
});

describe("festivalStore syncDay (session reset khi đổi ngày)", () => {
  it("đổi dayKey reset cook-off + puzzle về 0", () => {
    const s = useFestivalStore.getState();
    s.syncDay(1, "Spring", 13);
    s.submitCookoffDish(75);
    s.solvePuzzle();
    useFestivalStore.getState().syncDay(1, "Spring", 14);
    const st = useFestivalStore.getState();
    expect(st.dayKey).toBe("1_Spring_14");
    expect(st.cookoffDishes).toBe(0);
    expect(st.cookoffScore).toBe(0);
    expect(st.puzzleSolved).toBe(0);
  });

  it("cùng ngày — syncDay idempotent (không reset giữa chừng)", () => {
    useFestivalStore.getState().syncDay(1, "Spring", 13);
    useFestivalStore.getState().submitCookoffDish(20);
    useFestivalStore.getState().syncDay(1, "Spring", 13);
    expect(useFestivalStore.getState().cookoffScore).toBe(20);
  });

  it("đổi mùa/ngày lễ khác là session khác", () => {
    useFestivalStore.getState().syncDay(1, "Spring", 13);
    useFestivalStore.getState().submitCookoffDish(20);
    useFestivalStore.getState().syncDay(1, "Summer", 13);
    expect(useFestivalStore.getState().cookoffScore).toBe(0);
  });
});

describe("puzzleScore balance (review MEDIUM)", () => {
  it("10đ/lượt — gold 200 đạt trong 20 lượt (không phải 100)", () => {
    expect(PUZZLE_SCORE_PER_SOLVE).toBe(10);
    expect(puzzleScore(3)).toBe(30); // bronze
    expect(puzzleScore(10)).toBe(100); // silver
    expect(puzzleScore(20)).toBe(200); // gold
    expect(puzzleScore(0)).toBe(0);
    expect(puzzleScore(-5)).toBe(0); // guard
  });

  it("solvePuzzle tăng lượt — điểm theo puzzleScore", () => {
    useFestivalStore.getState().solvePuzzle();
    useFestivalStore.getState().solvePuzzle();
    const st = useFestivalStore.getState();
    expect(st.puzzleSolved).toBe(2);
    expect(puzzleScore(st.puzzleSolved)).toBe(20);
  });

  it("COOKOFF_MAX_DISHES = 3 — khớp thiết kế §14", () => {
    expect(COOKOFF_MAX_DISHES).toBe(3);
  });
});
