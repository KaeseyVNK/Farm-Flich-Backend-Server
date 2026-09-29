import { describe, it, expect } from "vitest";
import {
  characterTextureKey,
  atlasFrameRect,
} from "../../src/lib/game/phaser/texture-bridge";

describe("TextureBridge (pure helpers)", () => {
  it("characterTextureKey deterministic + sanitized", () => {
    const k1 = characterTextureKey({ skin: "s1", hair: "h1", clothes: "c1", eyes: "e1" });
    const k2 = characterTextureKey({ skin: "s1", hair: "h1", clothes: "c1", eyes: "e1" });
    expect(k1).toBe(k2);
    expect(k1).toMatch(/^char-/);
    // selection khác → key khác
    const k3 = characterTextureKey({ skin: "s1", hair: "h2", clothes: "c1", eyes: "e1" });
    expect(k3).not.toBe(k1);
  });

  it("atlasFrameRect: chia đều sheet theo frameCount", () => {
    const r0 = atlasFrameRect(128, 4, 0);
    expect(r0).toEqual({ sx: 0, sw: 32 });
    const r2 = atlasFrameRect(128, 4, 2);
    expect(r2).toEqual({ sx: 64, sw: 32 });
  });

  it("registerComposedTexture idempotent + canvas invalid → false", async () => {
    const { registerComposedTexture } = await import("../../src/lib/game/phaser/texture-bridge");
    // Fake scene stub.
    const existsKeys = new Set<string>(["exists-key"]);
    const added: string[] = [];
    const fakeScene = {
      textures: {
        exists: (k: string) => existsKeys.has(k),
        addCanvas: (k: string) => {
          added.push(k);
        },
      },
    };
    // đã tồn tại → true, không add lại
    expect(registerComposedTexture(fakeScene as never, "exists-key", {} as HTMLCanvasElement)).toBe(true);
    expect(added).toEqual([]);
    // canvas rỗng → false
    expect(registerComposedTexture(fakeScene as never, "new", { width: 0 } as HTMLCanvasElement)).toBe(false);
    // canvas OK → true + add
    const ok = registerComposedTexture(fakeScene as never, "new", {
      width: 64,
      height: 64,
    } as HTMLCanvasElement);
    expect(ok).toBe(true);
    expect(added).toEqual(["new"]);
  });
});
