// Object pooling (ADR-015). Tránh GC spike: acquire/release thay new Sprite().
// Use phase 4 (entities) + phase 7 (blood-moon waves). GC pause target < 5ms.
// Generic: T = any pooled object; factory tạo mới khi free rỗng.

export class SpritePool<T> {
  private free: T[] = [];
  private active: Set<T> = new Set();
  private factory: () => T;
  private onAcquire?: (obj: T, x: number, y: number) => void;
  private onRelease?: (obj: T) => void;

  constructor(
    factory: () => T,
    opts?: {
      onAcquire?: (obj: T, x: number, y: number) => void;
      onRelease?: (obj: T) => void;
    },
  ) {
    this.factory = factory;
    this.onAcquire = opts?.onAcquire;
    this.onRelease = opts?.onRelease;
  }

  /** Pre-create n object vào free list (tránh runtime alloc). */
  prewarm(n: number): void {
    for (let i = 0; i < n; i++) this.free.push(this.factory());
  }

  /** Lấy 1 object, đặt tại (x,y). Từ free hoặc factory mới. */
  acquire(x: number, y: number): T {
    const obj = this.free.pop() ?? this.factory();
    this.active.add(obj);
    this.onAcquire?.(obj, x, y);
    return obj;
  }

  /** Trả object về free (deactivate). */
  release(obj: T): void {
    if (!this.active.has(obj)) return; // double-release guard
    this.active.delete(obj);
    this.onRelease?.(obj);
    this.free.push(obj);
  }

  /** Trả tất cả active về free (vd scene shutdown). */
  releaseAll(): void {
    for (const obj of this.active) {
      this.onRelease?.(obj);
      this.free.push(obj);
    }
    this.active.clear();
  }

  get activeCount(): number {
    return this.active.size;
  }

  get freeCount(): number {
    return this.free.length;
  }
}
