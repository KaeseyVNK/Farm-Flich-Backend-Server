// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { loadAll, getAsset, __resetForTest, __setForTest } from "../../src/lib/game/assets/asset-loader";
import { ASSET_MANIFEST } from "../../src/lib/game/assets/asset-manifest";

// jsdom: HTMLImageElement không load thật — mock để trigger onload/onerror khi src set.
// Cài đặt: 1 ảnh onload, 1 ảnh onerror (entry đầu). Fire khi `src` được gán (giống browser).
function mockImageBehavior(mode: "ok" | "fail") {
  const orig = globalThis.Image;
  let idx = 0;
  class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    private _src = "";
    get src() {
      return this._src;
    }
    set src(v: string) {
      this._src = v;
      const willFail = mode === "fail" && idx === 0;
      idx++;
      // microtask để onload/onerror đã gán xong trước khi fire
      queueMicrotask(() => {
        if (willFail) this.onerror?.();
        else this.onload?.();
      });
    }
  }
  globalThis.Image = FakeImage as unknown as typeof Image;
  return () => {
    globalThis.Image = orig;
  };
}

describe("AssetLoader", () => {
  beforeEach(() => {
    __resetForTest();
  });

  it("preload resolve, progress 0→1", async () => {
    const restore = mockImageBehavior("ok");
    const seen: number[] = [];
    const res = await loadAll((r) => seen.push(r));
    restore();
    expect(res.ok).toBe(true);
    expect(res.failed).toEqual([]);
    // progress cuối = 1
    expect(seen[seen.length - 1]).toBe(1);
    // mọi key có asset
    for (const e of ASSET_MANIFEST) {
      expect(getAsset(e.key)).toBeDefined();
    }
  });

  it("1 asset fail → vẫn resolve, fallback placeholder, warn log, failed[] chứa key", async () => {
    const restore = mockImageBehavior("fail");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await loadAll();
    restore();
    expect(res.ok).toBe(false);
    expect(res.failed.length).toBe(1);
    expect(res.failed[0]).toBe(ASSET_MANIFEST[0].key);
    // fallback placeholder vẫn được set
    expect(getAsset(ASSET_MANIFEST[0].key)).toBeDefined();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("__setForTest inject ảnh cho key", () => {
    const img = new Image();
    __setForTest("test.key", img);
    expect(getAsset("test.key")).toBe(img);
  });

  it("in-flight guard: 2 lần loadAll gọi song song → 1 batch fetch duy nhất", async () => {
    // Chỉ nạp 1 entry để dễ đếm số Image được tạo.
    const manifestMock = vi.spyOn(await import("../../src/lib/game/assets/asset-manifest"), "ASSET_MANIFEST", "get");
    const single = [{ key: "tile.grass.spring", src: "x", dest: "y" }];
    manifestMock.mockReturnValue(single as never);
    const restore = mockImageBehavior("ok");
    let imagesCreated = 0;
    const orig = globalThis.Image;
    class CountImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private _src = "";
      get src() {
        return this._src;
      }
      set src(v: string) {
        this._src = v;
        imagesCreated++;
        queueMicrotask(() => this.onload?.());
      }
    }
    globalThis.Image = CountImage as unknown as typeof Image;
    const p1 = loadAll();
    const p2 = loadAll();
    expect(p1).toBe(p2); // cùng promise
    await Promise.all([p1, p2]);
    restore();
    globalThis.Image = orig;
    expect(imagesCreated).toBe(1); // 1 batch, không duplicate
    manifestMock.mockRestore();
  });

  it("loadAll khi cache đủ → không fetch lại", async () => {
    const restore = mockImageBehavior("ok");
    await loadAll();
    restore();
    let created = 0;
    const orig = globalThis.Image;
    class CountImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private _src = "";
      get src() {
        return this._src;
      }
      set src(v: string) {
        this._src = v;
        created++;
        queueMicrotask(() => this.onload?.());
      }
    }
    globalThis.Image = CountImage as unknown as typeof Image;
    const res = await loadAll();
    globalThis.Image = orig;
    expect(res.ok).toBe(true);
    expect(created).toBe(0);
  });
});
