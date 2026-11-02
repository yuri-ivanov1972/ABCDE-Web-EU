# Implementation acceptance and handoff use

## Owner sequence

1. Review `IMPLEMENTATION.md`: the API and runtime external Maxima read-only
   audit are complete; the original report's blocked audit is historical.
2. Confirm the intended deployment uses the audited database configuration;
   do not substitute the project's managed database or share secret values.
3. Review `API-CONTRACT.md` and `API-HANDOFF.txt`. Backend tests pass; no Chrome
   extension implementation or real Chrome installation was tested here.
4. Approve publication separately, then verify the actual public route before
   treating the extension's public API dependency as ready.
5. Create a new lightweight extension project, paste `START-PROMPT.txt` and
   provide `API-CONTRACT.md`, this report and the diagnostic. Do not remix the
   full website or connect database secrets to the extension.
6. Install the eventual extracted extension folder via `chrome://extensions`,
   Developer Mode, Load unpacked. After an update, rebuild, press Reload in
   Chrome's extension page and refresh Barbora tabs. A ZIP is for transport,
   not the folder selected for Load unpacked.

## API acceptance, in ABCDE.lv — completed in development

- [x] Exact text SKU keys retain leading zeros; Maxima grades only, no Rimi fallback.
- [x] Match positive samples, missing/invalid/null grades and ambiguous fixtures.
- [x] Verify actual configured external database index/uniqueness. No DDL performed.
- [x] 100 submitted items accepted, 101 rejected; deduplication is bounded.
- [x] JSON/body/encoding errors stay JSON, not SPA HTML.
- [x] Timeout, database outage, rate limit and admission failure are distinct
      from empty successful results; no false negative caching or retry flood.
- [x] No body, SKU, header, SQL, session, cookie, IP or browsing-history logging.
- [ ] Credentialless fixed-endpoint Chrome worker requests work after approved
      publication; CORS is not treated as authentication.
- [x] Existing page/MCP regressions and development health/product checks pass.

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

Update: the configured external Maxima audit and API implementation/testing
were subsequently completed; see `IMPLEMENTATION.md`. Still not performed:
actual extension installation, Chrome DevTools diagnostic execution, user
interactions, scrolling/navigation/card-reuse checks, basket changes,
publication or public-route verification.
