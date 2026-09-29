import { describe, it, expect } from "vitest";
import { createEnemyFsm, tickFsm, steerForState } from "../../src/lib/game/enemy-fsm";

describe("Enemy FSM", () => {
  it("flee khi hp < threshold + hasTarget", () => {
    const fsm = createEnemyFsm({ lowHpThreshold: 20 });
    fsm.hp = 10;
    fsm.hasTarget = true;
    fsm.distToTarget = 3;
    expect(tickFsm(fsm)).toBe("flee");
  });

  it("attack khi dist <= attackRange", () => {
    const fsm = createEnemyFsm({ attackRange: 1, aggroRange: 6 });
    fsm.hp = 100;
    fsm.hasTarget = true;
    fsm.distToTarget = 1;
    expect(tickFsm(fsm)).toBe("attack");
  });

  it("chase khi dist trong aggroRange nhưng ngoài attackRange", () => {
    const fsm = createEnemyFsm({ attackRange: 1, aggroRange: 6 });
    fsm.hp = 100;
    fsm.hasTarget = true;
    fsm.distToTarget = 4;
    expect(tickFsm(fsm)).toBe("chase");
  });

  it("mất target từ chase → patrol", () => {
    const fsm = createEnemyFsm({ aggroRange: 6 });
    fsm.state = "chase";
    fsm.hasTarget = false;
    fsm.distToTarget = Infinity;
    expect(tickFsm(fsm)).toBe("patrol");
  });

  it("priority: flee > attack (low hp + in range)", () => {
    const fsm = createEnemyFsm({ lowHpThreshold: 20, attackRange: 1 });
    fsm.hp = 10;
    fsm.hasTarget = true;
    fsm.distToTarget = 1;
    expect(tickFsm(fsm)).toBe("flee");
  });

  it("không target + idle → idle hoặc patrol (random)", () => {
    const fsm = createEnemyFsm();
    fsm.state = "idle";
    fsm.hasTarget = false;
    const next = tickFsm(fsm);
    expect(["idle", "patrol"]).toContain(next);
  });

  it("steerForState: chase → hướng target; flee → ngược target", () => {
    expect(steerForState("chase", 1, 0)).toEqual({ dx: 1, dy: 0 });
    expect(steerForState("flee", 1, 0)).toEqual({ dx: -1, dy: 0 });
    expect(steerForState("idle", 1, 0)).toEqual({ dx: 0, dy: 0 });
    expect(steerForState("patrol", 1, 0)).toEqual({ dx: 0, dy: 0 });
  });
});
