import { neon } from "@neondatabase/serverless";
import { LookupFailure, safeCanonicalIds, type LookupRow, type LookupSource } from "./barboraLookup";

// HTTP transport gives each request its own AbortSignal without changing shared
// website pools. Read-only transactions set a LOCAL, server-side 2-second bound.
function reader(url: string) {
  const sql = neon(url);
  return async (text: string, params: unknown[], signal: AbortSignal) => {
    signal.throwIfAborted();
    const result = await sql.transaction([
      sql.query("SELECT set_config('statement_timeout', '2000', true)"),
      sql.query(text, params),
    ], { readOnly: true, fetchOptions: { signal } });
    return result[1]!;
  };
}

function configuredReader(url?: string) {
  if (!url) return null;
  try { return reader(url); } catch { return null; }
}

export function createBarboraDatabase(config = {
  maximaUrl: process.env.MAXIMA_DATABASE_URL, rimiUrl: process.env.RIMI_DATABASE_URL,
}): LookupSource {
  // Bad optional configuration disables lookup/links, not the whole website.
  // The public route reports a fixed 503; never print constructor/URL errors.
  const maxima = configuredReader(config.maximaUrl);
  const rimi = configuredReader(config.rimiUrl);
  return {
    async rows(ids, signal) {
      if (!maxima) throw new LookupFailure("lookup_unavailable");
      try {
        return await maxima(
          `SELECT p.sku,p.product_id,p.name,nf.nutri_score_grade
           FROM products p LEFT JOIN nutritionfacts nf ON nf.product_id=p.product_id
           WHERE p.sku=ANY($1::text[]) LIMIT 201`, [ids], signal,
        ) as LookupRow[];
      } catch (error) {
        if (signal.aborted) throw signal.reason;
        // PostgreSQL statement timeout. Never expose raw driver errors.
        throw new LookupFailure((error as { code?: string })?.code === "57014"
          ? "lookup_timeout" : "lookup_unavailable");
      }
    },
    async safeLinkIds(rows, signal) {
      if (!rimi || !rows.length) return new Set<number>();
      const ids = [...new Set(rows.map(row => row.product_id))];
      const other = await rimi(
        "SELECT product_id,name FROM products WHERE product_id=ANY($1::int[]) LIMIT 101",
        [ids], signal,
      ) as { product_id: number; name: string }[];
      return safeCanonicalIds(rows, other);
    },
  };
}
