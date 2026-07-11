# Threat Model

## Project Overview

ABCDE.lv is a public Latvian food-product browser deployed at `https://abcde.lv`. It serves a React/Vite frontend and an Express 5 API that reads product data from remote PostgreSQL databases (Rimi and Maxima) and stores anonymous scanner submissions in a local PostgreSQL database. The production application is largely unauthenticated: product browsing, search, SEO pages, diagnostics, image proxying, and OCR-backed scan features are all reachable from the public internet.

Production assumptions for this scan:
- The live deployment is public.
- `NODE_ENV=production` in production.
- TLS is handled by the platform.
- `artifacts/mockup-sandbox/` is dev-only and should be ignored unless separately exposed.

## Assets

- **Remote product datasets** — the Rimi and Maxima product, nutrition, category, ingredient, and pricing data power the application. Integrity and availability matter because the site depends on them for every core page.
- **Anonymous scan submissions** — uploaded scanner photos, OCR output, and product matches stored in the local `scans` table. Even without user accounts, these can contain sensitive or identifying details from a shopper’s environment.
- **Application secrets and quotas** — database connection strings and the Google Cloud Vision API key. Abuse or leakage could cause data access, financial cost, or service outage.
- **Application availability** — the API performs database fan-out, image proxying, and third-party OCR calls. Public endpoints that trigger expensive work are critical DoS surfaces.

## Trust Boundaries

- **Browser / mobile client → Express API** — all request parameters, bodies, headers, and uploaded images are untrusted.
- **Express API → remote retailer databases** — the app translates public inputs into DB queries across separate Rimi and Maxima connections.
- **Express API → local scans database** — untrusted scanner uploads and OCR text are persisted here.
- **Express API → external services** — the image proxy fetches retailer-hosted images and the scanner sends content to Google Cloud Vision using a server-side API key.
- **Public content / diagnostic surfaces** — the same public deployment serves consumer pages and operational/debug endpoints, so accidental disclosure on diagnostics is production-relevant.
- **Production / dev-only artifacts** — `artifacts/mockup-sandbox/` is out of scope unless evidence shows production reachability.

## Scan Anchors

- **Production entry points:** `artifacts/api-server/src/index.ts`, `artifacts/api-server/src/app.ts`, `artifacts/api-server/src/routes/routes.ts`, `artifacts/abcde-lv/src/main.tsx`.
- **Highest-risk code areas:** OCR scan flow (`/api/scan`, `/api/scan/photo/:token`), public diagnostics (`/api/debug/db-status`, `/debug`), image proxy (`src/imageProxy.ts`), and search/query fan-out in `src/storage.ts`.
- **Public surfaces:** almost all `/api/*` routes plus SSR/SEO routes under `/lv/*` and `/en/*` are public.
- **Protected/admin surfaces:** none currently implemented.
- **Usually ignore as dev-only:** `artifacts/mockup-sandbox/`, build outputs, and deck artifacts unless referenced by the production server.

## Threat Categories

### Spoofing

There is no user-account system, so classic session spoofing is not the primary risk. The more relevant guarantee is that any future privileged or operational route MUST NOT rely on obscurity alone; public diagnostic and token-based access paths must be treated as attacker-reachable bearer interfaces.

### Tampering

All client inputs are untrusted. Query parameters, URL slugs, OCR text segments, and uploaded image payloads MUST be validated before influencing DB queries, HTML injection, or outbound service calls. The application currently uses Zod and parameterized SQL helpers in many places; those protections must remain in place for every new route.

### Information Disclosure

The public deployment MUST NOT expose internal diagnostics, stack traces, environment configuration, secret material, or private scan artifacts beyond the minimum necessary for the user who initiated a scan. Debug routes and error paths are high-sensitivity because they can leak operational context that is not required for product browsing.

### Denial of Service

This is the most important category for the current architecture. Public endpoints MUST bound expensive work such as OCR requests, DB fan-out searches, scan persistence, and image proxy fetches. Rate limiting, request-size limits, and tight caching are required wherever one unauthenticated request can consume paid third-party quota, database capacity, or large amounts of memory/storage.

### Elevation of Privilege

There are no user roles today, but privilege-style failures still apply where public users can reach capabilities meant for operators only. Diagnostic endpoints, internal health checks, or bearer-token retrieval endpoints MUST not grant broader access than intended just because they lack formal authentication.
