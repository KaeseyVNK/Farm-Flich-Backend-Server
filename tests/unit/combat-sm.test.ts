import { describe, it, expect } from "vitest";
import {
  makeEnemy,
  nextEnemy,
  chebyshevTiles,
  inSwingArc,
  swingHit,
  damageEnemy,
  rollLoot,
  touchPlayer,
  type EnemyState,
  type Rng,
} from "../../src/lib/game/combat/combat-sm";
import { COMBAT_TUNE } from "../../src/lib/game/combat/enemy-catalog";

const TS = 48; // TILE_SIZE thật
const NEVER_SOLID = () => false;

/** rng deterministic: mảng giá trị tuần tự (mỗi lần gọi pop tiếp theo). */
function seqRng(values: number[]): Rng {
  let i = 0;
  return () => values[i++ % values.length];
}

function slimeAt(tx: number, ty: number): EnemyState {
  return makeEnemy("s1", "sprout_slime", tx, ty, TS)!;
}

describe("inSwingArc (W5 P2)", () => {
  const P = { x: 10 * TS, y: 10 * TS };

  it("4 hướng: quái ngay trước mặt trúng, sau lưng trượt", () => {
    const front = { x: P.x + 1.2 * TS, y: P.y };
    const behind = { x: P.x - 1.2 * TS, y: P.y };
    expect(inSwingArc(P, "right", front, TS)).toBe(true);
    expect(inSwingArc(P, "right", behind, TS)).toBe(false);
    expect(inSwingArc(P, "left", behind, TS)).toBe(true);
    expect(inSwingArc(P, "down", { x: P.x, y: P.y + 1.2 * TS }, TS)).toBe(true);
    expect(inSwingArc(P, "up", { x: P.x, y: P.y - 1.2 * TS }, TS)).toBe(true);
    expect(inSwingArc(P, "up", { x: P.x, y: P.y + 1.2 * TS }, TS)).toBe(false);
  });

  it("arc 100°: lệch 40° trúng, lệch 70° trượt", () => {
    const deg = (d: number) => ({ x: P.x + Math.cos((d * Math.PI) / 180) * 1.3 * TS, y: P.y + Math.sin((d * Math.PI) / 180) * 1.3 * TS });
    expect(inSwingArc(P, "right", deg(40), TS)).toBe(true); // trong ±50°
    expect(inSwingArc(P, "right", deg(70), TS)).toBe(false); // ngoài ±50°
    expect(inSwingArc(P, "right", deg(-40), TS)).toBe(true);
    expect(inSwingArc(P, "right", deg(-70), TS)).toBe(false);
  });

  it("reach: 1.5 tile (+0.5 thân) — 1.9 tile trúng, 2.1 tile trượt", () => {
    expect(inSwingArc(P, "right", { x: P.x + 1.9 * TS, y: P.y }, TS)).toBe(true);
    expect(inSwingArc(P, "right", { x: P.x + 2.1 * TS, y: P.y }, TS)).toBe(false);
  });

  it("đứng đè nhau luôn trúng (khoảng cách ~0)", () => {
    expect(inSwingArc(P, "up", { x: P.x + 2, y: P.y + 2 }, TS)).toBe(true);
  });

  it("swingHit bỏ qua dead, giữ thứ tự", () => {
    const e1 = slimeAt(11, 10); // 1.5 tile bên phải P — trong reach
    const e2 = slimeAt(8, 10); // bên trái — ngoài arc facing right
    const dead = { ...slimeAt(11, 10), fsm: "dead" as const };
    const hit = swingHit(P, "right", [e1, e2, dead], TS);
    expect(hit).toEqual([e1]);
  });
});

describe("enemy FSM wander/chase/leash (W5 P2)", () => {
  it("player trong aggro → chase; player rời aggro → wander lại", () => {
    let e = slimeAt(10, 10); // spawn giữa
    const near = { x: e.x + 3 * TS, y: e.y }; // 3 tile < aggro 4
    e = nextEnemy(e, near, 1000, 16, seqRng([0.5]), NEVER_SOLID, TS);
    expect(e.fsm).toBe("chase");
    const far = { x: e.x + 10 * TS, y: e.y }; // 10 tile > aggro
    e = nextEnemy(e, far, 2000, 16, seqRng([0.5]), NEVER_SOLID, TS);
    expect(e.fsm).toBe("wander");
  });

  it("chase tiến về phía player (khoảng cách giảm)", () => {
    let e = slimeAt(10, 10);
    const player = { x: e.x + 4 * TS, y: e.y };
    e = nextEnemy(e, player, 1000, 16, seqRng([0.5]), NEVER_SOLID, TS); // vào chase
    const before = Math.hypot(player.x - e.x, player.y - e.y);
    e = nextEnemy(e, player, 1016, 500, seqRng([0.5]), NEVER_SOLID, TS); // tick chase
    const after = Math.hypot(player.x - e.x, player.y - e.y);
    expect(after).toBeLessThan(before);
  });

  it("leash: đuổi xa > 8 tile từ spawn → về wander + không rời quá 3 tile khi wander", () => {
    let e = slimeAt(10, 10);
    // ép chase rồi kéo player xa 9 tile từ spawn
    e = { ...e, fsm: "chase" };
    const far = { x: e.spawnX + 9 * TS, y: e.spawnY };
    e = nextEnemy(e, far, 1000, 16, seqRng([0.5]), NEVER_SOLID, TS);
    expect(e.fsm).toBe("wander"); // leash cắt
    // wander với hướng đi ra xa spawn KHI ĐÃ cách 3 tile → quay đầu về spawn
    const e2 = slimeAt(13, 10); // spawn (13,10) — đứng cách 3 tile về tây
    const far2 = { x: e2.spawnX - 3.05 * TS, y: e2.spawnY };
    const e3 = { ...e2, x: far2.x, wdx: -1, wdy: 0, wanderNextAt: 9_999_999 };
    const moved = nextEnemy(e3, { x: e3.spawnX - 20 * TS, y: e3.spawnY }, 1000, 100, seqRng([0.9]), NEVER_SOLID, TS);
    expect(moved.x).toBeGreaterThan(e3.x - 1); // quay đầu: không đi tiếp về tây
  });

  it("wander đổi hướng sau pause (rng điều khiển)", () => {
    let e = slimeAt(10, 10);
    e = { ...e, wanderNextAt: 500 };
    // rng đầu (0.2 <0.3 → nghỉ), pause tính từ 0.2
    const r1 = nextEnemy(e, { x: e.spawnX - 20 * TS, y: e.spawnY }, 1000, 16, seqRng([0.2]), NEVER_SOLID, TS);
    expect(r1.wdx).toBe(0);
    expect(r1.wanderNextAt).toBeGreaterThan(1000);
  });

  it("solid chặn đường — không đi xuyên (đứng yên khi kẹt 2 trục)", () => {
    let e = slimeAt(10, 10);
    e = { ...e, fsm: "chase" };
    const player = { x: e.x + 4 * TS, y: e.y };
    const allSolid = () => true;
    const moved = nextEnemy(e, player, 1000, 1000, seqRng([0.5]), allSolid, TS);
    expect(moved.x).toBe(e.x);
    expect(moved.y).toBe(e.y);
  });

  it("dead → đúng respawnAt hồi sinh đầy máu tại spawn", () => {
    const e = slimeAt(10, 10);
    const dmg = damageEnemy(e, 99, 5000, seqRng([1]));
    expect(dmg.enemy.fsm).toBe("dead");
    const respawnMs = 45_000; // sprout_slime
    const still = nextEnemy(dmg.enemy, { x: 0, y: 0 }, 5000 + respawnMs - 1, 16, seqRng([0.5]), NEVER_SOLID, TS);
    expect(still.fsm).toBe("dead");
    const back = nextEnemy(dmg.enemy, { x: 0, y: 0 }, 5000 + respawnMs + 1, 16, seqRng([0.5]), NEVER_SOLID, TS);
    expect(back.fsm).toBe("wander");
    expect(back.hp).toBe(2);
    expect(back.x).toBe(back.spawnX);
  });
});

describe("damageEnemy + rollLoot (W5 P2)", () => {
  it("hp giảm dần, chưa chết không drops", () => {
    const e = slimeAt(10, 10); // hp 2
    const h1 = damageEnemy(e, 1, 1000, seqRng([0]));
    expect(h1.enemy.hp).toBe(1);
    expect(h1.enemy.fsm).toBe("wander");
    expect(h1.drops).toEqual([]);
    expect(h1.xp).toBe(0);
  });

  it("chết: drops theo bảng chance (rng < chance → rơi), xp đúng", () => {
    const e = slimeAt(10, 10); // loot: sprout_leaf 0.8 [1,2], slime_jelly 0.3 [1,1]
    // rng sequence: leaf-rng 0.1 (<0.8 rơi), qty-rng 0.0 → 1; jelly-rng 0.5 (≥0.3 trượt)
    const r = damageEnemy(e, 2, 1000, seqRng([0.1, 0.0, 0.5]));
    expect(r.enemy.fsm).toBe("dead");
    expect(r.drops).toEqual([{ itemId: "sprout_leaf", qty: 1 }]);
    expect(r.xp).toBe(10);
  });

  it("đánh dead thêm lần nữa → no-op", () => {
    const e = slimeAt(10, 10);
    const dead = damageEnemy(e, 2, 1000, seqRng([1])).enemy;
    const again = damageEnemy(dead, 5, 2000, seqRng([1]));
    expect(again.enemy).toBe(dead);
    expect(again.drops).toEqual([]);
  });

  it("rollLoot độc lập mỗi entry (2 items cùng rơi)", () => {
    const table = [
      { itemId: "a", chance: 0.5 },
      { itemId: "b", chance: 0.5, qty: [2, 3] as [number, number] },
    ];
    // rng: a 0.1 rơi; b 0.2 rơi qty rng 0.0 → 2
    expect(rollLoot(table, seqRng([0.1, 0.2, 0.0]))).toEqual([
      { itemId: "a", qty: 1 },
      { itemId: "b", qty: 2 },
    ]);
  });
});

describe("touchPlayer (W5 P2)", () => {
  it("chạm < 0.7 tile → energy + knockback hướng đẩy RA KHỎI quái + invuln", () => {
    const e = slimeAt(10, 10); // dmg 8
    const player = { x: e.x + 0.5 * TS, y: e.y };
    const t = touchPlayer(e, player, 0, 1000, TS);
    expect(t).not.toBeNull();
    expect(t!.energyLoss).toBe(8);
    expect(t!.knockbackVec.x).toBeGreaterThan(0); // đẩy về +x (ra khỏi quái)
    expect(Math.abs(t!.knockbackVec.y)).toBeLessThan(0.01);
    // W5 review: magnitude từ def.knockback (40-52px) — scene nhân ×8 thành px/s.
    expect(t!.knockbackPx).toBeGreaterThan(0);
    expect(t!.invulnMs).toBe(COMBAT_TUNE.invulnMs);
  });

  it("xa hơn 0.7 tile → null; invuln còn → null; dead quái → null", () => {
    const e = slimeAt(10, 10);
    const far = { x: e.x + 0.9 * TS, y: e.y };
    expect(touchPlayer(e, far, 0, 1000, TS)).toBeNull();
    const near = { x: e.x + 0.4 * TS, y: e.y };
    expect(touchPlayer(e, near, 2000, 1000, TS)).toBeNull(); // invulnUntil 2000
    const dead = { ...e, fsm: "dead" as const };
    expect(touchPlayer(dead, near, 0, 1000, TS)).toBeNull();
  });
});

describe("chebyshevTiles + makeEnemy (W5 P2)", () => {
  it("chebyshev: đường chéo tính 1; makeEnemy giữa tile", () => {
    expect(chebyshevTiles({ x: 0, y: 0 }, { x: TS, y: TS }, TS)).toBe(1);
    expect(chebyshevTiles({ x: 0, y: 0 }, { x: TS, y: 0 }, TS)).toBe(1);
    const e = makeEnemy("x", "myconid_purple", 3, 4, TS);
    expect(e).toMatchObject({ x: 3 * TS + TS / 2, y: 4 * TS + TS / 2, hp: 5 });
  });

  it("makeEnemy defId lạ → null", () => {
    expect(makeEnemy("x", "boss_khong_ton_tai", 0, 0, TS)).toBeNull();
  });
});
