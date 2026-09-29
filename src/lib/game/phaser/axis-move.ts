/** Axis-separated movement: slide along walls instead of embedding into them. */

export type CollidesFn = (x: number, y: number) => boolean;

const UNSTICK_STEPS = [4, 8, 12, 16, 24, 32, 48];
const UNSTICK_DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [-1, 1], [1, -1], [-1, -1],
];

/** If already inside a solid, step to the nearest free pixel so the player can move again. */
export function unstickPosition(x: number, y: number, collides: CollidesFn): { x: number; y: number } {
  if (!collides(x, y)) return { x, y };
  for (const step of UNSTICK_STEPS) {
    for (const [dx, dy] of UNSTICK_DIRS) {
      const nx = x + dx * step;
      const ny = y + dy * step;
      if (!collides(nx, ny)) return { x: nx, y: ny };
    }
  }
  return { x, y };
}

/**
 * Move X then Y against `collides`. Matches GameEngine sliding:
 * never apply both axes first (that embeds the body, then every later move is blocked).
 */
export function slideMove(
  x: number,
  y: number,
  dx: number,
  dy: number,
  collides: CollidesFn,
): { x: number; y: number } {
  const freed = unstickPosition(x, y, collides);
  x = freed.x;
  y = freed.y;
  if (dx !== 0 && !collides(x + dx, y)) x += dx;
  if (dy !== 0 && !collides(x, y + dy)) y += dy;
  return { x, y };
}
