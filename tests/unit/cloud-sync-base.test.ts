import { describe, it, expect, beforeEach } from "vitest";
import {
  CloudSyncBase,
  ProgressionCloudSync,
  OfflineQueue,
  type Versioned,
} from "../../src/lib/game/cloud/cloud-sync-base";

// Concrete test subclass (CloudSyncBase abstract).
class TestSync extends CloudSyncBase<{ level: number }> {
  readonly storeKey = "test";
  readonly queueKey = "test-q";
  remote: Versioned<{ level: number }> | null = null;
  async pull() {
    return this.remote;
  }
  async push(data: { level: number }, version: number) {
    return { data, version, updatedAt: Date.now() };
  }
}

describe("CloudSyncBase conflict resolution (server-timestamp LWW)", () => {
  let sync: TestSync;
  beforeEach(() => {
    sync = new TestSync();
  });

  it("remote version cao hơn → server-wins", () => {
    const local = { data: { level: 3 }, version: 1, updatedAt: 1000 };
    const remote = { data: { level: 5 }, version: 2, updatedAt: 2000 };
    const r = sync.resolveConflict(local, remote);
    expect(r.resolution).toBe("server-wins");
    expect(r.winner.data.level).toBe(5);
  });

  it("local version cao hơn → local-wins", () => {
    const local = { data: { level: 5 }, version: 2, updatedAt: 1000 };
    const remote = { data: { level: 3 }, version: 1, updatedAt: 2000 };
    const r = sync.resolveConflict(local, remote);
    expect(r.resolution).toBe("local-wins");
    expect(r.winner.data.level).toBe(5);
  });

  it("version bằng → updatedAt quyết định", () => {
    const local = { data: { level: 3 }, version: 2, updatedAt: 5000 };
    const remote = { data: { level: 5 }, version: 2, updatedAt: 2000 };
    const r = sync.resolveConflict(local, remote);
    expect(r.resolution).toBe("local-wins");
  });

  it("ProgressionCloudSync concrete keys", () => {
    const pcs = new ProgressionCloudSync();
    expect(pcs.storeKey).toBe("hh-cloud-progression");
    expect(pcs.queueKey).toBe("hh-cloud-progression-queue");
    expect(pcs.debounceMs).toBe(2000);
  });
});

describe("OfflineQueue (persist — in-memory stub)", () => {
  let q: OfflineQueue<{ level: number }>;
  beforeEach(() => {
    q = new OfflineQueue();
  });

  it("enqueue + size", () => {
    expect(q.size()).toBe(0);
    q.enqueue({ level: 1 });
    q.enqueue({ level: 2 });
    expect(q.size()).toBe(2);
  });

  it("drain trả ops + clear queue", () => {
    q.enqueue({ level: 1 }, 1000);
    q.enqueue({ level: 2 }, 2000);
    const drained = q.drain(3000);
    expect(drained).toHaveLength(2);
    expect(q.size()).toBe(0);
  });

  it("drain drop expired (> 7 ngày)", () => {
    q.enqueue({ level: 1 }, 1000);
    const week = 7 * 24 * 60 * 60 * 1000;
    const drained = q.drain(1000 + week + 1, week);
    expect(drained).toHaveLength(0); // expired
  });

  it("peekExpired đếm op quá hạn", () => {
    q.enqueue({ level: 1 }, 1000);
    const week = 7 * 24 * 60 * 60 * 1000;
    expect(q.peekExpired(1000 + week + 1, week)).toBe(1);
  });
});
