import { describe, it, expect } from "vitest";
import { SpritePool } from "../../src/lib/game/phaser/sprite-pool";

interface FakeSprite {
  id: number;
  x: number;
  y: number;
  active: boolean;
}

let counter = 0;
function makeFactory() {
  counter = 0;
  return () => ({ id: counter++, x: 0, y: 0, active: false });
}

describe("SpritePool", () => {
  it("acquire từ factory khi free rỗng; track active", () => {
    const pool = new SpritePool<FakeSprite>(makeFactory());
    const a = pool.acquire(0, 0);
    expect(a.id).toBe(0); // factory tạo mới
    expect(pool.activeCount).toBe(1);
    expect(pool.freeCount).toBe(0);
  });

  it("prewarm tạo n object; acquire dùng free trước", () => {
    const pool = new SpritePool<FakeSprite>(makeFactory());
    pool.prewarm(3);
    expect(pool.freeCount).toBe(3);
    const a = pool.acquire(0, 0);
    expect(pool.freeCount).toBe(2);
    expect(pool.activeCount).toBe(1);
  });

  it("release trả về free; reuse không tạo mới", () => {
    const pool = new SpritePool<FakeSprite>(makeFactory());
    const a = pool.acquire(0, 0);
    expect(counter).toBe(1);
    pool.release(a);
    expect(pool.activeCount).toBe(0);
    expect(pool.freeCount).toBe(1);
    const b = pool.acquire(0, 0);
    expect(b).toBe(a); // reuse
    expect(counter).toBe(1); // không tạo mới
  });

  it("double-release guard — không thêm 2 lần vào free", () => {
    const pool = new SpritePool<FakeSprite>(makeFactory());
    const a = pool.acquire(0, 0);
    pool.release(a);
    pool.release(a); // no-op
    expect(pool.freeCount).toBe(1);
  });

  it("releaseAll trả tất cả active về free", () => {
    const pool = new SpritePool<FakeSprite>(makeFactory());
    pool.acquire(0, 0);
    pool.acquire(0, 0);
    pool.acquire(0, 0);
    pool.releaseAll();
    expect(pool.activeCount).toBe(0);
    expect(pool.freeCount).toBe(3);
  });

  it("onAcquire/onRelease callback fire", () => {
    const acquired: number[] = [];
    const released: number[] = [];
    const pool = new SpritePool<FakeSprite>(makeFactory(), {
      onAcquire: (o, x, y) => {
        o.x = x;
        o.y = y;
        o.active = true;
        acquired.push(o.id);
      },
      onRelease: (o) => {
        o.active = false;
        released.push(o.id);
      },
    });
    const a = pool.acquire(5, 6);
    expect(a.active).toBe(true);
    pool.release(a);
    expect(a.active).toBe(false);
    expect(acquired).toEqual([0]);
    expect(released).toEqual([0]);
  });
});
