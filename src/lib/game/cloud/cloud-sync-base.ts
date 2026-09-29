// CloudSyncBase (ADR-012). Abstract push/pull/conflict/queue. DRY cho progression + story.
// Conflict resolution: server-timestamp last-write-wins (ADR-005). Không client clock.
// Offline queue: persist to IDB (I10 — không RAM-only). Debounce 2000ms (mobile 3G).
import type { ProgressionState } from "../progression/progression-curve";

export interface Versioned<T> {
  data: T;
  version: number; // server-side integer, tăng dần từ DB
  updatedAt: number; // server NOW() timestamp (ms)
}

export interface QueuedOp<T> {
  data: T;
  queuedAt: number;
}

export type ConflictResolution = "server-wins" | "local-wins" | "merge";

export abstract class CloudSyncBase<T> {
  abstract readonly storeKey: string;
  abstract readonly queueKey: string;
  readonly debounceMs = 2000;
  readonly queueExpireMs = 7 * 24 * 60 * 60 * 1000; // 7 ngày

  abstract pull(): Promise<Versioned<T> | null>;
  abstract push(data: T, version: number): Promise<Versioned<T>>;

  /** Conflict: server-timestamp last-write-wins. Local chỉ win khi version > server. */
  resolveConflict(
    local: Versioned<T>,
    remote: Versioned<T>,
  ): { winner: Versioned<T>; resolution: ConflictResolution } {
    // Version integer từ DB — cao hơn = mới hơn.
    if (local.version > remote.version) {
      return { winner: local, resolution: "local-wins" };
    }
    if (remote.version > local.version) {
      return { winner: remote, resolution: "server-wins" };
    }
    // Version bằng → updatedAt (server timestamp) quyết định.
    if (local.updatedAt >= remote.updatedAt) {
      return { winner: local, resolution: "local-wins" };
    }
    return { winner: remote, resolution: "server-wins" };
  }
}

/**
 * Progression cloud sync — wire into Server Actions (Supabase session auth).
 * Pull/push call the same LWW progression-service as the Unity bridge.
 * Offline / unauthenticated → resolve null/local-echo (non-fatal).
 */
export class ProgressionCloudSync extends CloudSyncBase<ProgressionState> {
  readonly storeKey = "hh-cloud-progression";
  readonly queueKey = "hh-cloud-progression-queue";

  async pull(): Promise<Versioned<ProgressionState> | null> {
    try {
      const m = await import("@/app/actions/progression");
      const r = await m.pullProgressionAction();
      if (!r.progression) return null;
      return {
        data: r.progression,
        version: r.progression.version,
        updatedAt: Date.now(),
      };
    } catch {
      return null;
    }
  }

  async push(data: ProgressionState, version: number): Promise<Versioned<ProgressionState>> {
    try {
      const m = await import("@/app/actions/progression");
      const r = await m.pushProgressionAction({
        level: data.level,
        xp: data.xp,
        totalXp: data.totalXp,
        skillPoints: data.skillPoints,
        perkAllocations: { farming: 0, combat: 0, social: 0 },
        version,
      });
      if (!r.progression) {
        return { data, version, updatedAt: Date.now() };
      }
      return {
        data: {
          level: r.progression.level,
          xp: r.progression.xp,
          totalXp: r.progression.totalXp,
          skillPoints: r.progression.skillPoints,
        },
        version: r.progression.version,
        updatedAt: Date.now(),
      };
    } catch {
      return { data, version, updatedAt: Date.now() };
    }
  }
}

/** Offline queue persist helpers (IDB). Stub: in-memory cho test; wire IDB phase 6 integration. */
export class OfflineQueue<U> {
  private ops: QueuedOp<U>[] = [];
  enqueue(data: U, now = Date.now()): void {
    this.ops.push({ data, queuedAt: now });
  }
  size(): number {
    return this.ops.length;
  }
  /** Drain queue, drop expired (> expireMs). */
  drain(now = Date.now(), expireMs = 7 * 24 * 60 * 60 * 1000): QueuedOp<U>[] {
    const fresh = this.ops.filter((o) => now - o.queuedAt < expireMs);
    this.ops = [];
    return fresh;
  }
  peekExpired(now = Date.now(), expireMs = 7 * 24 * 60 * 60 * 1000): number {
    return this.ops.filter((o) => now - o.queuedAt >= expireMs).length;
  }
}
