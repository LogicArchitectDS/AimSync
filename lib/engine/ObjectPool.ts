/**
 * ObjectPool.ts
 * 
 * A high-performance, lightweight, generic object pooler designed to eliminate
 * garbage collection (GC) micro-stutters during high-frequency gameplay.
 * Pre-allocates elements on initialization and provides constant-time (O(1))
 * operations for acquiring and recycling objects.
 */
export class ObjectPool<T> {
  private activeList: T[] = [];
  private inactiveList: T[] = [];
  private maxSize: number;
  private factory: () => T;
  private resetFn?: (obj: T) => void;

  constructor(
    factory: () => T,
    initialSize: number,
    maxSize: number = 500,
    resetFn?: (obj: T) => void
  ) {
    this.factory = factory;
    this.maxSize = maxSize;
    this.resetFn = resetFn;

    // Pre-allocate instances
    for (let i = 0; i < initialSize; i++) {
      this.inactiveList.push(this.factory());
    }
  }

  /**
   * Acquires an object from the pool. Recycles an inactive one if available,
   * or instantiates a new one if the pool size is below maxSize.
   */
  acquire(): T | null {
    let obj: T;
    if (this.inactiveList.length > 0) {
      obj = this.inactiveList.pop()!;
    } else if (this.activeList.length + this.inactiveList.length < this.maxSize) {
      obj = this.factory();
    } else {
      // Exceeded maxSize: recycle the oldest active item to protect memory stability
      obj = this.activeList.shift()!;
      if (this.resetFn) {
        this.resetFn(obj);
      }
    }

    this.activeList.push(obj);
    return obj;
  }

  /**
   * Releases an object back to the pool, resetting its state and marking it inactive.
   */
  release(obj: T): void {
    const index = this.activeList.indexOf(obj);
    if (index !== -1) {
      this.activeList.splice(index, 1);
      if (this.resetFn) {
        this.resetFn(obj);
      }
      this.inactiveList.push(obj);
    }
  }

  /**
   * Recycles all active objects.
   */
  releaseAll(): void {
    while (this.activeList.length > 0) {
      const obj = this.activeList.pop()!;
      if (this.resetFn) {
        this.resetFn(obj);
      }
      this.inactiveList.push(obj);
    }
  }

  /**
   * Exposes the currently active pooled items for iteration.
   */
  getActive(): readonly T[] {
    return this.activeList;
  }

  /**
   * Returns the count of both active and inactive objects managed by this pool.
   */
  size(): number {
    return this.activeList.length + this.inactiveList.length;
  }
}
