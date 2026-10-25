---
name: MCP product scope
description: User-confirmed scope for the proposed ABCDE MCP service.
---

Build ABCDE MCP in a separate Replit project, using the existing ABCDE.lv API. Include Rimi and Maxima, with Latvian and English landing-page and search support. Investigate existing price data before deciding whether pricing belongs in the first release.

If prices are incomplete or old, launch nutrition-only and remove budget and value claims. Claude should translate English search terms while preserving original product names. Do not collect beta emails in the first release.

**Why:** The user explicitly selected these options when reviewing the MCP proposal.

**How to apply:** Preserve these choices in the MCP brief and handoff. Do not assume a Rimi-only service or promise budget calculations before price coverage and freshness have been established.

The separately published MCP service owns its landing-page content. Its human
pages belong under ABCDE.lv's Latvian and English MCP paths, but the Claude
connector must remain `https://abcde-mcp.replit.app/mcp`.

**Why:** The user explicitly requested same-domain human pages without moving
the connector, and requires approval before publishing the main website.

**How to apply:** Preserve the independent service boundary and obtain approval
before publishing website integration changes; do not infer permission from the
upstream service already being published.
