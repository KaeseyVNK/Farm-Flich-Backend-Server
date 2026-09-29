// Zone scenery placement contracts — shared by all game-zone layouts.
// This module must stay free of runtime Phaser imports so unit tests can
// pass plain structural mocks; at runtime the real Phaser scene arrives.

/** Structural subset of a Phaser texture used for frame slicing. */
export interface SceneryTexture {
  has(frame: string): boolean;
  add(frame: string, sourceIndex: number, x: number, y: number, w: number, h: number): unknown;
}

export interface SceneryTextures {
  exists(key: string): boolean;
  get(key: string): SceneryTexture;
}

/** Structural subset of Phaser.GameObjects.Image used by scenery rendering. */
export interface SceneryImage {
  setOrigin(x: number, y: number): this;
  setScale(scale: number): this;
  setDepth(depth: number): this;
  setData(key: string, value: unknown): this;
  getData(key: string): unknown;
  destroy(): void;
}

/** Structural subset of Phaser.GameObjects.Graphics used by fallbacks. */
export interface SceneryGraphics {
  fillStyle(color: number, alpha?: number): this;
  fillRect(x: number, y: number, width: number, height: number): this;
  setDepth(depth: number): this;
  destroy(): void;
}

export interface SceneryTweens {
  /** `unknown` param keeps the structural type assignable FROM Phaser's
   *  stricter (config: TweenBuilderConfig) => Tween signature. */
  add(config: unknown): unknown;
  killTweensOf(targets: unknown): void;
}

/**
 * Minimal structural Phaser.Scene surface the generic scenery renderer needs.
 * Unit tests pass a plain mock; runtime passes the real Phaser.Scene.
 */
export interface SceneryScene {
  add: {
    image(x: number, y: number, key: string, frame?: string): SceneryImage;
    graphics(): SceneryGraphics;
  };
  textures?: SceneryTextures;
  tweens?: SceneryTweens;
}

/** One data-driven sprite stamp: tile-grid footprint + flat-color fallback. */
export interface SpritePlacement {
  key: string;
  tx: number;
  ty: number;
  cols: number;
  rows: number;
  fallbackColor: number;
  sway?: boolean;
  depthOffset?: number;
}

/** Per-zone scenery data: placements to draw + solidity to collide on. */
export interface ZoneScenery {
  placements: readonly SpritePlacement[];
  isSolid(tx: number, ty: number): boolean;
}
