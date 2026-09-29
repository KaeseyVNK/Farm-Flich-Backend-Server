// CharacterComposer — compose Skin+Hair+Clothes+Eyes layers → 1 offscreen sheet (4 hướng × frames).
// Phase 1: SKELETON. Phase 4 visual approval gate sẽ wire layer thật + pivot anchor check.
// Cache composed sheet per variant key để tránh vẽ lại.

export interface CharacterSelection {
  skin: string; // asset key hoặc color
  hair: string;
  clothes: string;
  eyes: string;
}

export interface ComposedSheet {
  canvas: HTMLCanvasElement;
  variantKey: string;
}

const sheetCache = new Map<string, ComposedSheet>();

export function variantKey(sel: CharacterSelection): string {
  return `${sel.skin}|${sel.hair}|${sel.clothes}|${sel.eyes}`;
}

// Phase 1: trả canvas trống đúng kích thước (4 hướng × 4 frame idle/walk × TILE_SIZE scale).
// Phase 4: vẽ layer thật, kiểm pivot anchor giữa Skin/Hair/Clothes.
export function composeCharacter(sel: CharacterSelection, tileSize: number): ComposedSheet {
  const key = variantKey(sel);
  const cached = sheetCache.get(key);
  if (cached) return cached;

  const directions = 4;
  const framesPerDir = 4;
  const canvas = document.createElement("canvas");
  canvas.width = framesPerDir * tileSize;
  canvas.height = directions * tileSize;
  // jsdom không impl CanvasRenderingContext2D — guard null. Phase 4 (browser) ctx thật.
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    // Skeleton: transparent — phase 4 fill layers.
    // ponytail: ceiling = no layer rendered yet; upgrade phase 4 visual gate.
  }

  const sheet: ComposedSheet = { canvas, variantKey: key };
  sheetCache.set(key, sheet);
  return sheet;
}

export function invalidateVariant(sel: CharacterSelection): void {
  sheetCache.delete(variantKey(sel));
}

export function __resetForTest(): void {
  sheetCache.clear();
}
