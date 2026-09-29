import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";

// Math/Geom breaking audit (phase 2 — spike NOTES điểm 4-5).
// Phaser 4: Math.TAU đổi giá trị (π/2 → 2π), Math.PI2 xóa, Geom.Point → Vector2,
// Struct.Set/Map → JS native. Codebase KHÔNG dùng Phaser APIs này (Canvas 2D thuần).
// Test guard: nếu phase sau import Phaser và dùng API cũ → fail loud.

const ROOT = process.cwd();

function grep(pattern: string): number {
  try {
    const out = execSync(
      `grep -rn --include="*.ts" --include="*.tsx" "${pattern}" ${ROOT}/src 2>/dev/null || true`,
      { encoding: "utf8" },
    );
    // Lọc dòng comment (// hoặc * ) — chỉ đếm code thực.
    return out
      .split("\n")
      .filter((l) => l.trim() && !l.includes("//") && !l.trim().startsWith("*")).length;
  } catch {
    return 0;
  }
}

describe("Math/Geom breaking audit (Phaser 4)", () => {
  it("không dùng Math.PI2 (removed → Math.TAU)", () => {
    expect(grep("Math\\.PI2")).toBe(0);
  });

  it("không dùng Geom.Point (removed → Vector2)", () => {
    expect(grep("Geom\\.Point")).toBe(0);
  });

  it("không dùng Phaser.Struct.Set/Map (removed → native Set/Map)", () => {
    expect(grep("Struct\\.Set")).toBe(0);
    expect(grep("Struct\\.Map")).toBe(0);
  });

  it("không dùng setTintFill (removed → setTintMode FILL)", () => {
    expect(grep("setTintFill")).toBe(0);
  });

  it("không dùng TileSprite.setCrop (removed → addMask)", () => {
    expect(grep("\\.setCrop\\(")).toBe(0);
  });
});
