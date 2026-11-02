// Read-only, explicit operator audit; never imported by application startup.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;
const target = process.env.MAXIMA_DATABASE_URL;
if (!target) {
  console.error("Audit blocked: external Maxima configuration unavailable.");
  process.exit(1);
}
const pool = new Pool({
  connectionString: target, max: 1, connectionTimeoutMillis: 4000,
  statement_timeout: 5000, options: "-c default_transaction_read_only=on",
});
try {
  const source = await readFile(new URL("../../../docs/barbora-extension/READ-ONLY-AUDIT.sql", import.meta.url), "utf8");
  const statements = source.replace(/--[^\n]*/g, "").split(";").map(s => s.trim()).filter(Boolean);
  if (statements.some(s => !/^SELECT\b/i.test(s))) throw new Error("Unsafe audit");
  const results = [];
  for (const text of statements) results.push((await pool.query(text)).rows);
  const plan = await pool.query(
    `EXPLAIN SELECT p.sku,p.product_id,p.name,nf.nutri_score_grade
     FROM products p LEFT JOIN nutritionfacts nf ON nf.product_id=p.product_id
     WHERE p.sku=ANY($1::text[]) LIMIT 201`,
    [["000000000000790928", "000000000000800999"]],
  );
  const report = { checkedAt: new Date().toISOString(),
    provenance: "Read-only queries through runtime-configured external MAXIMA_DATABASE_URL; no Replit-managed DB or public catalogue count substitution. Deployment secret identity not independently compared.",
    results, lookupPlan: plan.rows };
  const output = process.argv[2];
  if (output) {
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, JSON.stringify(report, null, 2) + "\n");
  }
  console.log(JSON.stringify(report, null, 2));
} catch {
  console.error("Audit failed: external query unavailable or schema differs. No raw database errors or credentials logged.");
  process.exitCode = 1;
} finally {
  await pool.end();
}
