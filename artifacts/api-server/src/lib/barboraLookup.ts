import { LookupBarboraNutriscoresResponse } from "@workspace/api-zod";
import { productSlug } from "../utils/slugify";

export type Grade = "A" | "B" | "C" | "D" | "E";
export type Badge = { nutri_score: Grade; abcde_url?: string };
export type LookupRow = {
  sku: string; product_id: number; name: string; nutri_score_grade: string | null;
};
export type LookupSource = {
  rows(ids: string[], signal: AbortSignal): Promise<LookupRow[]>;
  // Optional Rimi metadata guard ONLY: never a grade source or lookup fallback.
  safeLinkIds(rows: LookupRow[], signal: AbortSignal): Promise<Set<number>>;
};
export class LookupFailure extends Error {
  constructor(public code: "lookup_timeout" | "lookup_unavailable") { super(code); }
}

export function safeCanonicalIds(rows: LookupRow[],
  other: { product_id: number; name: string }[]) {
  if (other.length > 100) return new Set<number>();
  const grouped = new Map<number, typeof other>();
  for (const row of other) {
    const group = grouped.get(row.product_id) ?? [];
    group.push(row); grouped.set(row.product_id, group);
  }
  return new Set(rows.filter(row => {
    const candidates = grouped.get(row.product_id) ?? [];
    return candidates.length <= 1 && candidates.every(otherRow =>
      typeof otherRow.name === "string" &&
      productSlug(otherRow.name, row.product_id) !== productSlug(row.name, row.product_id));
  }).map(row => row.product_id));
}

export function createBarboraLookup(source: LookupSource, options: {
  now?: () => number; ttlMs?: number; capacity?: number;
} = {}) {
  const now = options.now ?? Date.now;
  const ttl = options.ttlMs ?? 60_000;
  const capacity = options.capacity ?? 2000;
  const cache = new Map<string, { until: number; badge: Badge | null }>();
  return async (ids: string[], signal: AbortSignal) => {
    signal.throwIfAborted();
    const keys = [...new Set(ids)];
    const products: Record<string, Badge> = Object.create(null);
    const missing: string[] = [];
    for (const id of keys) {
      const hit = cache.get(id);
      if (hit && hit.until > now()) {
        cache.delete(id); cache.set(id, hit);
        if (hit.badge) products[id] = { ...hit.badge };
      } else {
        cache.delete(id); missing.push(id);
      }
    }
    if (missing.length) {
      const rows = await source.rows(missing, signal);
      signal.throwIfAborted();
      if (rows.length > 200) throw new LookupFailure("lookup_unavailable");
      const requested = new Set(missing);
      const groups = new Map<string, LookupRow[]>();
      for (const row of rows) {
        if (!requested.has(row.sku)) throw new LookupFailure("lookup_unavailable");
        const group = groups.get(row.sku) ?? [];
        group.push(row); groups.set(row.sku, group);
      }
      const valid = [...groups.values()].filter(group => group.length === 1)
        .map(group => group[0]!)
        .filter(row => /^[A-E]$/.test(row.nutri_score_grade ?? "") &&
          Number.isSafeInteger(row.product_id) && row.product_id > 0 &&
          typeof row.name === "string" && row.name.length > 0);
      // A failed link guard removes links, not valid Maxima grades.
      const safe = await source.safeLinkIds(valid, signal).catch(() => new Set<number>());
      signal.throwIfAborted();
      const badges = new Map<string, Badge>();
      for (const row of valid) {
        const badge: Badge = { nutri_score: row.nutri_score_grade as Grade };
        const slug = productSlug(row.name, row.product_id);
        if (safe.has(row.product_id) && /^[a-z0-9][a-z0-9-]*-\d+$/.test(slug)) {
          badge.abcde_url = `https://abcde.lv/lv/product/${slug}`;
        }
        badges.set(row.sku, badge);
      }
      // Commit atomically only after all work succeeds, never cache DB failures.
      for (const id of missing) {
        const badge = badges.get(id) ?? null;
        cache.set(id, { until: now() + ttl, badge });
        if (badge) products[id] = { ...badge };
        while (cache.size > capacity) cache.delete(cache.keys().next().value!);
      }
    }
    return LookupBarboraNutriscoresResponse.parse({ products });
  };
}
