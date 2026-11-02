# Implementation acceptance and handoff use

## Owner sequence

1. Review `REPORT.md`. Exact SKUs were verified, but the complete external
   Maxima audit is blocked by unavailable read-only connection access.
2. Have an authorized owner run `READ-ONLY-AUDIT.sql` against the actual Maxima
   database, not Rimi, scans or the project's managed production database.
   Share only aggregate/index results; never send credentials.
3. Approve the API implementation task separately in ABCDE.lv.
4. After backend tests pass, approve publication and verify the proposed route
   on the public domain. No such endpoint was created by this handoff.
5. Create a new lightweight extension project, paste `START-PROMPT.txt` and
   provide `API-CONTRACT.md`, this report and the diagnostic. Do not remix the
   full website or connect database secrets to the extension.
6. Install the eventual extracted extension folder via `chrome://extensions`,
   Developer Mode, Load unpacked. After an update, rebuild, press Reload in
   Chrome's extension page and refresh Barbora tabs. A ZIP is for transport,
   not the folder selected for Load unpacked.

## API acceptance, in ABCDE.lv

- [ ] Exact text SKU keys retain leading zeros; Maxima only, no Rimi fallback.
- [ ] Match positive samples, missing/invalid/null grades and ambiguous fixtures.
- [ ] Verify actual index/uniqueness before any migration. No automatic DDL.
- [ ] 100 submitted items accepted, 101 rejected; deduplication is bounded.
- [ ] JSON/body/encoding errors stay JSON, not SPA HTML.
- [ ] Timeout, database outage, rate limit and admission failure are distinct
      from empty successful results; no false negative caching or retry flood.
- [ ] No body, SKU, header, SQL, session, cookie, IP or browsing-history logging.
- [ ] Credentialless fixed-endpoint Chrome worker requests work after approved
      publication; CORS is not treated as authentication.
- [ ] Existing website, mobile, MCP and other APIs remain unchanged.

## Extension acceptance, in the separate project

- [ ] Static matches are scoped to real Barbora catalogue/detail UI, not basket,
      account, history or checkout areas.
- [ ] Category, search and promotion roots are verified; homepage/recommendation
      layout supported only after its own check.
- [ ] Correct handling of two responsive detail blocks for one product.
- [ ] No badge for unknown, ambiguous or invalid-grade products.
- [ ] Observer changes, navigation/back and recycled nodes never leave a stale
      badge or attach an old request's grade to another product.
- [ ] Maximum one intended badge per presentation; no observer self-trigger loop.
- [ ] No nested anchors, button interception or covered shopping controls.
- [ ] Fixed worker API operation, validated sender, limited queue and concurrency.
- [ ] API timeout/error/429 is not classified as a missing product.
- [ ] Bounded ephemeral caches, no durable product/browsing history.
- [ ] Clear ABCDE attribution, accessible contrast, keyboard behavior and LV/EN.
- [ ] Link opens a validated ABCDE product in a new tab without opener/referrer.
- [ ] Installed Chrome tests recorded honestly; fixtures do not substitute for
      live extension checks.
- [ ] ZIP contains runtime files with manifest at root, no credentials, source
      diagnostics, fixtures, development modules or third-party tracking.

## Local diagnostic

`DOM-DIAGNOSTIC.js` is **not** the extension. It makes no requests and changes
no retailer DOM. It observes the selected subtree temporarily.

1. Open a public Barbora category/search/promotion or detail page in desktop
   Chrome. Prefer an empty cart and never select account or basket regions.
2. In DevTools Elements select only the catalogue result grid, one product card,
   or the main product detail block. The selected element is available as `$0`.
3. Review the diagnostic source, then paste its contents into DevTools Console.
   The script uses that `$0` subtree, not the entire document.
4. Record the initial aggregate report and first few public test SKU examples.
   Scroll/load more within that selected grid, then compare aggregate counts.
5. It disconnects after 30 seconds. Navigation can replace the selected subtree;
   reselect the new catalogue root and rerun deliberately.
6. Share only these diagnostic counts/test identifiers, not a full DOM, HAR,
   cookies, network headers, cart, address, account or session storage dump.

Observed markup is a starting point, not a selector guarantee. A diagnostic
result with no identifiers is a finding, not permission to infer products by
name or position.

## Evidence level achieved in this handoff

Performed: source/schema inspection, public API JSON reads, static live HTML
parsing, exact SKU comparisons, one external category screenshot and public
Chrome network-documentation review.

Not performed: full external database audit, actual extension installation,
Chrome DevTools diagnostic execution, user interactions, scrolling/navigation/
card-reuse checks, basket changes, endpoint implementation or publication.
