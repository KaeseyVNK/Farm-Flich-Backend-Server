// Enemy FSM (ADR-018). 5 state: idle/patrol/chase/attack/flee.
// Decide → steer (kinematic) → path (BFS đã có benchmark-bfs.ts).
// Pure transition table (testable); Phaser wire ở scene.

export type EnemyState = "idle" | "patrol" | "chase" | "attack" | "flee";

export interface EnemyFsmContext {
  state: EnemyState;
  hp: number;
  distToTarget: number; // tile distance
  hasTarget: boolean;
  lowHpThreshold: number; // flee khi hp < threshold
  attackRange: number; // attack khi dist <= range
  aggroRange: number; // chase khi dist <= aggro
}

export function createEnemyFsm(opts?: {
  lowHpThreshold?: number;
  attackRange?: number;
  aggroRange?: number;
}): EnemyFsmContext {
  return {
    state: "idle",
    hp: 100,
    distToTarget: Infinity,
    hasTarget: false,
    lowHpThreshold: opts?.lowHpThreshold ?? 20,
    attackRange: opts?.attackRange ?? 1,
    aggroRange: opts?.aggroRange ?? 6,
  };
}

/**
 * Transition logic — pure. Trả new state.
 * Priority: flee (low hp) > attack (in range) > chase (aggro) > patrol > idle.
 */
export function tickFsm(ctx: EnemyFsmContext): EnemyState {
  let next: EnemyState = ctx.state;
  // Flee khi low hp (trừ khi đã idle safe).
  if (ctx.hp < ctx.lowHpThreshold && ctx.hasTarget) {
    next = "flee";
  } else if (ctx.hasTarget && ctx.distToTarget <= ctx.attackRange) {
    next = "attack";
  } else if (ctx.hasTarget && ctx.distToTarget <= ctx.aggroRange) {
    next = "chase";
  } else if (ctx.state === "chase" || ctx.state === "attack") {
    // mất target → patrol
    next = "patrol";
  } else if (ctx.state === "idle") {
    next = Math.random() < 0.5 ? "patrol" : "idle";
  }
  ctx.state = next;
  return next;
}

/** Steer: velocity theo state (kinematic). Trả {dx,dy} unit-ish. */
export function steerForState(
  state: EnemyState,
  toTargetDx: number,
  toTargetDy: number,
): { dx: number; dy: number } {
  switch (state) {
    case "chase":
    case "attack":
      return { dx: toTargetDx, dy: toTargetDy };
    case "flee":
      // +0 normalize tránh -0 (deepEqual strict).
      return { dx: -toTargetDx + 0, dy: -toTargetDy + 0 };
    case "patrol":
      return { dx: 0, dy: 0 };
    default:
      return { dx: 0, dy: 0 };
  }
}
