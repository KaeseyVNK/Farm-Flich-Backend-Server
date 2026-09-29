// Phase 1 — Masked Farm semantic token contract.
// Locks the canonical --mf-* colour tokens + --z-* z-index ladder from
// visual-design-specification.md as a runtime contract in globals.css BEFORE any
// component migration (Phase 2+). The test reads globals.css as text so it works in the
// node vitest environment; it guards both token presence and exact day-side values so a
// silent palette drift is caught.
import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

let css: string;
async function loadCss(): Promise<string> {
  if (css === undefined) {
    css = await readFile(join(process.cwd(), "src", "app", "globals.css"), "utf8");
  }
  return css;
}

// Day-side canonical values (visual-design-specification.md §Core colour roles).
const MF_DAY_TOKENS: Record<string, string> = {
  "--mf-ink": "#2f2116",
  "--mf-muted-ink": "#6a5137",
  "--mf-paper": "#f3e6c9",
  "--mf-paper-raised": "#fff7e4",
  "--mf-frame": "#4a3119",
  "--mf-wood": "#6c4426",
  "--mf-leaf": "#47783c",
  "--mf-harvest": "#d99a2a",
  "--mf-danger": "#b94639",
  "--mf-focus": "#1d638f",
  "--mf-disabled": "#c6b48d",
};

// Canonical z-index layering (implementation-handoff-contract §Canonical visual layering).
const Z_TOKENS: Record<string, string> = {
  "--z-canvas": "0",
  "--z-world-hint": "10",
  "--z-hud": "20",
  "--z-panel": "30",
  "--z-toast": "40",
  "--z-event": "45",
  "--z-modal": "50",
  "--z-mode": "60",
};

describe("Masked Farm semantic tokens (--mf-*)", () => {
  it("mọi token màu --mf-* được định nghĩa trong globals.css với day value chuẩn", async () => {
    const src = await loadCss();
    for (const [token, value] of Object.entries(MF_DAY_TOKENS)) {
      // Accept either `: #value;` or `: #VALUE;` (case-insensitive hex).
      const re = new RegExp(`${token}\\s*:\\s*${value}`, "i");
      expect(re.test(src), `${token} phải = ${value}`).toBe(true);
    }
  });

  it("mỗi token --mf-* chỉ định nghĩa 1 lần trong :root — override mùa trong scope .farm-shell là hợp lệ", async () => {
    const src = await loadCss();
    // Chỉ khoá tính duy nhất trong khối :root (canonical). Redesign mùa cho phép
    // re-define token trong .farm-shell[data-season=...] — không tính là conflict.
    const rootBlock = src.match(/:root\s*\{[^}]*\}/)?.[0] ?? "";
    expect(rootBlock.length, "khối :root phải tồn tại").toBeGreaterThan(0);
    for (const token of Object.keys(MF_DAY_TOKENS)) {
      const count = (rootBlock.match(new RegExp(`${token}\\s*:`, "g")) ?? []).length;
      expect(count, `${token} defined ${count}× trong :root`).toBe(1);
    }
  });
});

describe("Canonical z-index ladder (--z-*)", () => {
  it("mọi layer token --z-* được định nghĩa với numeric target đúng", async () => {
    const src = await loadCss();
    for (const [token, value] of Object.entries(Z_TOKENS)) {
      const re = new RegExp(`${token}\\s*:\\s*${value}\\b`);
      expect(re.test(src), `${token} phải = ${value}`).toBe(true);
    }
  });

  it("thứ tự layer tăng dần: canvas < world-hint < hud < panel < toast < event < modal < mode", async () => {
    const vals = Object.values(Z_TOKENS).map(Number);
    for (let i = 1; i < vals.length; i++) {
      expect(vals[i]).toBeGreaterThan(vals[i - 1]);
    }
  });
});
