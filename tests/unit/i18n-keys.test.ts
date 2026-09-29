import { describe, it, expect } from "vitest";
import vi from "../../src/i18n/messages/vi.json";
import en from "../../src/i18n/messages/en.json";

// Flatten nested message object thành dot-keys.
function flatKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      keys.push(...flatKeys(v as Record<string, unknown>, full));
    } else {
      keys.push(full);
    }
  }
  return keys;
}

describe("i18n key parity (vi ↔ en)", () => {
  const viKeys = new Set(flatKeys(vi));
  const enKeys = new Set(flatKeys(en));

  it("vi + en có cùng key set (không missing key)", () => {
    const missingInEn = [...viKeys].filter((k) => !enKeys.has(k));
    const missingInVi = [...enKeys].filter((k) => !viKeys.has(k));
    expect(missingInEn).toEqual([]);
    expect(missingInVi).toEqual([]);
  });

  it("có ít nhất các core key (start.title, settings.title, credits.assetsBy)", () => {
    for (const k of ["start.title", "settings.title", "credits.assetsBy", "common.loading"]) {
      expect(viKeys.has(k)).toBe(true);
    }
  });

  it("không giá trị rỗng", () => {
    for (const [k, v] of Object.entries(flatKeysWithValue(vi))) {
      expect(String(v).length, `vi.${k} empty`).toBeGreaterThan(0);
    }
    for (const [k, v] of Object.entries(flatKeysWithValue(en))) {
      expect(String(v).length, `en.${k} empty`).toBeGreaterThan(0);
    }
  });
});

function flatKeysWithValue(obj: Record<string, unknown>, prefix = ""): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      Object.assign(out, flatKeysWithValue(v as Record<string, unknown>, full));
    } else {
      out[full] = v;
    }
  }
  return out;
}
