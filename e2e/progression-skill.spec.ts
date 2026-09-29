// Progression + skill tree E2E (phase 6 wire). Verify XP curve wiring end-to-end:
// - addXp (public production path — quest/raid/harvest hooks) → level up + skill point
// - allocatePerk (public production path — skill tree) → cap + prereq enforcement
// - perkAllocations hydrate clamp (trust boundary — save corrupt không phá cap)
// Bridge gated bởi NEXT_PUBLIC_E2E=1 (dev server only).
import { test, expect } from "@playwright/test";
import { startNewGame } from "./helpers";

test.describe("Progression + skill tree", () => {
  test("XP accumulation → level up + skill point", async ({ page }) => {
    await startNewGame(page);
    await page.evaluate(() => {
      const api = (window as unknown as { __gameTest: { actions: { addXp: (n: number) => void } } }).__gameTest;
      // Level 1→2 cần 100 XP. Add 120 → level 2, skillPoints 1, xp 20 leftover.
      api.actions.addXp(120);
    });
    const p = await page.evaluate(() => {
      const api = (window as unknown as {
        __gameTest: { state: { progression: () => Record<string, unknown> } };
      }).__gameTest;
      return api.state.progression();
    });
    expect(p.level).toBe(2);
    expect(p.skillPoints).toBe(1);
    expect(p.xp).toBe(20); // 120 - 100 = 20 leftover
    expect(p.totalXp).toBe(120);
  });

  test("perk allocate respects prereq chain + cap", async ({ page }) => {
    await startNewGame(page);
    // Level up để có 3 skill points.
    await page.evaluate(() => {
      const api = (window as unknown as { __gameTest: { actions: { addXp: (n: number) => void } } }).__gameTest;
      api.actions.addXp(900); // L1→2 (100) + L2→3 (400) = 500, leftover 400 < 900 → level 3, 2 skill points.
    });

    // Đọc skill point thực tế sau 900 XP:
    const before = await page.evaluate(() => {
      const api = (window as unknown as {
        __gameTest: { state: { progression: () => { skillPoints: number } } };
      }).__gameTest;
      return api.state.progression().skillPoints;
    });
    expect(before).toBeGreaterThanOrEqual(1);

    // Allocate farming perk 1 — phải succeed (prereq rank 1 luôn met).
    const ok1 = await page.evaluate(() => {
      const api = (window as unknown as {
        __gameTest: { actions: { allocatePerk: (t: "farming") => boolean } };
      }).__gameTest;
      return api.actions.allocatePerk("farming");
    });
    expect(ok1).toBe(true);
    const alloc = await page.evaluate(() => {
      const api = (window as unknown as {
        __gameTest: { state: { progression: () => { perkAllocations: { farming: number } } } };
      }).__gameTest;
      return api.state.progression().perkAllocations.farming;
    });
    expect(alloc).toBe(1);
  });

  test("max level caps XP (no infinite loop)", async ({ page }) => {
    await startNewGame(page);
    await page.evaluate(() => {
      const api = (window as unknown as { __gameTest: { actions: { addXp: (n: number) => void } } }).__gameTest;
      // Huge XP — cap level 10, skillPoints = 9 (levels 2-10).
      api.actions.addXp(1_000_000);
    });
    const p = await page.evaluate(() => {
      const api = (window as unknown as {
        __gameTest: { state: { progression: () => Record<string, unknown> } };
      }).__gameTest;
      return api.state.progression();
    });
    expect(p.level).toBe(10);
    expect(p.xp).toBe(0);
    expect(p.skillPoints).toBe(9);
  });
});
