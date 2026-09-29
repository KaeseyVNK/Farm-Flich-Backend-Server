import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * PWA manifest gate (phase 8 F8.3 "PWA-lite").
 * Plan spec: manifest.json valid JSON; icons tồn tại; theme-color set;
 * KHÔNG service worker đăng ký (installable-only, offline scope ra roadmap).
 * Trước đây thiếu test — manifest break (invalid JSON / icon missing) không có gate.
 */
const ROOT = join(__dirname, "..", "..");

describe("PWA manifest (PWA-lite)", () => {
  it("manifest.json là JSON hợp lệ + đủ trường bắt buộc", () => {
    const raw = readFileSync(join(ROOT, "public/manifest.json"), "utf8");
    const manifest = JSON.parse(raw) as {
      name?: string;
      short_name?: string;
      start_url?: string;
      display?: string;
      icons?: { src: string; sizes: string; type: string }[];
      theme_color?: string;
      background_color?: string;
    };

    expect(manifest.name?.length ?? 0).toBeGreaterThan(0);
    expect(manifest.short_name?.length ?? 0).toBeGreaterThan(0);
    expect(manifest.start_url).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons?.length ?? 0).toBeGreaterThan(0);
    expect(manifest.theme_color).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(manifest.background_color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it("mọi icon trong manifest tồn tại trên disk", () => {
    const manifest = JSON.parse(readFileSync(join(ROOT, "public/manifest.json"), "utf8")) as {
      icons?: { src: string }[];
    };
    for (const icon of manifest.icons ?? []) {
      const path = join(ROOT, "public", icon.src.replace(/^\//, ""));
      expect(existsSync(path), `icon missing: ${icon.src}`).toBe(true);
    }
  });

  it("layout.tsx link manifest + themeColor (installable)", () => {
    const layout = readFileSync(join(ROOT, "src/app/layout.tsx"), "utf8");
    expect(layout).toContain('manifest: "/manifest.json"');
    // themeColor trong `viewport` export (Next 16: themeColor metadata không hỗ trợ
    // trong metadata() — phải qua export const viewport).
    expect(layout).toContain("themeColor:");
  });

  it("KHÔNG đăng ký service worker (PWA-lite explicit — offline scope ra roadmap)", () => {
    const layout = readFileSync(join(ROOT, "src/app/layout.tsx"), "utf8");
    expect(layout).not.toContain("serviceWorker");
    expect(layout).not.toContain("registerSW");
  });
});
