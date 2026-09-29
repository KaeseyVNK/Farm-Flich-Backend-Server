import {
  MAP_COLS,
  MAP_ROWS,
  DOG_VISION_TILES,
  DOG_HEARING_TILES,
  MAX_BITES,
  TICK_MS,
  MAX_RAID_TICKS,
  dogVisionForLevel,
  dogHearingForLevel,
  trapDurabilityForLevel,
  DOG_CHASE_SPEED_MUL,
} from "./constants.js";
import { bfsNext, lineOfSight, solidFromTerrain, type SolidFn } from "./dog.js";
import { breedStats, breedById } from "./dog-catalog.js";
import { AlertState } from "./alert.js";
import { mulberry32, hashStr } from "./rng.js";
import { getMaskEffect, DEFAULT_MASK_EFFECT, type MaskEffect } from "./mask-effects.js";
import { getBiome, bloodMoonBiome, type BiomeConfig, DEFAULT_BIOME as DEFAULT_BIOME_CFG } from "./raid-map-config.js";
import { springTrap, type Trap, type TrapKind } from "./trap.js";
import { LOCKDOWN_CLOSE_TICKS } from "./lockdown.js";
import type { RaidEventRow } from "./replay-types.js";
import type { ChestKind } from "./loot-tables.js";
import type { AlertLevel, Facing, Tile } from "./types.js";
import type { EntityMsg, SnapshotMsg } from "./protocol.js";

export interface Raider {
  x: number;
  y: number;
  dx: number;
  dy: number;
  facing: Facing;
  /** Bear trap slow window (tick-based, KHÔNG wall-clock — audit re-sim). */
  slowUntilTick: number;
}
export interface Dog {
  id: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  facing: Facing;
  patrol: Tile[];
  patrolIdx: number;
  /** W7b: giống (stats — catalog). */
  breed: string;
  /** W7b-P3: đang mải ăn mồi đến tick này (bỏ chase/patrol). */
  busyUntilTick: number;
}
export interface Chest {
  id: string;
  x: number;
  y: number;
  open: boolean;
  kind: ChestKind;
}

function dist(a: Tile, b: Tile): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)); // Chebyshev
}

/** Alert bump per chest kind (concept §8 — chest khó hơn gây tiếng động hơn). */
const CHEST_ALERT_BUMP: Record<ChestKind, number> = { wood: 8, iron: 12, safe: 18 };

/**
 * RaidRoom — orchestrator 1 raid. Server-authoritative.
 * Dog AI auto-patrol v1 (waypoints AI-gen, owner-set = roadmap).
 * Bite 3 = caught (concept §10.1). Alert FSM từ dog.ts/alert.ts (đã test).
 */
export class RaidRoom {
  raider: Raider;
  dogs: Dog[];
  /** W7b-P3: mồi thief đặt (tối đa 2 lần/raid) — dog !lureImmune ngửi tới ăn. */
  placedItems: { itemId: string; x: number; y: number }[] = [];
  itemUses = 0;
  chests: Chest[];
  /**
   * Alert FSM. nowMs inject tick-based (`tickN * TICK_MS`) — KHÔNG Date.now,
   * đảm bảo replay re-sim determinism (audit C5).
   */
  alert = new AlertState(() => this.tickN * TICK_MS);
  readonly terrain: number[];
  tickN = 0;
  bites = 0;
  /** Defense upgrade levels (phase 3) — override dog vision/hearing + trap durability. */
  dogLevel = 1;
  trapLevel = 1;
  /** Mask effect modifier (phase 4) — server-resolved maskId. */
  maskEffect: MaskEffect = DEFAULT_MASK_EFFECT;
  /** Biome alertMod (phase 7) — vision/hearing/decay multiplier. */
  biome: BiomeConfig = DEFAULT_BIOME_CFG;
  /** Phase 7 blood-moon raid — biome override active (dog AI mạnh hơn). */
  bloodMoon = false;
  /** W7d-P1: owner guard-rep ≥ 50 → dog vision +1 tile. */
  guardBonus = false;
  lockdown = false;
  /** Lockdown chase accumulator (phase 9 F9.3) — extra step cho dog mỗi khi ≥1. */
  chaseSpeedAcc = 0;
  /** Tick-based gate close deadline (concept §11) — KHÔNG wall-clock, đảm bảo determinism re-sim. */
  gateCloseTick = 0;
  /** Loot tạm giữ khi mở chest — finalize mới commit DB (loss-cap). */
  lootTemp: { itemId: string; qty: number }[] = [];
  /** Traps (server-only, KHÔNG trong snapshot — audit H5). */
  traps: Trap[] = [];
  /** Puzzle seq per chest (gen 1 lần, deterministic). */
  private chestPuzzles = new Map<string, number[]>();
  /** Trap spring events chờ flush (emit 1 lần/dẫm). */
  pendingTrapEvents: { tile: number; kind: TrapKind; damage: number }[] = [];
  ended: null | { reason: "exit" | "caught" | "timeout" } = null;

  constructor(opts: {
    terrain: number[];
    enterTile: Tile;
    dogs: { x: number; y: number; breed?: string; patrol?: Tile[] }[];
    chests: { id: string; x: number; y: number; kind?: ChestKind }[];
    seed: string;
    traps?: Trap[];
    dogLevel?: number;
    trapLevel?: number;
    maskId?: string;
    mapId?: string;
    /** Blood-moon raid (phase 7). Server-read (không client flag). Áp biome override
     *  — dog AI mạnh hơn (vision/hearing ×1.5, decay ×0.9). Deterministic cho replay. */
    bloodMoon?: boolean;
    /** W7d-P1: owner guard-rep ≥ 50 → dog vision +1 tile (§14). % trên tầm 6
     *  bị floor nuốt (6×1.05=6) — flat +1 là cách "+5% nhạy hơn" có hiệu lực thật.
     *  Persist trên RaidSession.guardBonus cho replay re-sim. */
    guardBonus?: boolean;
  }) {
    this.terrain = opts.terrain;
    this.dogLevel = opts.dogLevel ?? 1;
    this.trapLevel = opts.trapLevel ?? 1;
    this.maskEffect = getMaskEffect(opts.maskId ?? "");
    const baseBiome = getBiome(opts.mapId ?? "farm");
    this.bloodMoon = opts.bloodMoon ?? false;
    this.guardBonus = opts.guardBonus ?? false;
    this.biome = this.bloodMoon ? bloodMoonBiome(baseBiome) : baseBiome;
    this.raider = { x: opts.enterTile.x, y: opts.enterTile.y, dx: 0, dy: 0, facing: "down", slowUntilTick: 0 };
    this.dogs = opts.dogs.map((d, i) => ({
      id: `dog${i}`,
      x: d.x,
      y: d.y,
      dx: 0,
      dy: 0,
      facing: "down" as Facing,
      // W7b-P2: patrol CHỦ đặt thắng gen AI (đã validate ở caller; fallback gen).
      patrol: d.patrol && d.patrol.length >= 2 ? d.patrol : this.genPatrol(d, opts.seed + i),
      patrolIdx: 0,
      breed: breedById(d.breed ?? "")?.id ?? "retriever", // sanitize — breed lạ → default
      busyUntilTick: 0,
    }));
    this.chests = opts.chests.map((c) => ({ ...c, open: false, kind: c.kind ?? "wood" }));
    // Trap durability +level bonus (phase 3).
    this.traps = (opts.traps ?? []).map((t) => ({
      ...t,
      durability: trapDurabilityForLevel(this.trapLevel, t.durability),
    }));
  }

  get solid(): SolidFn {
    return solidFromTerrain(this.terrain);
  }

  /** Auto-patrol waypoints: lướt 4 góc quanh vị trí dog (AI gen, deterministic). */
  private genPatrol(origin: Tile, seed: string): Tile[] {
    const rng = mulberry32(hashStr(seed));
    const pts: Tile[] = [origin];
    for (let i = 0; i < 3; i++) {
      pts.push({
        x: Math.max(0, Math.min(MAP_COLS - 1, origin.x + Math.floor((rng() - 0.5) * 10))),
        y: Math.max(0, Math.min(MAP_ROWS - 1, origin.y + Math.floor((rng() - 0.5) * 10))),
      });
    }
    return pts;
  }

  /** W7b-P3: thief đặt mồi tại tile — cap 2/raid (server-authoritative). */
  useItem(itemId: string, x: number, y: number): boolean {
    if (this.itemUses >= 2) return false;
    if (typeof itemId !== "string" || itemId.length === 0 || itemId.length > 40) return false;
    if (!Number.isInteger(x) || x < 0 || x >= MAP_COLS) return false;
    if (!Number.isInteger(y) || y < 0 || y >= MAP_ROWS) return false;
    if (this.solid(x, y)) return false; // mồi trên solid → dog không tới được
    this.itemUses++;
    this.placedItems.push({ itemId, x, y });
    return true;
  }

  /** Raider move (intent từ client). Collision solid. Bear slow → skip 50% tick. */
  applyMove(dx: -1 | 0 | 1, dy: -1 | 0 | 1): void {
    this.raider.dx = dx;
    this.raider.dy = dy;
    if (dx === 0 && dy === 0) return;
    // Bear trap slow: trong slow window skip move. Rogue mask (speedMult>1) skip ít hơn.
    const slowSkipMod = this.maskEffect.speedMult > 1 ? 3 : 2; // rogue skip 1/3, default 1/2
    if (this.tickN < this.raider.slowUntilTick && this.tickN % slowSkipMod === 0) return;
    this.raider.facing = dy < 0 ? "up" : dy > 0 ? "down" : dx < 0 ? "left" : "right";
    const nx = this.raider.x + dx;
    const ny = this.raider.y + dy;
    if (!this.solid(nx, ny)) {
      this.raider.x = nx;
      this.raider.y = ny;
    }
  }

  /** Mở chest khi puzzle solve. Loot tạm — finalize commit. Alert bump per kind (wood 8/iron 12/safe 18). */
  openChest(chestId: string, loot: { itemId: string; qty: number }): boolean {
    const chest = this.chests.find((c) => c.id === chestId);
    if (!chest || chest.open) return false;
    chest.open = true;
    this.lootTemp.push(loot);
    this.alert.bump(CHEST_ALERT_BUMP[chest.kind]);
    return true;
  }

  /** Lấy/gen puzzle seq cho chest (deterministic từ seed). */
  getOrGenPuzzle(chestId: string, seed: string, gen: (s: string) => number[]): number[] {
    let seq = this.chestPuzzles.get(chestId);
    if (!seq) {
      seq = gen(seed + ":" + chestId);
      this.chestPuzzles.set(chestId, seq);
    }
    return seq;
  }

  /** 1 tick (10 Hz): dog AI + alert decay + bite check + trap collision + lockdown deadline. */
  tick(dtMs: number): void {
    this.tickN++;
    // Review H3: hard cap thời lượng raid (~35 phút @10Hz). Raider idle góc map
    // không bao giờ bị caught → farm kẹt active mãi (watchdog bỏ qua room còn
    // trong memory). Timeout = forfeit loot (khác lockdown gateClose riêng).
    if (!this.ended && this.tickN >= MAX_RAID_TICKS) {
      this.ended = { reason: "timeout" };
    }
    this.alert.tick(dtMs, this.maskEffect.alertDecayMult * this.biome.decayMul);
    for (const dog of this.dogs) this.tickDog(dog);
    if (this.bites >= MAX_BITES) this.ended = { reason: "caught" };
    this.checkTrapCollision();
    // Lockdown hard deadline (concept §11): tick-based, hết gate close tick → timeout.
    if (this.lockdown && this.gateCloseTick > 0 && this.tickN >= this.gateCloseTick) {
      this.ended = { reason: "timeout" };
    }
  }

  /** Trap collision: raider tile ∈ trap.tiles → spring + decay + remove nếu hết durability. */
  private checkTrapCollision(): void {
    if (this.traps.length === 0) return;
    const raiderTile = this.raider.y * MAP_COLS + this.raider.x;
    for (let i = this.traps.length - 1; i >= 0; i--) {
      const t = this.traps[i];
      if (t.tile !== raiderTile) continue;
      const res = springTrap(this, t);
      this.pendingTrapEvents.push(res.event);
      if (res.removed) this.traps.splice(i, 1);
    }
  }

  private tickDog(dog: Dog): void {
    // W7b: breed stats (catalog) + level/blood-moon như cũ.
    const breed = breedStats(dog.breed);
    const vision =
      Math.floor(dogVisionForLevel(this.dogLevel, DOG_VISION_TILES) * this.maskEffect.dogVisionMult * this.biome.visionMul) +
      breed.visionAdd +
      (this.guardBonus ? 1 : 0); // W7d-P1: guard-rep ≥ 50 — nhạy hơn 1 tile
    const hearing = Math.floor(dogHearingForLevel(this.dogLevel, DOG_HEARING_TILES) * this.biome.hearingMul) + breed.hearingAdd;
    // W7b-P3: mải ăn mồi — đứng yên tại chỗ (target = vị trí mình).
    if (this.tickN < dog.busyUntilTick) return;
    const seesRaider =
      lineOfSight(dog, this.raider, this.solid) && dist(dog, this.raider) <= vision;
    const hearsRaider = dist(dog, this.raider) <= hearing;

    // W7b-P3: mồi dụ — !lureImmune ngửi item trong tầm smell (hearing×2), THẮNG
    // cả chase (mục đích thoát thân). Đến nơi → ăn 60 tick (6s @10Hz) đứng yên.
    let lured: { itemId: string; x: number; y: number } | null = null;
    if (!breed.lureImmune && this.placedItems.length > 0) {
      let nd = Infinity;
      for (const it of this.placedItems) {
        const d = Math.abs(it.x - dog.x) + Math.abs(it.y - dog.y);
        if (d < nd) {
          nd = d;
          lured = it;
        }
      }
      if (lured && nd > hearing * 2) lured = null; // ngoài tầm smell
    }

    let target: Tile;
    const chasing = (seesRaider || hearsRaider || this.alert.level === "alarm") && !lured;
    if (lured) {
      if (lured.x === dog.x && lured.y === dog.y) {
        // W7d-P2: toy chợ đen giữ chó mải chơi 10s; mồi food 6s.
        dog.busyUntilTick = this.tickN + (lured.itemId === "tool_toy" ? 100 : 60);
        this.placedItems.splice(this.placedItems.indexOf(lured), 1);
        return;
      }
      target = { x: lured.x, y: lured.y };
    } else if (chasing) {
      // chase raider
      target = { x: this.raider.x, y: this.raider.y };
      if (seesRaider) this.alert.bump(3 + breed.alertSeeBonus); // dog nhìn thấy → bump (+maan nhạy)
    } else {
      // patrol waypoint
      target = dog.patrol[dog.patrolIdx];
      if (dog.x === target.x && dog.y === target.y) {
        dog.patrolIdx = (dog.patrolIdx + 1) % dog.patrol.length;
        target = dog.patrol[dog.patrolIdx];
      }
    }
    // Lockdown escalation (phase 9 F9.3): chase ×1.4 → accumulator (deterministic, tổng ≈ 1.4x).
    // Mỗi tick chase: acc += 0.4; acc ≥ 1 → extra 1 bước, acc -= 1.
    // W7b: shepherd ×1.2 stack nhân với lockdown ×1.4 (tổng tỉ lệ, không cộng).
    const chaseSpeedMul = (this.lockdown ? DOG_CHASE_SPEED_MUL : 1) * (chasing ? breed.speedMul : 1);
    let extraSteps = 0;
    if (chasing && chaseSpeedMul > 1) {
      this.chaseSpeedAcc += chaseSpeedMul - 1;
      while (this.chaseSpeedAcc >= 1) {
        extraSteps++;
        this.chaseSpeedAcc -= 1;
      }
    }
    const step = (): void => {
      const next = bfsNext({ x: dog.x, y: dog.y }, target, this.solid);
      if (next) {
        dog.dx = Math.sign(next.x - dog.x) as -1 | 0 | 1;
        dog.dy = Math.sign(next.y - dog.y) as -1 | 0 | 1;
        dog.x = next.x;
        dog.y = next.y;
        dog.facing =
          dog.dy < 0 ? "up" : dog.dy > 0 ? "down" : dog.dx < 0 ? "left" : "right";
      } else {
        dog.dx = 0;
        dog.dy = 0;
      }
    };
    step();
    for (let i = 0; i < extraSteps; i++) {
      // bite check sau mỗi step để không bỏ lỡ catch khi speed up.
      // Cap tại MAX_BITES — trước đây không check → multi-dog + lockdown có thể
      // stack bites tới 2×MAX trong 1 tick (over-count alert, trigger caught muộn).
      if (dog.x === this.raider.x && dog.y === this.raider.y && this.bites < MAX_BITES) {
        this.bites++;
        this.alert.bump(15);
      }
      step();
    }
    // bite: dog cùng tile raider
    if (dog.x === this.raider.x && dog.y === this.raider.y && this.bites < MAX_BITES) {
      this.bites++;
      // bump mạnh khi cắn
      this.alert.bump(15);
    }
  }

  /**
   * Re-sim replay (phase 9): apply 1 RaidEvent vào room headless.
   * Tick advance tách biệt (caller gọi tick() riêng). trapSprung = marker (đã deterministic qua tick).
   */
  applyEvent(ev: RaidEventRow): void {
    switch (ev.type) {
      case "move": {
        const dx = (ev.payload.dx ?? 0) as -1 | 0 | 1;
        const dy = (ev.payload.dy ?? 0) as -1 | 0 | 1;
        this.applyMove(dx, dy);
        break;
      }
      case "chestOpen": {
        const loot = ev.payload.loot as { itemId: string; qty: number };
        if (loot) this.openChest(ev.payload.chestId as string, loot);
        break;
      }
      case "lockdown":
        this.lockdown = true;
        this.gateCloseTick = this.tickN + LOCKDOWN_CLOSE_TICKS;
        this.alert.bump(50);
        break;
      case "exit":
        this.ended = { reason: "exit" };
        break;
      case "caught":
        this.ended = { reason: "caught" };
        break;
      case "timeout":
        this.ended = { reason: "timeout" };
        break;
      case "useItem": {
        // Review W7 #4: mồi/toy đổi dog target + busy — replay phải re-apply
        // (payload log đầy đủ itemId+x+y từ index.ts).
        this.useItem(
          String(ev.payload.itemId ?? ""),
          Number(ev.payload.x ?? 0),
          Number(ev.payload.y ?? 0),
        );
        break;
      }
      case "useTool": {
        // Review W7 #4: smoke stagger mọi chó — re-apply giữ replay khớp live.
        if (ev.payload.toolId === "smoke") {
          for (const dog of this.dogs) {
            dog.busyUntilTick = Math.max(dog.busyUntilTick, this.tickN + 30);
          }
        }
        break;
      }
      // puzzleFail / tick / trapSprung / puzzleSolve = markers, state đã advance qua tick
      default:
        break;
    }
  }

  /** Snapshot 5 Hz (audit C3: kèm velocity dx,dy). KHÔNG chứa trap. */
  snapshot(): SnapshotMsg {
    return {
      tick: this.tickN,
      placedItems: this.placedItems.map((i) => ({ itemId: i.itemId, x: i.x, y: i.y })),
      you: { id: "you", x: this.raider.x, y: this.raider.y, dx: this.raider.dx, dy: this.raider.dy, facing: this.raider.facing },
      dogs: this.dogs.map((d) => ({ id: d.id, x: d.x, y: d.y, dx: d.dx, dy: d.dy, facing: d.facing })),
      // Review Low: exitDeadlineMs từng declared nhưng KHÔNG BAO GIỜ set → HUD
      // timer "—" mãi. Lockdown → wall-clock deadline = now + ticks còn lại.
      ...(this.lockdown && this.gateCloseTick > this.tickN
        ? { exitDeadlineMs: Date.now() + (this.gateCloseTick - this.tickN) * TICK_MS }
        : {}),
      // x,y để client render chest đúng pos + tìm nearest chest khi Space
      // interact (trước đây client hardcode {x:20,y:10} + chestId "chest-wood-1"
      // → multi-chest map chỉ mở 1 chest).
      chests: this.chests.map((c) => ({ id: c.id, x: c.x, y: c.y, open: c.open })),
      alert: { level: this.alert.level, score: this.alert.score },
      lockdown: this.lockdown,
      mapBiome: this.biome.biome,
      bloodMoon: this.bloodMoon,
    };
  }
}
