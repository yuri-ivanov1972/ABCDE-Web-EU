# Barbora Nutri-Score extension: investigation and handoff

**Current status, 2 November 2026: the API is implemented and development-verified,
but NOT published. The extension remains separate and unimplemented here.**

See `IMPLEMENTATION.md` for the completed runtime database audit and API tests,
and `API-HANDOFF.txt` for the current separate-project message. The investigation
below records the **original handoff**; its unavailable-connection and
not-implemented statements are historical and superseded by that update.

## Recommendation and project boundary

Use a **new, lightweight Replit project** for the Chrome extension. Do not remix
the website code, copy its database, or link database secrets into that project.
This overrides the original attachment's same-repository instruction.

Keep a small read-only batch lookup in the existing ABCDE.lv backend. The
extension is an unpacked Chrome package, not a second hosted backend. Website
publication and external-database schema changes require explicit approval.

The first release is personal shopping assistance, with Latvian and English
messages. Research follows later and compares **no added badge versus
Nutri-Score**. No research tracking or assignment belongs in the shopping pilot.

## Evidence and limitations

### ABCDE infrastructure: source inspection

- `lib/db/src/server/remote-schema.ts`: Maxima `products.product_id` is an internal
  integer; `sku` is text, declared non-null/unique; `barbora_url` is text and is
  not declared unique. Do not interchange internal IDs and retailer SKUs.
- In the external Maxima database, `nutritionfacts.product_id` joins the Maxima
  product ID. `nutri_score_grade` is a one-character field. Return only literal
  uppercase A–E. Null/blank/other values must never become a badge.
- The same table names exist in separate Rimi and Maxima databases. Queries must
  use **maximaPool/maximaDb**, never an unspecified retailer fallback.
- `getProductBySku` and `getProductByRimiUrl` currently query Rimi, not Maxima.
  They are not suitable extension lookup implementations.
- The public product-detail API can verify a known internal ID using
  `GET /api/products/:id?store=maxima`, but it is not a retailer-SKU batch lookup.
- The catalogue helper restricts results to products with mapped categories,
  available latest-price records and non-null grades. Its count is NOT a full
  Maxima inventory or complete valid-grade audit.
- Current HTTP logging strips query strings and records method/path/status.
  A POST batch must not introduce body/identifier/IP/session logging.
- Existing general CORS is permissive. This does not authenticate callers.
  No extension endpoint was found in the inspected source; none was added.

### Production/public evidence

The deployment metadata identified `https://abcde.lv` as the published primary
URL with a successful build. All catalogue checks below used that public
deployment, not the development database.

`GET /api/products?store=maxima&pageSize=100&page=1&sortBy=name` returned
`totalCount: 9322`, 100 Maxima rows, grades A:25, B:9, C:19, D:26, E:21.
This is a **filtered catalogue count and alphabetical sample**, not a
representative coverage percentage or production database-wide grade count.

Additional bounded public searches for `valmiera`, `piens` and `olas` were used
only to assemble audit candidates; mixed retailer results were explicitly
filtered to `store=maxima`. Search is not proposed as the extension's matching
mechanism. Together with the catalogue page they yielded **187 unique Maxima
SKU candidates**. Source-level search limitations make these non-exhaustive.

### Database audit remains blocked

The website uses external Neon connections, not the project's managed database,
for retailer data. A secure existence check reported both
`MAXIMA_DATABASE_URL` and `RIMI_DATABASE_URL` unavailable in this development
workspace. No secret values were read or printed.

Replit's managed production SQL callback would inspect a different database,
not the external Maxima database; it was deliberately not used to manufacture
an inventory result.

Consequently, actual production indexes, all-product grade distribution, blank
keys, duplicate URLs, conflicting grades and freshness distributions are
**not verified**. Schema declarations are not proof of deployed constraints.
`READ-ONLY-AUDIT.sql` contains the bounded aggregate/index checks for an
authorized read-only connection to the actual Maxima database. Do not infer
absence of duplicates or freshness from this handoff.

The sampled Valmiera product had a null nutrition `dataSourceDate`; its grade
was observed but its recency and Nutri-Score algorithm version were not proven.
No grades were calculated or changed.

## Barbora findings

Direct public HTML requests, HTML parsing and one rendered browser screenshot
were used. These are not installation or interaction tests of an extension.

| Page | Identified SKU elements | Unique SKUs | Exact matches in bounded ABCDE candidates |
| --- | ---: | ---: | ---: |
| Category `/c/URAL/piena-produkti-un-olas` | 60 | 60 | 13 |
| Search `/search?q=piens` | 60 | 60 | 8 |
| Detail `/p/skabais-krejums-valmiera-20-proc-450-g` | 2 | 1 | 1 |
| Promotion `/cl/0WTS/weeklyfood-44` | 45 product wrappers | 45 | Not audited |

The 13 and 8 are **lower-bound confirmed matches against 187 candidates**.
They are not 13/60 or 8/60 estimates of actual catalogue coverage. Matches may
overlap across pages; do not add those rows to infer unique products.
No badges were rendered by our code: the actual badge count is **zero**.

### Verified identifier and selectors

Category and search HTML contain:

```html
<div data-product-id="000000000000790928">
  <div data-cnstrc-item-id="000000000000790928" ...>
    <div id="category-product-card-...">...</div>
  </div>
</div>
```

The product-detail HTML contains two responsive/sticky wrappers with:

```html
<div data-cnstrc-product-detail="true"
     data-cnstrc-item-id="000000000000790928" ...>
```

**Primary key: read the exact string SKU, retaining every leading zero.**
`[data-product-id]` is verified on category/search/promotion cards.
`[data-cnstrc-item-id]` is verified on category/search and detail blocks, and
was also present on five homepage recommendation elements in HTML returned by
an unsupported route that resolved to the homepage. Direct homepage content
was separately fetched as markdown, but no complete interactive homepage
layout or recommendation-carousel behavior was tested.

Treat these as current observations, not permanent retailer contracts.
For card wrappers containing both identifiers, disagreement means no badge.
Never treat `category-product-card-0` as a product ID: it is a positional index.
Do not extract names, prices, cookies, analytics/session result IDs or page
state as product identifiers.

For detail placement, locate the product heading inside its verified product
block; do not put a badge in every responsive duplicate. For listing placement,
use a dedicated non-interactive area associated with one verified product root.
Do not place an anchor inside an existing anchor/button or cover cart/wishlist
controls. Visual placement still needs actual extension testing.

### Real, cross-checked examples

| SKU from Barbora | ABCDE Maxima internal ID | Observed grade |
| --- | ---: | --- |
| `000000000000790928` | 6741 | D |
| `000000000000800999` | 587 | A |
| `000000000000801000` | 584 | B |
| `000000000000741606` | 2363 | B |
| `000000000000524186` | 3547 | B |

The first product is **Skābais krējums VALMIERA 20% 450g**. Its exact SKU was
present on the live category and detail pages and in the published ABCDE JSON.
The ABCDE Latvian link was fetched successfully and its canonical verified:

`https://abcde.lv/lv/product/skabais-krejums-valmiera-20-450g-6741`

The English equivalent redirected to that Latvian canonical page. LV/EN
extension messages therefore do not imply that product destination pages stay
in English. Return the verified Latvian canonical link for the first contract.

### URL change: do not build the matcher around slugs

Observed current product links use `/p/...`; sampled stored URLs use
`/produkti/...`. Five legacy URL probes returned HTTP 403, so redirect
equivalence was **not** established. Exact SKU matching avoids this dependency.
Do not fetch arbitrary caller-supplied URLs, follow redirects for matching, or
silently normalize old/new slugs as if they were verified identifiers.

The initially probed `/paieska?q=piens` returned homepage content rather than
search results. The actual `/search` route was confirmed in the site's public
route manifest and verified with `/search?q=piens`, whose heading was
“Meklēšanas rezultāti: „piens“”. A 200 response alone is not enough.

### Dynamic behavior and outstanding browser checks

HTML contains module hydration/navigation code, product result containers and
recommendation regions. No scroll, client-side navigation, hydration changes,
live card reuse, logged-in state, cart modifications or extension installation
were exercised. A static screenshot only confirmed the category's visible
layout and separation of product cards from the basket sidebar.

Use `DOM-DIAGNOSTIC.js` locally in Chrome on a deliberately selected catalogue
grid/detail block to compare DOM counts before/after scrolling and navigation.
It is an inspection aid, not a working extension. Stop and reselect the root
after client-side navigation replaces it.

## Proposed architecture

1. Content script runs only on approved Barbora pages and supports verified
   catalogue/search/promotion roots and the active detail block, excluding the
   basket, account, checkout and personal-history areas.
2. Extract exact string SKUs; debounce mutations; deduplicate in-flight batches;
   query a fixed service-worker operation, never a content-supplied fetch URL.
3. Service worker validates extension sender, allowed tab origin and message
   schema, uses only a fixed ABCDE HTTPS endpoint and `credentials: "omit"`,
   refuses redirects, validates JSON, enforces timeout and bounded ephemeral
   positive/negative caches. Worker suspension can clear caches harmlessly.
4. Backend performs one indexed store-specific batch query, returning only
   unambiguous A–E grades and trusted canonical links. No per-product fallback
   queries or nutrition calculation.
5. Before applying async results, recheck the node's current SKU, connectivity
   and eligible location; stale results must never annotate reused elements.
6. Use local, isolated CSS and independent ABCDE text/letter badges. No external
   JavaScript, tracking, backend credentials or remotely supplied HTML.

See `API-CONTRACT.md`, `START-PROMPT.txt` and `ACCEPTANCE.md`.

## Implementation sequence and effort

1. Run the missing authorized production audit and confirm the actual SKU index.
2. Implement and test the small backend contract **in ABCDE.lv**, after approval.
   Pause for separate approval if a database index change is necessary.
3. Owner approves website publication; verify the published endpoint and
   contract. Never tell the new project that a proposed endpoint already exists.
4. Build the extension in the separate project, then test it in desktop Chrome
   on real Barbora pages. Deliver an unpacked ZIP, not a hosted imitation.
5. Only after the shopping pilot works, scope a separate consented study.

Remaining indicative human-engineering effort: audit/API 6–12 hours, extension
12–24 hours, real Chrome verification/packaging 6–12 hours, roughly **24–48
hours** if the external audit confirms the observed key and index assumptions.
Allow additional work if interactive layouts differ, data conflicts need an
explicit policy, or badge usage needs revision. This is not a fixed quote,
platform-cost estimate or guarantee of AI execution time.

## Future research, not part of the pilot

Use explicit consent and a stable pseudonymous assignment to no added badge
versus Nutri-Score. Decide assignment unit, repeat visits, control for shared
devices and cross-condition exposure, withdrawal, retention and outcome
definitions before adding event capture.

Badge views/clicks measure exposure/engagement, not purchasing. Measuring cart
changes needs separate scoped permission, data minimization and consent.
Neither cart contents nor purchases are observed in this pilot.

Package images may already contain FOP labels. Prices, stock, ranking, location
and availability change in a live retailer site; record or control relevant
confounds under the later protocol. No-added-badge is not a label-free store.
Do not present the later extension study as the earlier multi-FOPL shopping
simulator, and do not enable research tracking silently.

## Original handoff deliverable boundary (superseded)

Only documentation and a local diagnostic were added. No application code,
secrets, schema, product records, grades, API behavior or deployment was changed.
No working extension or batch endpoint is being claimed.
