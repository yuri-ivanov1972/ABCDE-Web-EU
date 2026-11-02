# ABCDE extension API contract

**Implemented and development-verified on 2 November 2026. NOT published.**
The owner must approve publication before the public endpoint can be used.
See `IMPLEMENTATION.md` for audit provenance, tests and remaining limitations.
The extension project must not invent a replacement service or data.

## Request

Intended public address after approved publication:
`POST https://abcde.lv/api/extension/nutriscores/batch`

`Content-Type: application/json`, no cookies, Authorization, user identifier,
referer page, browsing URL, cart contents or database key.

```json
{
  "retailer": "barbora",
  "product_ids": ["000000000000790928"]
}
```

`product_ids` means **exact Maxima SKU text**, not `products.product_id`.
Retain leading zeros. For this first contract require exactly 18 ASCII digits,
as observed on inspected live pages. If later data proves other legitimate
formats, version/validate the change rather than padding, trimming, numeric
coercion or guessing.

- Strict object: only the two stated properties.
- Retailer must be literal `barbora`.
- 1–100 submitted IDs BEFORE deduplication; deduplicate before SQL.
- Raw body maximum 32 KiB. JSON only; no compressed body expansion.
- Reject malformed inputs for the whole batch; never silently change keys.

## Success

The following response was verified through the development shared proxy
against the real configured external Maxima database, not the published route:

```json
{
  "products": {
    "000000000000790928": {
      "nutri_score": "D",
      "abcde_url": "https://abcde.lv/lv/product/skabais-krejums-valmiera-20-450g-6741"
    }
  }
}
```

`200` and `{"products":{}}` is a successful lookup with no displayable matches.
Omit unmatched SKUs, missing/non-applicable/invalid grades and ambiguous
records. The map keys must be a subset of requested IDs; never emit unsolicited
products. No direct internal-ID field, names, prices or nutrition details.
Internal IDs necessarily occur inside existing canonical product links.

If a query fails or hits a safety cap, return an error for the request: do not
return a truncated/empty success and negative-cache it as “not found”.

## Matching and query plan

Use a bound `text[]` against **the external Maxima database**:

```sql
SELECT p.sku, p.product_id, p.name, nf.nutri_score_grade
FROM products p
LEFT JOIN nutritionfacts nf ON nf.product_id = p.product_id
WHERE p.sku = ANY($1::text[])
LIMIT 201;
```

This query was implemented and its indexed plan audited. Group results by exact SKU
before applying the grade allowlist. More than one underlying product or
nutrition row for a key is ambiguous and must not be resolved by ordering,
DISTINCT, “first row”, or “prefer a valid grade”. If the bounded result indicates
excess multiplicity, fail the request rather than silently trimming.

Actual unique SKU and nutrition-product indexes were verified on the configured
external Maxima database; published deployment secret identity was not independently
compared. Recheck against the deployment target when its configuration differs.
Use `EXPLAIN` without executing unbounded analytics during routine requests.
Any index creation is a separately approved production schema change, not
part of read-only lookup and not automatically applied at startup/publish.

Reuse the existing canonical slug/link logic and explicitly select Maxima.
Emit only trusted `https://abcde.lv/lv/product/...` URLs. Do not accept a base
origin from the caller or perform URL fetching. If a canonical collision cannot
be disambiguated by existing routing, omit the link rather than link to a wrong
product; the badge can be non-clickable.

`abcde_url` is therefore optional. One additional bounded, indexed Rimi
ID/name query validates canonical collisions only; Rimi never supplies grades
or resolves a missing SKU. If this optional guard fails, return the Maxima
grade without a URL. Both reads are read-only transactions with LOCAL statement
timeouts and abortable outgoing HTTP transport.

## Operational starting limits

Implemented pilot limits, still subject to deployment tuning:

- 30 requests/minute/client IP; use the existing safe IPv4/IPv6 key handling and
  a verified trusted-proxy configuration. IP is used transiently for admission,
  not written to analytics/logs.
- Bounded per-instance admission: 4 concurrent lookups and a conservative global
  instance budget of 120 requests/minute; instance limits do not equal deployment-wide
  limits under scaling.
- 5-second route deadline; database statement timeout at most 2 seconds, with
  connection acquisition inside the deadline. Cancel work on disconnect.
- Shared bounded LRU response cache, e.g. 60 seconds, maximum 2,000 SKU entries.
  No per-client histories. Do not cache upstream/query failures as missing.
- Reject overload with Retry-After. No automatic server-side retry loops.

Forwarding headers are not trusted by default. Rate keys use Express's safely
configured IP or socket peer, normalize mapped IPv4 and aggregate IPv6 /56.
With an unverified shared ingress this can conservatively group multiple users.
Do not enable trust-all or a guessed hop count to improve apparent throughput.
Counters use transient HMAC keys, a 5,000-entry limit and on-request expiry
cleanup; no raw IPs are written to logs or stored product history.

Cookie/Authorization headers and query parameters are rejected with 400.
OPTIONS returns 204, unsupported methods 405 with Allow, unrelated paths within
the extension namespace JSON 404. CORS allows `*` without credentials.

Extension starting defaults: at most 2 requests in flight; positive cache
10 minutes, negative cache 60 seconds, bounded 2,000 entries, memory only.
Respect Retry-After and pause rather than repeatedly retry on failure. Do not
queue indefinitely or refill batches from unavailable offscreen cards.

## Errors, all JSON

| HTTP | Meaning | Extension behavior |
| --- | --- | --- |
| 400 | Invalid retailer, IDs, shape or malformed JSON | Do not retry unchanged input |
| 413 | Body or submitted-ID count exceeds bound | Correct client batch; do not loop |
| 415 | Unsupported media type/encoding | Treat as contract failure |
| 429 | Admission/rate limit | Respect Retry-After; no negative product cache |
| 503 | Lookup database unavailable/overloaded | Pause, show no new badges |
| 504 | Deadline exceeded | Pause, do not cache products as missing |

Use a compact fixed error body such as `{"error":{"code":"lookup_unavailable"}}`.
Never send SQL, connection errors, identifiers or stack traces in errors.
Return 404 for unrelated paths and explicit method handling (POST/OPTIONS),
not website HTML. All responses use `Cache-Control: no-store` and
`X-Content-Type-Options: nosniff`; application cache is separate from HTTP cache.

The service worker rejects redirects, non-JSON responses and extra/wrongly
typed fields, accepts only A–E and allowlisted HTTPS ABCDE links, and treats
all catalogue content as untrusted text.

## Authentication, permissions and privacy

After publication the endpoint will be public read-only public-grade data with abuse protection,
not a private API disguised behind an extension key. Any key embedded in a
downloaded extension can be extracted.

CORS/Origin allowlisting is defense in depth, never authentication. A service
worker with the precise host permission can make cross-origin API requests;
content scripts should not fetch directly. See the Chrome network guide:
https://developer.chrome.com/docs/extensions/develop/concepts/network-requests

Avoid session middleware, Set-Cookie and credentialed CORS. Reject unexpected
credential-bearing requests or ensure they are ignored; the extension always
uses credentials omit and a fixed URL. Inspect effective middleware/body limits
before mounting; do not alter or move the existing early MCP machine proxy.
Handle parse/limit failures as JSON on this route.

Request bodies and headers must never be logged. Log at most fixed route,
method, status, duration and fixed error classes; no SKU list, names, IPs,
referrers, sessions, cookies or SQL bindings. Infrastructure may still process
IP/access metadata: do not promise that no infrastructure metadata exists.

## Publication gate

API regressions and development HTTP checks passed; verify the published route
only after the owner approves publication. Before connecting the real extension, check real SKUs,
missing/invalid grades, duplicate/conflicting fixtures, retailer isolation,
leading zeros, 100/101 bounds, malformed JSON, timeouts, 429 behavior,
credential omission, log redaction and actual extension-origin requests.

Do not ship a mock catalogue or fall back to Rimi/search when this contract is
unavailable. The separate project can build against explicit test fixtures,
but live mode must report the missing API honestly.
