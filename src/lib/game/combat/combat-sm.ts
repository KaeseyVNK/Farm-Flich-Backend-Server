// Wave 5 P2 — combat state-machine thuần: swing arc hit + enemy FSM + damage/
// drops + touch player. KHÔNG import store/Phaser — scene bọc cái này (pattern
// fishing-sm). Toàn bộ tham số tune nằm COMBAT_TUNE (enemy-catalog).
import { COMBAT_TUNE, enemyById, type EnemyDef, type EnemyLootEntry } from "@/lib/game/combat/enemy-catalog";

export type Rng = () => number; // 0..1

export interface EnemyState {
  id: string;
  defId: string;
  /** Vị trí pixel trong zone. */
  x: number;
  y: number;
  spawnX: number;
  spawnY: number;
  hp: number;
  fsm: "wander" | "chase" | "dead";
  /** Hướng wander hiện tại (đơn vị dx,dy) + thời điểm đổi tiếp (ms epoch). */
  wdx: number;
  wdy: number;
  wanderNextAt: number;
  /** Thời điểm hồi sinh (ms epoch) — dead đến lúc này. */
  respawnAt: number;
}

export interface PlayerRef {
  x: number;
  y: number;
}

export type Facing = "up" | "down" | "left" | "right";

/** Khởi tạo enemy từ def + spawn point (tile → px giữa tile). */
export function makeEnemy(
  id: string,
  defId: string,
  tx: number,
  ty: number,
  tileSize: number,
): EnemyState | null {
  const def = enemyById(defId);
  if (!def) return null;
  const x = tx * tileSize + tileSize / 2;
  const y = ty * tileSize + tileSize / 2;
  return {
    id,
    defId,
    x,
    y,
    spawnX: x,
    spawnY: y,
    hp: def.hp,
    fsm: "wander",
    wdx: 0,
    wdy: 0,
    wanderNextAt: 0,
    respawnAt: 0,
  };
}

/** Chebyshev tile distance — aggro metric (8-hướng đều tính 1 bước). */
export function chebyshevTiles(a: PlayerRef, b: { x: number; y: number }, tileSize: number): number {
  const dx = Math.abs(a.x - b.x) / tileSize;
  const dy = Math.abs(a.y - b.y) / tileSize;
  return Math.max(dx, dy);
}

/**
 * Tick 1 enemy. Trả state mới (immutable-lite: trả về chính nó khi không đổi
 * cũng được — scene tự so sánh hp/fsm để render). dtMs là ms từ frame trước.
 */
export function nextEnemy(
  e: EnemyState,
  player: PlayerRef,
  now: number,
  dtMs: number,
  rng: Rng,
  solidAt: (xPx: number, yPx: number) => boolean,
  tileSize: number,
): EnemyState {
  const def = enemyById(e.defId);
  if (!def) return e;
  if (e.fsm === "dead") {
    if (now >= e.respawnAt) {
      // Hồi sinh tại spawn, đầy máu, wander lại.
      return { ...e, hp: def.hp, fsm: "wander", x: e.spawnX, y: e.spawnY, respawnAt: 0 };
    }
    return e;
  }

  const distToPlayer = chebyshevTiles(player, e, tileSize);
  const distToSpawn = chebyshevTiles({ x: e.spawnX, y: e.spawnY }, e, tileSize);

  // Leash: đuổi xa quá → về spawn (bỏ aggro, tự heal khi về tới).
  if (e.fsm === "chase" && distToSpawn > COMBAT_TUNE.leashTiles) {
    return { ...e, fsm: "wander", wdx: 0, wdy: 0, wanderNextAt: now };
  }
  if (e.fsm === "wander" && distToPlayer <= def.aggroTiles) {
    return { ...e, fsm: "chase" }; // phát hiện player
  }
  if (e.fsm === "chase" && distToPlayer > def.aggroTiles) {
    return { ...e, fsm: "wander", wdx: 0, wdy: 0, wanderNextAt: now };
  }

  const dt = dtMs / 1000;
  if (e.fsm === "chase") {
    // Đuổi thẳng player (không path-find — cozy slime).
    let dx = player.x - e.x;
    let dy = player.y - e.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    return moveEnemy(e, dx, dy, def.speed * dt, solidAt);
  }

  // Wander quanh spawn: đổi hướng ngẫu nhiên mỗi pause, đi chậm 60%.
  if (now >= e.wanderNextAt) {
    const [minP, maxP] = COMBAT_TUNE.wanderPauseMs;
    const pause = minP + rng() * (maxP - minP);
    // 30% đứng nghỉ (wdx=wdy=0), còn lại hướng ngẫu nhiên.
    if (rng() < 0.3) {
      return { ...e, wdx: 0, wdy: 0, wanderNextAt: now + pause };
    }
    const angle = rng() * Math.PI * 2;
    return {
      ...e,
      wdx: Math.cos(angle),
      wdy: Math.sin(angle),
      wanderNextAt: now + pause,
    };
  }
  // Wander nhưng không rời quá 3 tile khỏi spawn.
  if (distToSpawn >= 3 && Math.sign(e.spawnX - e.x) * e.wdx + Math.sign(e.spawnY - e.y) * e.wdy < 0) {
    // đang đi XA spawn → quay đầu
    const back = { dx: e.spawnX - e.x, dy: e.spawnY - e.y };
    const len = Math.hypot(back.dx, back.dy) || 1;
    return moveEnemy(e, back.dx / len, back.dy / len, def.speed * 0.6 * dt, solidAt);
  }
  return moveEnemy(e, e.wdx, e.wdy, def.speed * 0.6 * dt, solidAt);
}

/** Di chuyển + chặn solid (đụng tường → đứng yên, không trượt). */
function moveEnemy(
  e: EnemyState,
  dx: number,
  dy: number,
  step: number,
  solidAt: (x: number, y: number) => boolean,
): EnemyState {
  if (dx === 0 && dy === 0) return e;
  const nx = e.x + dx * step;
  const ny = e.y + dy * step;
  if (!solidAt(nx, ny)) return { ...e, x: nx, y: ny };
  if (!solidAt(nx, e.y)) return { ...e, x: nx };
  if (!solidAt(e.x, ny)) return { ...e, y: ny };
  return e; // kẹt hoàn toàn
}

/**
 * Kiểm tra 1 điểm có trong vùng hit của cú văng kiếm không.
 * Thuần toán: facing → vector tâm, reach (px), arc (độ) đối xứng quanh facing.
 * Trả true nếu tâm enemy nằm trong cung tròn (khoảng cách ≤ reach + bán kính 0.5 tile).
 */
export function inSwingArc(
  player: PlayerRef,
  facing: Facing,
  target: { x: number; y: number },
  tileSize: number,
  reachTiles: number = COMBAT_TUNE.swingReachTiles,
  arcDeg: number = COMBAT_TUNE.swingArcDeg,
): boolean {
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const dist = Math.hypot(dx, dy);
  if (dist > (reachTiles + 0.5) * tileSize) return false; // +0.5 tile thân quái
  if (dist < tileSize * 0.2) return true; // đứng đè lên nhau
  const targetAngle = (Math.atan2(dy, dx) * 180) / Math.PI; // -180..180, 0=phải
  const facingAngle =
    facing === "right" ? 0 : facing === "down" ? 90 : facing === "left" ? 180 : -90;
  let diff = targetAngle - facingAngle;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return Math.abs(diff) <= arcDeg / 2;
}

/** Cú đánh trúng những enemy nào (thứ tự mảng giữ nguyên). */
export function swingHit(
  player: PlayerRef,
  facing: Facing,
  enemies: EnemyState[],
  tileSize: number,
): EnemyState[] {
  return enemies.filter((e) => e.fsm !== "dead" && inSwingArc(player, facing, e, tileSize));
}

export interface DropRoll {
  itemId: string;
  qty: number;
}

/** Đánh quái — hp <= 0 → dead + roll loot. Trả enemy mới + drops (rỗng nếu chưa chết). */
export function damageEnemy(e: EnemyState, dmg: number, now: number, rng: Rng): { enemy: EnemyState; drops: DropRoll[]; xp: number } {
  if (e.fsm === "dead") return { enemy: e, drops: [], xp: 0 };
  const def = enemyById(e.defId)!;
  const hp = e.hp - dmg;
  if (hp > 0) return { enemy: { ...e, hp }, drops: [], xp: 0 };
  const drops = rollLoot(def.loot, rng);
  return {
    enemy: { ...e, hp: 0, fsm: "dead", respawnAt: now + def.respawnMs },
    drops,
    xp: def.xp,
  };
}

/** Roll bảng loot — mỗi entry độc lập (không mutex). */
export function rollLoot(table: EnemyLootEntry[], rng: Rng): DropRoll[] {
  const out: DropRoll[] = [];
  for (const l of table) {
    if (rng() >= l.chance) continue;
    const [min, max] = l.qty ?? [1, 1];
    out.push({ itemId: l.itemId, qty: min + Math.floor(rng() * (max - min + 1)) });
  }
  return out;
}

export interface TouchResult {
  energyLoss: number;
  knockbackVec: { x: number; y: number }; // đơn vị hướng đẩy
  /** Độ dài đẩy (px) từ def — scene áp impulse vào kinetics. */
  knockbackPx: number;
  invulnMs: number;
}

/**
 * Quái chạm player? (khoảng cách tâm < 0.7 tile). Trả null khi chưa chạm hoặc
 * còn invuln. knockback hướng TỪ quái ĐẾN player.
 */
export function touchPlayer(
  enemy: EnemyState,
  player: PlayerRef,
  playerInvulnUntil: number,
  now: number,
  tileSize: number,
): TouchResult | null {
  if (enemy.fsm === "dead") return null;
  if (now < playerInvulnUntil) return null;
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  if (Math.hypot(dx, dy) > tileSize * 0.7) return null;
  const len = Math.hypot(dx, dy) || 1;
  const def = enemyById(enemy.defId)!;
  return {
    energyLoss: def.damageEnergy,
    knockbackVec: { x: dx / len, y: dy / len },
    knockbackPx: def.knockback,
    invulnMs: COMBAT_TUNE.invulnMs,
  };
}
