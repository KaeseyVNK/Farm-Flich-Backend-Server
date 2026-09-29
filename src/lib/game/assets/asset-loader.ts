// AssetLoader — preload HTMLImageElement cho manifest keys, progress callback, per-asset fallback.
// 1 asset fail → checkerboard placeholder (magenta/black 16×16) + warn; KHÔNG reject Promise.all.
import { ASSET_MANIFEST, assetUrl } from "./asset-manifest";

export interface LoadResult {
  ok: boolean;
  failed: string[];
}

type ProgressCb = (ratio: number) => void;

// Lazy module-scoped cache (survives re-imports within a session).
const cache = new Map<string, HTMLImageElement>();

function placeholder(): HTMLImageElement {
  const img = new Image();
  // jsdom không impl CanvasRenderingContext2D → getContext null → skip checkerboard.
  // Browser thật: vẽ magenta/black 8×8 checkerboard (clearly signals missing asset).
  if (typeof document !== "undefined") {
    const cv = document.createElement("canvas");
    cv.width = 16;
    cv.height = 16;
    const ctx = cv.getContext("2d");
    if (ctx) {
      for (let y = 0; y < 16; y += 8)
        for (let x = 0; x < 16; x += 8) {
          ctx.fillStyle = ((x + y) / 8) % 2 === 0 ? "#ff00ff" : "#000000";
          ctx.fillRect(x, y, 8, 8);
        }
      img.src = cv.toDataURL();
    }
  }
  return img;
}

export function getAsset(key: string): HTMLImageElement | undefined {
  return cache.get(key);
}

// In-flight guard — StartScreen (mount) và BootScene (cache rỗng) đều có thể gọi
// loadAll gần như đồng thời. Nếu không guard, 2 vòng fetch song song → duplicate
// requests + 2 batch đua nhau ghi cache (cùng key, giá trị khác) — vô hại nhưng phí.
let inflight: Promise<LoadResult> | null = null;

function cacheIsComplete(): boolean {
  return ASSET_MANIFEST.every((e) => cache.has(e.key));
}

export function loadAll(onProgress?: ProgressCb): Promise<LoadResult> {
  if (inflight) return inflight;
  // BootScene used to skip this when *any* key was cached. StartScreen and Boot
  // overlap: small PNGs land first, FarmScene starts, house/tree still loading
  // → scenery forever stays on graphics rectangles.
  if (cacheIsComplete()) {
    onProgress?.(1);
    return Promise.resolve({ ok: true, failed: [] });
  }
  const total = ASSET_MANIFEST.length;
  let done = 0;
  const failed: string[] = [];

  const tasks = ASSET_MANIFEST.map(
    (entry) =>
      new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          cache.set(entry.key, img);
          done++;
          onProgress?.(done / total);
          resolve();
        };
        img.onerror = () => {
          console.warn(`[asset] load failed → placeholder: ${entry.key} (${entry.dest})`);
          cache.set(entry.key, placeholder());
          failed.push(entry.key);
          done++;
          onProgress?.(done / total);
          resolve(); // resolve, không reject — fallback thay thế
        };
        img.src = assetUrl(entry.key);
      }),
  );

  const promise = Promise.all(tasks).then(() => ({ ok: failed.length === 0, failed }));
  inflight = promise;
  void promise.finally(() => {
    inflight = null;
  });
  return promise;
}

// Test-only: inject a fake image for a key (jsdom không load thật được PNG).
export function __setForTest(key: string, img: HTMLImageElement): void {
  cache.set(key, img);
}

// Test-only: clear cache + in-flight guard (guard trả promise resolve cũ giữa các test).
export function __resetForTest(): void {
  cache.clear();
  inflight = null;
}
