# Additional ABCDE.lv MCP endpoint

## Release status

Implemented and checked in the routed development preview on **25 October 2026**.
**Not published. Owner approval is required to publish ABCDE.lv.**

Target: `https://abcde.lv/mcp`

Fixed original upstream: `https://abcde-mcp.replit.app/mcp`

The original public endpoint was verified with the official client and remains
unchanged. The new public target is **not yet verified**: preview success does not
prove production routing, deployment Host handling, a 45-second gateway deadline,
or real-Claude usability. No Claude account was connected during this work.

## Boundaries

- The independent MCP service still owns tools, data, counters and landing content.
- Only exact `/mcp` is handled by the new streaming middleware. No redirect or
  new handling for `/mcp/`, `/mcp/other`, language pages, scoped assets or APIs.
- The existing buffered landing-page proxy is unchanged.
- No root discovery content, advertised endpoint setting, clipboard text,
  authentication, secrets or databases were changed.
- Production accepts actual Host `abcde.lv`; development additionally accepts the
  single runtime-provided development hostname. Forwarded headers are not trusted.
  The development gateway was verified to preserve a usable allowed Host. Check
  the production gateway after publishing; do not disable validation if it differs.
- A sanitized HTTP logger remains on existing routes. Machine requests bypass
  it and all existing redirects/parsers/CORS so protocol bytes remain untouched
  and sensitive machine request content is not logged.

## Transport behavior

The dedicated TypeScript middleware adapts the supplied Node reference with
32 KiB raw request limit, 4 MiB streamed response cap, 45-second total deadline,
fixed upstream and allowlisted protocol request/response headers. JSON/SSE is
streamed using Node pipeline/backpressure. Clients disconnecting cancel upstream.
No cookies, Authorization, forwarded headers, caller queries or automatic retries.
Responses use `no-store` and `X-Accel-Buffering: no`; no compression middleware
was present locally. Do not assume this proves production gateway behavior.

Before headers: oversize input gets 413, timeout gets 504, invalid upstream or
network failure gets 502. After headers: failure closes the stream without
appending fabricated MCP output. HTML and redirects are not successful MCP.

### Upstream empty acknowledgement exception

The published Express service sends a successful initialized-notification
acknowledgement as **202, Content-Type: text/html, Content-Length: 0**. The supplied
reference rejected it, preventing official-client negotiation.

The adaptation accepts 202/204 acknowledgements only after verifying zero body
bytes. It does not buffer response content. Non-empty acknowledgement bodies
and other HTML responses remain rejected. A focused regression check covers both
the real empty acknowledgement behavior and rejection of HTML content.

## Verification performed

| Check | Result |
| --- | --- |
| Unmodified supplied reference suite in isolated temporary directory | 9 passing |
| Adapted supplied suite against production module, acknowledgement regression, actual Express order/security and unchanged landing proxy | 19 passing |
| Complete API regression command, including existing discovery, domain redirects and product pages | 26 passing |
| Shared library declarations and API TypeScript check | Passed |
| Backend production bundle and running workflow | Passed |
| Official `@modelcontextprotocol/sdk` client, pinned 1.32.2 | Passed direct upstream and routed preview |
| Negotiated protocol | 2025-11-25 |
| Legacy 2025-03-26 initialization | Passed direct upstream and routed preview |
| Tool listing | Exactly search_products, get_product, build_basket |
| Real read-only tool calls | Product 3975 at Rimi, search maize with max_results 2, one-product basket, on each address |
| Output | Structured content matched complete parseable JSON text; product name, ID, protein and retailer link present |
| Origin https://abcde.lv | Passed |
| Preview protocol caching | no-store |
| Initialized notification | Empty 202 preserved |
| Stateless GET/DELETE/HEAD | Upstream 405 preserved on both addresses |
| Preview disallowed Origin / oversize input | 403 / 413 |
| Explicit MCP-Method and protocol header request | tools/list passed through preview |
| SSE progressive delivery and cancellation | Passed controlled server regression |
| LV/EN human pages, actual JS/CSS/image assets, scoped stats/markdown/404, homepages, API health | Passed preview smoke checks |

The six successful read-only tool calls above contribute to the upstream's normal
aggregate counters. No catalogue data was changed.

## Repeatable commands

From the workspace root:

```sh
pnpm --filter @workspace/api-server run test:mcp
pnpm run typecheck:libs
pnpm --filter @workspace/api-server run typecheck

# Makes three real read-only tool calls; run deliberately, not in ordinary unit tests.
pnpm --filter @workspace/api-server run check:mcp-protocol \
  "https://$REPLIT_DEV_DOMAIN/mcp"
pnpm --filter @workspace/api-server run check:mcp-protocol \
  https://abcde-mcp.replit.app/mcp
```

The ordinary API test command also includes the new `.test.mjs` regressions.
Supplied attachments remain intact; the integrated test suite changes their
module import to point to the implementation under test.

## Owner-approved publication and public checks

1. Obtain approval, then the owner publishes ABCDE.lv. Do not promote the
   upstream's advertised endpoint yet.
2. Run the official-client command against **https://abcde.lv/mcp**, then the
   original public endpoint. Report negotiated protocol, tool listing, bounded
   calls, matching text/structured output, JSON/SSE, notifications and errors.
3. Repeat invalid-Origin, payload, no-store, method, nonredirect and landing/API
   smoke checks on the actual public domain. Confirm the deployment Host reaches
   the handler and the hosting layer does not truncate the 45-second deadline;
   identify any checks still unverified rather than claiming they passed.
4. Connect a real Claude account without authentication and request a specific
   Rimi product. Check original names, IDs, nutrition and retailer links.
   SDK success alone does not establish real Claude compatibility.
5. Report results back to the separate MCP project. Only after public verification
   should that project promote its shared connection setting to the new endpoint,
   rebuild, check both languages/clipboard and request approval to republish.
   Do not rewrite proxied HTML or set obsolete VITE_PUBLIC_MCP_URL here.

For recovery, remove only the additional machine handler and its service-path
registration. Leave the landing integration and original connector available.
