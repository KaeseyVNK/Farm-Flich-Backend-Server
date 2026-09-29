// Entity hitbox (phase 4). Hitbox tách khỏi render box.
// Sprite 48×48 render, nhưng collision bbox nhỏ hơn (vd 60% tile) — Phaser body size.
export interface Hitbox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Compute hitbox từ render rect + ratio. Center-aligned, nhỏ hơn render.
 * ratio < 1 = hitbox nhỏ hơn sprite (vd 0.6 = 60%).
 */
export function entityHitbox(
  renderX: number,
  renderY: number,
  renderW: number,
  renderH: number,
  ratio = 0.6,
): Hitbox {
  const w = renderW * ratio;
  const h = renderH * ratio;
  return {
    x: renderX + (renderW - w) / 2,
    y: renderY + (renderH - h) / 2,
    w,
    h,
  };
}

/** AABB overlap test giữa 2 hitbox. */
export function hitboxesOverlap(a: Hitbox, b: Hitbox): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

/** Hitbox trong world bounds (clamp). */
export function clampHitbox(box: Hitbox, worldW: number, worldH: number): Hitbox {
  return {
    x: Math.max(0, Math.min(box.x, worldW - box.w)),
    y: Math.max(0, Math.min(box.y, worldH - box.h)),
    w: box.w,
    h: box.h,
  };
}
