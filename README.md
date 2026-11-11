# ABCDE-Web-EU

Source code for [abcde.lv](https://abcde.lv), a food product browser in Latvian and English. It shows Nutri-Score grades (A–E) and nutrition information for products sold at Rimi and Maxima in Latvia, and helps shoppers find healthier alternatives.

Product data comes from two scrapers:

- [RimiScraper-v2](https://github.com/yuri-ivanov1972/RimiScraper-v2) for Rimi
- [BarboraScraper-v1](https://github.com/yuri-ivanov1972/BarboraScraper-v1) for Maxima, via its Barbora.lv online store

## Features

- Browse thousands of supermarket food products with Nutri-Score grades.
- Filter by category, nutrition values and store (Rimi or Maxima).
- Scan a product barcode to find the matching product.
- Switch between Latvian and English (i18next).
- SEO: the server adds meta tags to each page and generates `sitemap.xml`.

## Repository layout

This is a pnpm workspace.

| Path | Contents |
|---|---|
| `artifacts/abcde-lv/` | Frontend: React, Vite, Tailwind v3, wouter, i18next |
| `artifacts/api-server/` | API: Express 5 (routes in `src/routes/routes.ts`, queries in `src/storage.ts`, DB connections in `src/db.ts`) |
| `artifacts/abcde-lv-deck/` | Presentation deck (Vite) |
| `artifacts/mockup-sandbox/` | UI mockup sandbox |
| `lib/db/` | Drizzle schema for the local scans database |
| `lib/api-spec/`, `lib/api-zod/`, `lib/api-client-react/` | OpenAPI spec, plus Zod schemas and React hooks generated from it |
| `scripts/` | Workspace scripts |
| `docs/abcde-mcp/` | Handoff docs and API reference for a separate MCP project |
| `docs/barbora-extension/` | Specification and API contract for a Barbora browser extension |
| `threat_model.md` | Security threat model |

## Requirements

- Node.js 24
- pnpm (the `preinstall` hook rejects npm and yarn)
- PostgreSQL databases (the hosted ones are on Neon)

## Environment

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Local Postgres for barcode scans |
| `RIMI_DATABASE_URL` | yes | Rimi products and categories (written by RimiScraper-v2) |
| `MAXIMA_DATABASE_URL` | no | Maxima products (written by BarboraScraper-v1) |

## Development

```bash
pnpm install

# API server (port 8080)
pnpm --filter @workspace/api-server run dev

# Frontend
pnpm --filter @workspace/abcde-lv run dev

# Typecheck everything / build everything
pnpm run typecheck
pnpm run build

# Regenerate API hooks and Zod schemas from the OpenAPI spec
pnpm --filter @workspace/api-spec run codegen

# Push local scans schema changes (development only)
pnpm --filter @workspace/db run push
```

## Notes

- Routes are registered by calling `registerRoutes(app)` from `index.ts`. Don't move them into the Express router in `app.ts`.
- The frontend uses Tailwind v3, configured through PostCSS in `vite.config.ts`. It doesn't use `@tailwindcss/vite`.
- `@neondatabase/serverless`, `drizzle-zod`, `zod`, `sharp` and `ws` must be listed in the api-server dependencies.

More notes are in `replit.md`.
