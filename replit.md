# ABCDE.lv

A Latvian food product browser that shows Nutri-Score ratings, nutritional info, and lets users find healthier alternatives across Rimi and Maxima supermarkets.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string (local scans DB)
- Required env: `RIMI_DATABASE_URL` — Neon Postgres for Rimi products/categories
- Optional env: `MAXIMA_DATABASE_URL` — Neon Postgres for Maxima products

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind v3, wouter, i18next (lv/en), react-helmet-async
- API: Express 5, registered via `registerRoutes(app)` pattern
- DB: PostgreSQL + Drizzle ORM (multi-DB: local scans + remote Rimi + remote Maxima)
- Theme: `theme.json` + `@replit/vite-plugin-shadcn-theme-json`
- Build: esbuild (ESM bundle)

## Where things live

- `artifacts/abcde-lv/` — React/Vite frontend
- `artifacts/api-server/` — Express API server
- `artifacts/api-server/src/routes/routes.ts` — all API routes (registerRoutes pattern)
- `artifacts/api-server/src/storage.ts` — DB query layer
- `artifacts/api-server/src/db.ts` — multi-DB connection setup
- `lib/db/src/schema/` — local scans table schema
- `artifacts/api-server/src/remote-schema.ts` — remote Rimi/Maxima table definitions

## Architecture decisions

- **registerRoutes(app)** kept instead of converting to Express Router — too complex (1500+ lines, image proxy, SSE, SEO routes). Called from `index.ts` before `app.listen()`.
- **No OpenAPI spec for app routes** — large legacy app with custom fetch layer; existing `client/src/api/` layer kept as-is.
- **Multi-DB setup**: scansDb (local Neon via DATABASE_URL), rimiDb + maximaDb (remote Neon). All via `@neondatabase/serverless`.
- **Tailwind v3** (not v4) — original app uses Tailwind v3 + `theme.json` plugin.
- **fs.strict: false** in vite.config — attached_assets lives outside the artifact root.

## Product

- Browse 5000+ Latvian supermarket food products with Nutri-Score grades (A–E)
- Filter by category, nutritional values, store (Rimi/Maxima), and more
- Scan product barcodes to find matching products
- Bilingual: Latvian and English
- SEO-optimized with server-side meta injection and sitemap.xml

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Run `pnpm --filter @workspace/db run push` after schema changes to the local scans table
- `registerRoutes` is called directly in `index.ts` — do NOT add these routes to the Express router in `app.ts`
- `@neondatabase/serverless`, `drizzle-zod`, `zod`, `sharp`, `ws` must be in api-server dependencies
- Frontend uses Tailwind v3 with `postcss` config in `vite.config.ts`, NOT `@tailwindcss/vite`

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
