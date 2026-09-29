// Phase 1 — dark-fantasy-tokens reconciliation guard.
// DARK_FANTASY was a Phase-5 exploration palette with 0 production importers. The
// canonical Masked Farm contract is now the --mf-* CSS tokens (see globals.css +
// masked-farm-tokens.test.ts). This test characterizes that no production code adopts the
// deprecated TS palette, so a future migration cannot accidentally depend on it. The WCAG
// helper functions (relativeLuminance/contrastRatio/meetsAA) remain a reusable utility.
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const SRC = join(process.cwd(), "src");
const THEME_DIR = join(SRC, "lib", "game", "theme"); // source-of-truth dir — excluded
const TS_EXT = new Set([".ts", ".tsx"]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (p === THEME_DIR) continue; // skip the deprecation host itself
      walk(p, out);
    } else if (TS_EXT.has(extname(p))) out.push(p);
  }
  return out;
}

describe("dark-fantasy-tokens deprecation guard", () => {
  it("không có file production nào import DARK_FANTASY / dark-fantasy-tokens", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const txt = readFileSync(file, "utf8");
      // Match either the module path or the exported symbol import.
      if (/dark-fantasy-tokens/.test(txt) || /\bDARK_FANTASY\b/.test(txt)) {
        offenders.push(file);
      }
    }
    expect(offenders, `prod files still reference deprecated palette: ${offenders.join(", ")}`).toEqual([]);
  });
});
