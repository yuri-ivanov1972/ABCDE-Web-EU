interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class TTLCache<T> {
  private store = new Map<string, CacheEntry<T>>();
  private readonly maxSize: number;

  constructor(maxSize = 200) {
    this.maxSize = maxSize;
  }

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.data;
  }

  set(key: string, data: T, ttlMs: number): void {
    if (this.store.size >= this.maxSize) {
      // First pass: evict expired entries
      const now = Date.now();
      for (const [k, v] of this.store) {
        if (now > v.expiresAt) this.store.delete(k);
        if (this.store.size < this.maxSize) break;
      }
      // If still at capacity, evict the oldest (first inserted) entry
      if (this.store.size >= this.maxSize) {
        const oldest = this.store.keys().next().value;
        if (oldest !== undefined) this.store.delete(oldest);
      }
    }
    this.store.set(key, { data, expiresAt: Date.now() + ttlMs });
  }

  invalidate(prefix?: string): void {
    if (!prefix) {
      this.store.clear();
      return;
    }
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  size(): number {
    return this.store.size;
  }
}

const PRODUCTS_TTL_MS = 15 * 60 * 1000;
const CATEGORIES_TTL_MS = 30 * 60 * 1000;

export const productsCache = new TTLCache<{ products: any[]; totalCount: number }>(200);
export const categoriesCache = new TTLCache<any>(200);

export { PRODUCTS_TTL_MS, CATEGORIES_TTL_MS };
