# ABCDE.lv landing-page integration

## Release boundary

Implemented and verified in the development preview on 25 October 2026.
**Not published. Owner approval is required before publishing ABCDE.lv.**
Production checks of `https://abcde.lv/lv/mcp` and `/en/mcp` remain pending
publication; local success is not evidence of production availability or indexing.

The independently published service remains at `https://abcde-mcp.replit.app`.
The Claude connector remains **`https://abcde-mcp.replit.app/mcp`**.
ABCDE.lv proxies only its human pages and scoped support resources, not the
connector, retailer APIs, or the standalone service's root pages as part of the
landing-page integration. A subsequent, separate machine-endpoint change is
documented in [MACHINE-ENDPOINT.md](MACHINE-ENDPOINT.md); it requires its own
publication approval and public protocol verification.

## Implementation

- Express middleware: `artifacts/api-server/src/mcpPageProxy.ts`, mounted in
  `app.ts` after existing domain redirects/logging but before parsers and fallbacks.
- Managed API routing adds `/mcp-site`; existing `/lv` and `/en` routing already
  reaches Express. The artifact configuration was replaced through validation.
- Root sitemap gains both language page URLs without removing existing entries.
  Root robots gains the scoped sitemap reference, retaining `Disallow: /en/`.
  Root llms.txt gains links without replacing existing content.
- No existing CSP or service worker required changes. Proxy responses do not
  import upstream CSP, cookies, or caller credentials.
- The upstream owns content, translations, assets and interactive controls.
  New upstream hashed single-filename assets do not require a local hash update.

## Verified

- Fresh upstream checks: both HTML languages, scoped markdown, llms, sitemap,
  robots, favicon, JSON stats and existing connector method handling. A safe
  unauthenticated connector GET returned its expected JSON 405, without a session
  or tool call.
- Routed preview checks: both HTML languages, slash/index aliases with local
  308 Location, actual linked JS/CSS with correct MIME, documents, stats, real
  missing-document 404, HEAD without a body and POST 405.
- Root sitemap contains both new MCP URLs and retains product URLs. Existing
  `/lv`, `/en`, `/api/products`, `/api/healthz`, root llms/robots, and optional AI
  manifest 404 behavior were checked.
- Eight automated proxy tests pass: allowlist/aliases, HEAD/method handling,
  credentials/query isolation, safe headers/caching, unknown scoped paths,
  redirects, stats 503, upstream status preservation, network/timeout/body limits,
  and cancellation when the client disconnects.
- Shared-library declaration build and API server TypeScript check pass.
- One browser pass confirmed LV/EN switching stays on preview origin, English
  reload, exact copied connector URL, same-origin statistics, no observed
  hydration/CSP/resource errors and usable desktop/390px layouts without overflow.
- Both language pages remain readable with JavaScript disabled. Language-switch
  interaction in the no-JavaScript context was not confirmed; the English page
  was checked by direct navigation. Live counters correctly report unavailable
  without JavaScript. Sessionless clients show sessions as not measured, not zero
  or a fabricated visitor count.

Run the focused regression checks with:

```sh
pnpm --filter @workspace/api-server exec tsx --test test/mcpPageProxy.test.ts
pnpm run typecheck:libs
pnpm --filter @workspace/api-server run typecheck
```

## After approved publication

Repeat the handoff's public-domain checks for both languages, redirects,
actual assets, documents, statistics, clipboard, mobile layout and unrelated
website/API routes. Retain the existing English crawl restriction unless the
owner separately approves an SEO-policy change.

If rollback is necessary, remove only the added middleware, scoped service
path and discovery additions. Do not change the independent MCP deployment or
connector. Use checkpoints rather than deleting unrelated website work.
