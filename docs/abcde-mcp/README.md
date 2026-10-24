# ABCDE MCP — separate-project handoff

Prepared 2026-10-24. This folder is documentation and captured public API evidence, not an MCP implementation.

## Start here

1. Create a **separate Replit project**.
2. Paste the entire contents of `START-PROMPT.txt` into its first message.
3. Optionally upload this folder's API reference and evidence files for additional context.

The prompt is self-contained: it includes the real API URL, usable endpoint examples, field mappings, known limitations, release requirements, and acceptance checks. It does not require this repository, its database connections, or its secrets.

## Decision

**Build the first release as a nutrition-only shopping-list assistant for Rimi and Maxima.**

Prices exist in the database schema but are not exposed by the product API. Database access needed to measure price coverage/freshness was unavailable during this task. This is not evidence that prices are absent or stale; it is insufficient evidence to promise them. The user approved launching without pricing in that situation.

- Latvian and English landing page and conversation guidance.
- Claude translates English search terms; preserve original Latvian product names.
- Public, read-only MCP; no login, payment, checkout, or retailer cart creation.
- No budget promises, price filters, price totals, best-value claims, or email collection.
- Store-qualified identifiers and explicit handling of missing data.
- Durable aggregate counters with honest session definitions, not unique-person claims.

## Confirmed API issue

On 2026-10-24, a request with `store=rimi&search=maize` returned a Maxima item. Both store-specific search requests returned the same mixed-store result.

A separate request with `store=maxima&search=maize&proteinMin=90` returned products with protein values `17.0` and `16.0`. The source confirms that store selection is ignored by the search method and that Maxima search nutrient filters are incomplete.

**The MCP implementation must recheck every returned product against requested store and nutrient constraints**, scan only bounded additional pages, and label partial coverage. Do not claim exhaustive retailer results or global rankings from a limited candidate scan. A separate API fix is recommended, not performed here.

## Files

- `START-PROMPT.txt`: ready-to-paste instructions for the new project.
- `API-REFERENCE.md`: real endpoints, mappings, captures, and integration caveats.
- `PRICE-AUDIT.md`: what was verified, what could not be checked, and the future pricing gate.
- `evidence/*.json`: eight unmodified-content public JSON response captures, pretty-printed.
- `evidence/requests.json`: request URLs and capture context.

## What was verified

Public deployment metadata reported `https://abcde.lv`, public visibility, and a successful build. Nine bounded HTTP GET requests succeeded: health, two catalogue lists, two product details, two searches, categories, and a nutrient-filter probe. Eight JSON bodies are included; the health response was `{"status":"ok"}`.

No database query, website/API edit, server implementation, installation, workflow change, or publication was performed. Future MCP SDK tests, browser checks, publishing, and a real Claude connection remain acceptance work in the new project.

## References

- MCP transport specification: https://modelcontextprotocol.io/specification/latest/basic/transports
- MCP TypeScript SDK: https://github.com/modelcontextprotocol/typescript-sdk
- Claude custom connectors: https://support.claude.com/en/articles/11175166-getting-started-with-connectors
- Replit persistence guidance: https://docs.replit.com/build/troubleshooting

The current MCP specification is newer than many initialization/session-based examples. The implementer must select an official SDK release compatible with the actual Claude client and document the supported protocol versions. Do not copy stale session-handshake examples without checking them.
