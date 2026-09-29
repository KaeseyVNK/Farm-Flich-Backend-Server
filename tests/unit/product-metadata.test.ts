// Phase 1 — product metadata contract (plan: "Sửa guideline/metadata cũ còn gọi game là
// Harvest Hollow để tên sản phẩm, title và tone không drift"). The product is Masked Farm.
// layout.tsx cannot be imported in the node vitest env (next/font + CSS imports), so the
// contract is guarded by reading the file as text.
import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

async function loadLayout(): Promise<string> {
  return readFile(join(process.cwd(), "src", "app", "layout.tsx"), "utf8");
}

describe("Product metadata — Masked Farm, no Harvest Hollow drift", () => {
  it("không còn 'Harvest Hollow' trong layout.tsx", async () => {
    const src = await loadLayout();
    expect(src.toLowerCase()).not.toContain("harvest hollow");
  });

  it("metadata.title dùng tên Masked Farm", async () => {
    const src = await loadLayout();
    expect(src).toMatch(/title:\s*"[^"]*Masked Farm[^"]*"/);
  });

  it("appleWebApp.title + openGraph.title dùng Masked Farm", async () => {
    const src = await loadLayout();
    expect(/appleWebApp:[\s\S]*?title:\s*"Masked Farm"/.test(src)).toBe(true);
    expect(/openGraph:[\s\S]*?title:\s*"Masked Farm"/.test(src)).toBe(true);
  });
});
