// @vitest-environment jsdom
// Regression test cho race fix (audit UI bug "canvas phẳng"):
// BootScene.preload() có thể chạy TRƯỚC khi StartScreen gọi loadAll() xong →
// cache rỗng → 0 texture đăng ký → FarmScene fallback rectangle placeholder.
// Fix: create() await loadAll() nếu cache chưa có asset, rồi register → mới
// start FarmScene. Test verify: (1) register vào texture manager khi cache có
// image, (2) create() await loadAll khi cache trống, (3) booted guard chặn
// start FarmScene 2 lần.
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock phaser hoàn toàn — tránh side-effect canvas trong jsdom.
vi.mock("phaser", () => {
  class Scene {
    private texturesStore: Record<string, unknown> = {};
    scene = { start: vi.fn() };
    textures = {
      exists: (k: string) => k in this.texturesStore,
      addImage: (k: string) => {
        this.texturesStore[k] = {};
      },
    };
    load = { image: vi.fn() };
    static default = { Scene };
  }
  return { Phaser: { Scene }, default: { Scene } };
});

// Mock global Image → trigger onload khi src được gán (jsdom không load PNG thật).
function stubImageBehaviour(): () => void {
  const orig = globalThis.Image;
  class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    private _src = "";
    get src(): string {
      return this._src;
    }
    set src(v: string) {
      this._src = v;
      queueMicrotask(() => this.onload?.());
    }
  }
  globalThis.Image = FakeImage as unknown as typeof Image;
  return () => {
    globalThis.Image = orig;
  };
}

// Gọi create() với fake `this` (textures + scene.start track).
function runCreate(scene: InstanceType<typeof Object>, started: string[]) {
  const createFn = (scene as unknown as { create: () => Promise<void> }).create.bind(scene);
  const fakeThis = scene as unknown as {
    textures: { exists: () => boolean; addImage: () => void };
    scene: { start: (k: string) => void };
    booted?: boolean;
  };
  fakeThis.scene = { start: (k: string) => started.push(k) };
  fakeThis.textures = { exists: () => false, addImage: () => {} };
  return createFn();
}

describe("BootScene race fix (asset preload before FarmScene)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("registerCachedImages: register asset khi cache có image (fast path)", async () => {
    const restore = stubImageBehaviour();
    const { loadAll } = await import("../../src/lib/game/assets/asset-loader");
    await loadAll();
    restore();

    const { BootScene } = await import("../../src/components/game/scenes/boot-scene");
    const scene = new BootScene();
    const added: string[] = [];
    (scene as unknown as { textures: { addImage: (k: string) => void; exists: () => boolean } }).textures = {
      addImage: (k: string) => added.push(k),
      exists: () => false,
    };
    (scene as unknown as { registerCachedImages: () => void }).registerCachedImages();
    expect(added.length).toBeGreaterThan(0);
    expect(added[0]).toMatch(/^tile\./);
  });

  it("create(): cache rỗng → await loadAll rồi mới start FarmScene", async () => {
    const restore = stubImageBehaviour();
    const { BootScene } = await import("../../src/components/game/scenes/boot-scene");
    const scene = new BootScene();
    const started: string[] = [];
    (scene as unknown as { registerCachedImages: () => void }).registerCachedImages = () => {};
    await runCreate(scene, started);
    restore();
    expect(started).toEqual(["FarmScene"]);
  });

  it("create(): cache đã có 1 asset vẫn await loadAll đủ rồi mới start FarmScene", async () => {
    const restore = stubImageBehaviour();
    const { __setForTest, getAsset } = await import("../../src/lib/game/assets/asset-loader");
    const img = new Image();
    img.src = "data:partial";
    __setForTest("tile.grass.spring", img as HTMLImageElement);
    expect(getAsset("obj.house")).toBeUndefined();

    const { BootScene } = await import("../../src/components/game/scenes/boot-scene");
    const scene = new BootScene();
    const added: string[] = [];
    const started: string[] = [];
    (scene as unknown as {
      textures: { exists: (k: string) => boolean; addImage: (k: string) => void };
      scene: { start: (k: string) => void };
      load: { image: () => void };
    }).textures = {
      exists: (k: string) => added.includes(k),
      addImage: (k: string) => {
        added.push(k);
      },
    };
    (scene as unknown as { scene: { start: (k: string) => void } }).scene = {
      start: (k: string) => started.push(k),
    };

    await (scene as unknown as { create: () => Promise<void> }).create();
    restore();
    expect(started).toEqual(["FarmScene"]);
    expect(added).toContain("obj.house");
    expect(added).toContain("obj.tree");
  });

  it("create(): cache đã có asset → vẫn start FarmScene đúng 1 lần", async () => {
    const restore = stubImageBehaviour();
    const { loadAll } = await import("../../src/lib/game/assets/asset-loader");
    await loadAll();
    restore();

    const { BootScene } = await import("../../src/components/game/scenes/boot-scene");
    const scene = new BootScene();
    const started: string[] = [];
    (scene as unknown as { registerCachedImages: () => void }).registerCachedImages = () => {};
    await runCreate(scene, started);
    expect(started).toEqual(["FarmScene"]);
  });

  it("booted guard: create() 2 lần chỉ start FarmScene 1 lần", async () => {
    const restore = stubImageBehaviour();
    const { loadAll } = await import("../../src/lib/game/assets/asset-loader");
    await loadAll();
    restore();

    const { BootScene } = await import("../../src/components/game/scenes/boot-scene");
    const scene = new BootScene();
    const started: string[] = [];
    (scene as unknown as { registerCachedImages: () => void }).registerCachedImages = () => {};
    await runCreate(scene, started);
    await runCreate(scene, started);
    expect(started).toEqual(["FarmScene"]);
  });
});
