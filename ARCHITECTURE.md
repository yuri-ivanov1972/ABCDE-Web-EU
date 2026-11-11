# ABCDE-Web-EU Architecture

ABCDE-Web-EU is the source of [abcde.lv](https://abcde.lv), a public website in Latvian and English. It shows Nutri-Score grades for food sold at Rimi and Maxima. The site doesn't scrape anything itself: it reads databases written by [RimiScraper-v2](https://github.com/yuri-ivanov1972/RimiScraper-v2) and [BarboraScraper-v1](https://github.com/yuri-ivanov1972/BarboraScraper-v1), and its own database holds only scan records.

## System context

```mermaid
flowchart LR
    U["Browser"]
    EXT["Barbora browser extension"]
    MCPC["MCP clients<br/>(e.g. Claude)"]

    subgraph Web["ABCDE-Web-EU (one Node process)"]
        FE["React SPA<br/>artifacts/abcde-lv"]
        API["Express 5 API<br/>artifacts/api-server"]
    end

    RIMI[("Rimi DB<br/>RIMI_DATABASE_URL")]
    MAX[("Maxima DB<br/>MAXIMA_DATABASE_URL")]
    SCANS[("Scans DB<br/>DATABASE_URL")]
    GV["Google Cloud Vision<br/>TEXT_DETECTION"]
    MCP["abcde-mcp.replit.app/mcp"]
    IMG["Store image CDNs"]

    U --> FE --> API
    U -- "/lv/*, /en/* (SEO HTML)" --> API
    EXT -- "/api/extension" --> API
    MCPC -- "/mcp" --> API
    API -- read --> RIMI
    API -- read --> MAX
    API -- read/write --> SCANS
    API --> GV
    API -- "streaming proxy" --> MCP
    API -- "/api/image-proxy (sharp)" --> IMG
```

Both scraper databases are hosted on Neon. The site connects through `@neondatabase/serverless` over WebSockets, using one pool per database (`max: 5`, 1-hour connection lifetime) and a Drizzle client for each. If `MAXIMA_DATABASE_URL` is missing, the site still works with only Rimi products.

## Monorepo layout

```mermaid
flowchart TB
    subgraph artifacts
        FE["abcde-lv<br/>React + Vite + Tailwind v3<br/>wouter · i18next · helmet"]
        API["api-server<br/>Express 5 · Drizzle · sharp · pino"]
        DECK["abcde-lv-deck<br/>slides"]
        MOCK["mockup-sandbox"]
    end
    subgraph lib
        SPEC["api-spec<br/>OpenAPI"]
        ZOD["api-zod<br/>generated Zod"]
        RQ["api-client-react<br/>generated hooks"]
        DB["db<br/>Drizzle schemas"]
    end
    SPEC -- codegen --> ZOD & RQ
    API --> ZOD & DB
    FE -. "own fetch layer<br/>src/api/" .-> API
```

The OpenAPI spec covers only newer endpoints, such as the extension lookup. The main application routes predate it and are written by hand in `routes/routes.ts`. The frontend calls them through its own fetch layer in `src/api/`.

`lib/db` has two schemas:

- `schema/schema.ts` defines the local `scans` table.
- `server/remote-schema.ts` defines Drizzle mappings of the scraper tables: `normalized_categories`, `products` (Rimi and Maxima versions), `nutritionfacts`, `productphotos` and `product_price_history`.

## Request handling

Middleware order in `app.ts` and `index.ts` matters:

```mermaid
flowchart TD
    R["Incoming request"] --> M1{"MCP machine path?"}
    M1 -- yes --> P1["Raw byte proxy to abcde-mcp<br/>(before any parser)"]
    M1 -- no --> RD{"nutri-score.lv / www?"}
    RD -- yes --> R301["301 redirect"]
    RD -- no --> X{"/api/extension?"}
    X -- yes --> EX["Barbora extension router<br/>(own rate limits, no logging of IDs)"]
    X -- no --> LOG["pino-http logging"] --> M2{"MCP page path?"} 
    M2 -- yes --> P2["Buffered page proxy"]
    M2 -- no --> PARSE["cors · json · urlencoded"]
    PARSE --> RT["/api router (health)"]
    RT --> REG["registerRoutes(app)<br/>/api/*, /sitemap.xml, /robots.txt,<br/>/lv/*, /en/* SEO + SPA fallback"]
```

### Main endpoints (`routes/routes.ts`)

| Endpoint | Purpose |
|---|---|
| `GET /api/categories`, `/api/categories/:id`, `…/path` | Category tree. This always comes from Rimi's `normalized_categories`. |
| `GET /api/categories/:id/has-healthier-products` | Checks whether the category has products with better grades. |
| `GET /api/products` | Filtered, paginated list from Rimi, Maxima or both. |
| `GET /api/products/:id`, `/sku/:sku`, `/url/:url` | Product detail |
| `GET /api/scan/token`, `POST /api/scan` | Photo-of-label scan |
| `POST /api/mobile/match-text`, `GET /api/mobile/product/:store/:id` | Mobile app matching from text |
| `GET /api/stats/nutri-score-distribution` | Statistics for the "What Latvians eat" page |
| `GET /api/reports/ice-cream` | Ice-cream report |
| `GET /api/image-proxy` | Fetches store images and resizes them with `sharp` |
| `GET /lv/product/:slug`, `/en/category/:slug`, … | Server-side HTML with meta tags for SEO |
| `GET /sitemap.xml`, `/robots.txt` | Crawler support |

## Combining Rimi and Maxima

Rimi's category tree is used for both stores. Each Maxima product has a `rimi_category_code`, which holds a Rimi `category_id`, so the site can put it in the same tree:

```mermaid
flowchart LR
    Q["GET /api/products?category=…&store=…"] --> T["Expand category:<br/>level 1 → 2 levels of children,<br/>level 2 → children"]
    T --> RQ["Rimi DB:<br/>products.category_id ∈ set"]
    T --> MQ["Maxima DB:<br/>products.rimi_category_code ∈ set"]
    RQ --> J["Join nutritionfacts,<br/>latest price (LATERAL)"]
    MQ --> J
    J --> MRG["Merge, sort, paginate<br/>(≤ 2000 rows per store)"]
    MRG --> IC["Attach product_ingredient_cards<br/>from each store's DB"]
    IC --> RESP["JSON (with store tag)"]
```

A **healthier alternative** is a product in the same expanded category with a better grade. For a product with grade $g \in \{C, D, E\}$, the better grades are

$$
\text{better}(g) = \{\, h \in \{A,B,C,D,E\} : h \prec g \,\}
$$

where $\prec$ is the order $A \prec B \prec C \prec D \prec E$. Category IDs 5 and 40 ("Gatavots Rimi", Rimi's own ready meals) are excluded.

## Photo scan

The scan finds a product by reading the text on its package with OCR. It doesn't read barcodes.

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser (scan page)
    participant A as API
    participant V as Google Cloud Vision
    participant R as Rimi / Maxima DBs
    participant S as Scans DB

    B->>A: GET /api/scan/token
    A-->>B: HMAC token (bound to IP)
    B->>A: POST /api/scan  {image: base64}  X-Scan-Token
    A->>A: validate token, rate limit
    A->>V: images:annotate TEXT_DETECTION
    V-->>A: text segments
    A->>R: pass 1: SQL candidates containing segments
    A->>A: pass 2: token scoring (percentage must match)
    A->>S: INSERT scans (ocr_text, product_id, photo token)
    A-->>B: matched product + slug + grade
    Note over A,S: scans older than 30 days are deleted asynchronously
```

## Barbora browser extension endpoint

`/api/extension` is a separate router mounted before logging and body parsing. It takes a list of Barbora product IDs and returns a Nutri-Score badge for each one, with an optional abcde.lv link. It has its own limits:

- per-client and per-instance rate limits
- a concurrency cap
- a deadline for each request
- `Cache-Control: no-store`

Only an aggregate status and timing are logged. Request bodies are validated with the generated `LookupBarboraNutriscoresBody` Zod schema. The contract is in `docs/barbora-extension/`.

## MCP proxy

Requests to the MCP path are passed through, byte for byte, to a fixed upstream at `https://abcde-mcp.replit.app/mcp`. This happens before any parser, redirect or logging, and only allow-listed headers are forwarded:

- Requests are limited to 32 KB.
- The upstream must be HTTPS with path `/mcp`. A localhost fixture is allowed in development.
- Allowed origins are abcde.lv, the MCP app and claude.ai/claude.com.

The MCP server itself is a separate project. `docs/abcde-mcp/` documents it.

## Caching and SEO

- `cache.ts` provides in-memory TTL caches, `productsCache` and `categoriesCache`, with 200 entries each.
- `seo.ts` and the `/lv/*` and `/en/*` handlers add titles, descriptions and canonical/hreflang links to the SPA's HTML for product and category pages. They then serve the HTML so that crawlers see real metadata.
- Old domains `nutri-score.lv` and `nutriscore.lv` redirect to `/lv/about-nutriscore`, and `www.abcde.lv` redirects to `abcde.lv`.

## Frontend

The pages are in `artifacts/abcde-lv/src/pages`:

- `home`
- `product-search`
- `product-details`
- `scan`
- `about-nutriscore`
- `about-project`
- `what-latvians-eat`
- `ice-cream-report`
- `debug`
- `not-found`

Routing uses wouter, translations come from `src/locales` (lv and en) through i18next, and head tags are set with react-helmet-async.

## Environment

| Variable | Used by |
|---|---|
| `RIMI_DATABASE_URL` | Required. Categories, Rimi products, the main lookups. |
| `MAXIMA_DATABASE_URL` | Optional. Maxima products. |
| `DATABASE_URL` | Required. Scans table. |
| `GOOGLE_CLOUD_API_KEY` | OCR for photo scans |
| `SCAN_TOKEN_SECRET` | Signs scan tokens. If it isn't set, a random secret is made at startup and tokens stop working after a restart. |
| `LOG_LEVEL`, `NODE_ENV`, `REPLIT_DEV_DOMAIN` | Logging and development settings |

The security review of this design is in `threat_model.md`.
