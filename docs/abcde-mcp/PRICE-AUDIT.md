# Price audit — evidence and release gate

Date: 2026-10-24. This is an audit of what can currently be established, not a certification of live retailer prices.

## Result

**Price coverage and freshness could not be measured. Launch nutrition-only.**

| Question | Rimi | Maxima |
|---|---|---|
| Price-history schema exists in source | Yes | Shared schema definition |
| Source uses latest stored availability | Yes | Yes |
| Price in captured product list/detail responses | No | No |
| Direct database audit access available in this workspace | No | No |
| Percentage with usable latest prices | Unverified | Unverified |
| Age distribution of latest prices | Unverified | Unverified |
| Actual currencies and unit conventions in rows | Unverified | Unverified |
| Discount/loyalty semantics | Unverified | Unverified |

The secure environment inspection reported both external database secrets absent in development. No secret value was read, requested, copied, or printed, and no connection was created. Replit's managed database is not a substitute for these external retailer databases.

Source declares regular price, currency, availability, recorded timestamp, data source, unit price/type, discount price, and discount unit price. A declared field is not proof of populated, fresh, correct data. Source queries of availability are evidence of the intended data path, not an independent direct audit.

Product update timestamps must not be substituted for price-record timestamps. Nutrition timestamps also do not certify price freshness.

## Consequences for this release

- Omit `max_price`, price ordering, budget calculations, line prices, basket grand prices, price per kg, and value/protein-per-euro claims.
- Do not include budget or best-value example prompts.
- Do not synthesize price 0, use old values without dates, infer prices from names, scrape retailer pages, or ask the MCP project for retailer database secrets.
- Explain explicitly when a user asks a price question: the connector has nutrition data but no verified prices; check the retailer website.
- The future API extension is separate work in the existing website project. It is not needed for the nutrition-only release.

## Future read-only audit checklist

With authorized access to each existing external database, separately:

1. Use a read-only transaction and a short statement timeout. Inspect schema before queries; never select credentials or personal information.
2. Select the latest record per product with a deterministic tie-break on recorded time and price-history ID. Count products with no record, unavailable latest records, positive/zero/negative/null prices, invalid units, missing currency, and future-dated records.
3. Report coverage both across all products and across the exact public catalogue eligibility rules. Rimi excludes selected hidden categories; Maxima requires normalized category mapping; catalogue nutrition eligibility also limits coverage.
4. Report age buckets of latest records: within 24 hours, 1–3 days, 3–7 days, 7–30 days, and older than 30 days. Include oldest/latest timestamps and median age; do not report only the newest row in the table.
5. Group by currency, data source, package unit, and unit-price type. Check whether package price and unit price agree where mass is known.
6. Count regular/discount coexistence, implausible discounts, and missing discount context. Verify loyalty-only or conditional pricing from source documentation; field names alone do not establish eligibility.
7. Recommend an explicit freshness policy appropriate to the update cadence. Report excluded/unknown items rather than filling gaps. Get approval before enabling budget promises or extending the API.

Even with fresh stored prices, totals are estimates as of the recorded date, not guaranteed checkout prices. Delivery fees, loyalty conditions, weighted goods, promotions, substitutions, and stock require separate treatment.
