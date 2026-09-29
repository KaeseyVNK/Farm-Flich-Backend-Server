import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Regression guard (phase 3): RaidCanvas.tsx PHẢI import từ @/lib/raid/constants (30×22),
// KHÔNG @/lib/game/constants (60×60). Verification 2026-08-11 — đã đúng, guard chống revert.
describe("RaidCanvas grid import regression guard", () => {
  it("import constants từ raid/constants, không game/constants", () => {
    const src = readFileSync(
      join(process.cwd(), "src/components/raid/RaidCanvas.tsx"),
      "utf8",
    );
    expect(src).toMatch(/from\s+["']@\/lib\/raid\/constants["']/);
    // KHÔNG import MAP_COLS/MAP_ROWS từ game/constants trong RaidCanvas.
    const gameConstImport = src.match(/from\s+["']@\/lib\/game\/constants["']/);
    expect(gameConstImport).toBeNull();
  });

  it("entity màu/shape qua shared raid-display-mapper, không hardcode lại", () => {
    // Phase 5 §Live/replay display mapper contract — live canvas + replay canvas render
    // qua SAME mapper, không drift. Guard chống revert về bảng màu emoji/hardcode nội bộ.
    const src = readFileSync(
      join(process.cwd(), "src/components/raid/RaidCanvas.tsx"),
      "utf8",
    );
    expect(src).toMatch(/raid-display-mapper/);
    expect(src).toMatch(/mapRaidEntity/);
    // KHÔNG self-define bảng màu entity trong RaidCanvas (trước đây ENTITY_STYLE).
    expect(src).not.toMatch(/ENTITY_STYLE/);
    expect(src).not.toMatch(/#7c5cbf|#2f2a26|#8b5a2b|#e7b94e/);
  });
});
