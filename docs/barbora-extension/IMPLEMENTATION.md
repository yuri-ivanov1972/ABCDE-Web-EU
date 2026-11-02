# API implementation and verification

**2 November 2026: implemented and verified in development, NOT published.**

This supersedes the original handoff's “API not implemented” and “database audit
blocked” statements. The Chrome extension remains a separate project.

## What is ready

`POST /api/extension/nutriscores/batch` now returns real Maxima grades for exact
Barbora SKU strings. The intended public address, **after approved publication**,
is `https://abcde.lv/api/extension/nutriscores/batch`.

Use `API-CONTRACT.md` as the current contract and `API-HANDOFF.txt` as the short
message for the separate extension project. No API key, retailer database
connection, accounts or cookies are required by the extension.

The development shared-proxy request used six exact SKUs: five verified products
and one unknown key. It returned HTTP 200 in approximately 0.22 seconds, five
correct grades with safe canonical links, and omitted the unknown SKU.
Headers included JSON, `Cache-Control: no-store`, wildcard non-credentialed CORS,
and no Set-Cookie. This is **not a published-route or real Chrome installation
test**. No request was sent to a production version of the new route.

## Database audit provenance

The secure metadata callback reported retailer secrets absent, but a normal
backend read-only connection through the inherited runtime configuration
succeeded. No credential values were inspected or printed. The earlier blocked
audit is therefore historical, not the current state.

Queries ran at **2026-11-02 08:32 UTC**, through the configured external Maxima
connection, with read-only transactions and a 5-second statement limit.
This was **not** Replit-managed production SQL. Whether the currently published
deployment uses precisely the same secret configuration was not independently
compared; do not label this as a separately verified production-environment audit.

| Check | Result |
| --- | ---: |
| Products | 13,092 |
| Valid A–E grades | 11,266 (86.05% of this database's products) |
| A / B / C / D / E | 1,025 / 1,126 / 2,070 / 3,058 / 3,987 |
| Null grade | 1,820 |
| No nutrition row | 6 |
| Blank/invalid non-null grade | 0 |
| Blank / non-18-digit SKUs | 0 / 0 |
| Missing product URLs | 0 |
| Duplicate SKU / nutrition-product / exact URL groups | 0 / 0 / 0 |
| Conflicting-grade SKU groups | 0 |
| Nutrition rows | 13,086 |
| Missing nutrition source dates | 12,596 |
| Source dates older than 90 days | 86 |

Product update dates ranged from 2026-01-03 to 2026-11-02, with no missing values.
Known nutrition source dates ranged from 2026-01-27 to 2026-10-27. Product update
dates do not prove nutrition freshness. The API returns recorded grades and
does not claim a verified date or algorithm revision.

Actual unique indexes `products_sku_key` and
`nutritionfacts_product_id_unique` were present. EXPLAIN showed indexed SKU
lookup and an indexed nutrition join. No DDL, index creation, writes, schema
pushes or data changes were performed.

The operator audit is repeatable:

```sh
pnpm --filter @workspace/api-server exec node scripts/audit-barbora-extension.mjs ../../generated-artifacts/barbora-db-audit.json
```

The full aggregate/index result and development-response snapshot are in ignored
`generated-artifacts/`; this document preserves the shareable summary.

## Link-safety refinement

Rimi and Maxima use overlapping internal integer IDs. The website currently
chooses the first product with a matching canonical slug, so two stores with
the same ID and slug could produce an incorrect destination.

The main lookup is one parameterized, bounded Maxima query. A second **optional,
indexed Rimi ID/name read** checks only for canonical collisions. It never
supplies a grade, never matches a missing SKU, and is not a retailer fallback.
If that guard is unavailable or detects a collision, return the Maxima grade
without `abcde_url`; the extension must display a non-clickable badge.
This is preferable to changing existing product-page routing.

Both reads use read-only Neon HTTP transactions with a LOCAL 2-second statement
timeout and the request AbortSignal. Cancelling the transport stops waiting
for outgoing work; server work is bounded by its statement timeout, not claimed
to be synchronously cancelled by a browser disconnect.

## Resource and privacy behavior

- Maximum 100 submitted SKUs, strict shape, 32 KiB uncompressed JSON.
- 30 requests/minute/visible peer IP or safely configured Express client IP,
  120/minute/instance, 4 active requests; no waiting queue.
- IPv6 /56 aggregation, normalization of mapped IPv4, HMAC counter keys,
  5,000-counter bound and periodic on-request expiry cleanup.
- The application currently does **not trust forwarding headers**. This avoids
  forged-header bypasses but may put users behind one hosting ingress into the
  same conservative rate bucket. No verified public-ingress trust contract was
  established, so no arbitrary hop-count or trust-all setting was introduced.
  Confirm the deployed proxy topology before changing that setting.
- A 5-second deadline includes body parsing and outgoing connection acquisition.
  Slow uploads and client disconnects are bounded; no server-side retry loops.
- Shared 60-second LRU cache, up to 2,000 SKU entries, including genuine misses.
  Database failures never become cached product misses. No per-user SKU history.
- Dedicated namespace before general logging, parsers, sessions and fallbacks;
  the MCP machine proxy remains first. Unrelated extension paths return JSON 404.
- Application logs contain only a fixed route label, status and duration.
  No SKU lists, URLs supplied by callers, bodies, IPs, headers or driver errors.
  Previous database URL-prefix startup logging was removed.
- CORS allows credentialless requests, not credentialed access. Requests with
  Cookie or Authorization are rejected; no new sessions or cookies are created.

## Verification

- OpenAPI/codegen and workspace library checks passed.
- API-server TypeScript check passed.
- **47 automated API regressions passed**, including 21 new lookup/HTTP tests;
  one additional configuration-failure regression was added and checked afterward.
- New coverage includes exact keys, all grades, misses, duplicates/conflicts,
  safe links, LRU/expiry, error-cache isolation, strict parsing, 100/101 bounds,
  oversized/encoded input, headers, methods/404, credential rejection,
  forwarding-header spoofing, instance/concurrency limits, deadlines,
  disconnects and slow uploads.
- Existing MCP raw transport, SSE/cancellation, page proxy, domain redirect,
  AI discovery and product-page regressions passed.
- Development HTTP checks: real lookup 200, OPTIONS 204, GET-on-POST-route 405,
  unknown extension path 404, existing health and Maxima detail APIs 200.
- API and website workflows restarted successfully; homepage screenshot
  confirmed the existing website shell still renders. It was captured during
  initial product loading, not asserted to prove every catalogue interaction.

Not tested: installed Chrome extension operation, real browser service-worker
origin behavior, production ingress distribution, multi-instance aggregate
limits or the new route after publication. HTTP Origin/preflight checks are
not represented as Chrome installation tests.

## Publication

**Owner approval is still required. Nothing was published.**
After approval, publish through the project's normal flow, then check the actual
public POST, OPTIONS, error statuses, known/unknown products, logs and ingress
behavior before telling the extension project the public dependency is ready.
