import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { VISIT_SAFE_KEYS } from "../../src/lib/social/visit-service";

// visit-service import supabase/server — trong vitest jsdom nó không gọi gì lúc
// import (chỉ định nghĩa hàm) → an toàn test constant.

describe("VISIT_SAFE_KEYS (W4)", () => {
  it("chứa placedDecor (visit render decor W3)", () => {
    expect(VISIT_SAFE_KEYS).toContain("placedDecor");
  });

  it("chứa pondFish (W4 audit-fix — chấm cá ao; plan W4: 'pondFish vô hại, thêm được')", () => {
    expect(VISIT_SAFE_KEYS).toContain("pondFish");
  });

  it("giữ nguyên 4 key cũ (terrain/crops/objects/forage)", () => {
    for (const k of ["terrain", "crops", "objects", "forage"]) {
      expect(VISIT_SAFE_KEYS).toContain(k);
    }
  });

  it("KHÔNG bao giờ expose Inventory/gold/energy paths", () => {
    const joined = VISIT_SAFE_KEYS.join(",");
    // pondFish ĐÃ cho phép (chỉ fishId/daysGrown — không phải silo chi tiết).
    for (const banned of ["inventory", "gold", "energy", "Inventory", "silo"]) {
      expect(joined.includes(banned)).toBe(false);
    }
  });

  it("mọi VISIT_SAFE_KEYS là cột trên model Farm (schema.prisma)", () => {
    const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
    const block = schema.match(/model Farm \{([\s\S]*?)\n\}/);
    expect(block).not.toBeNull();
    const cols = new Set(
      [...(block?.[1].matchAll(/^\s+([a-zA-Z][a-zA-Z0-9]*)\s+/gm) ?? [])]
        .map((m) => m[1])
        .filter((n) => n !== "model"),
    );
    for (const k of VISIT_SAFE_KEYS) {
      expect(cols.has(k)).toBe(true);
    }
  });
});
