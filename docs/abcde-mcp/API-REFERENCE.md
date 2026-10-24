# ABCDE.lv API reference for MCP

Verified from source and bounded public requests on 2026-10-24. Base URL: **https://abcde.lv/api**. Catalogue reads require no API key. This is not an exhaustive OpenAPI specification.

The repository's existing OpenAPI file documents only `/healthz`; it does not describe the working catalogue routes. Do not conclude the catalogue is missing merely because it is absent from that file.

## Endpoints

| Method and path relative to base | Response | Use |
|---|---|---|
| GET `/healthz` | `{"status":"ok"}` | API process health, not a guarantee of database health |
| GET `/products` | `{products: Product[], totalCount: number}` | Catalogue, filters, name search |
| GET `/products/:id?store=rimi` | Product directly, no wrapper | Rimi detail |
| GET `/products/:id?store=maxima` | Product directly, no wrapper | Maxima detail |
| GET `/categories?level=1` | Category array | Top-level bilingual category names |
| GET `/categories?parentId=ID` | Category array | Child categories |
| GET `/categories/:id` | Category object | Single category |
| GET `/categories/:id/path` | Category array | Root-to-leaf breadcrumb |

Only health, catalogue/list/search, detail, and top-level category requests were exercised during this handoff. Remaining category routes are source-verified.

### Real working URLs

```text
https://abcde.lv/api/products?store=rimi&pageSize=1&sortBy=name&sortOrder=asc
https://abcde.lv/api/products?store=maxima&pageSize=1&sortBy=name&sortOrder=asc
https://abcde.lv/api/products/3975?store=rimi
https://abcde.lv/api/products/7451?store=maxima
https://abcde.lv/api/products?search=maize&proteinMin=10&pageSize=2&sortBy=protein&sortOrder=desc
https://abcde.lv/api/categories?level=1
```

IDs are real examples from the captured catalogue, not permanent guarantees of availability.

### Catalogue parameters

| Parameter | Accepted values / defaults |
|---|---|
| `page` | Integer 1–500, default 1 |
| `pageSize` | Integer 1–100, default 12 |
| `search` | 2–200 characters; omit entirely for filter-only browsing |
| `store` | `rimi` / `maxima`, omitted means both; see search limitation below |
| `categoryId` | Numeric category ID; supported for browsing, not reliably applied during search |
| `nutriScores` | Comma-separated A–E; API normalizes case |
| `proteinMin`, `proteinMax` | Numeric bounds |
| `sugarMin`, `sugarMax` | Numeric bounds |
| `fatMin`, `fatMax` | Numeric bounds |
| `saltMin`, `saltMax` | Numeric bounds |
| `madeInLatvia` | `true` to enable |
| `sortBy` | `name`, `nutriScore`, `sugar`, `fat`, `protein`, `salt`; default `name` |
| `sortOrder` | `asc`, `desc`; default `asc` |

No public `max_price`, budget, price sort, or translation parameter exists. Never forward invented parameters and assume the API applied them.

## Real response excerpts

These are shortened projections of the captured responses; omitted fields are not shown. See the evidence files for complete bodies.

Rimi list response:

```json
{
  "products": [{
    "productId": 3975,
    "sku": "952513",
    "name": "\"LATVIJAS Graudu maize\" kliju pilngraudu 300g",
    "quantityValue": "300.00",
    "quantityUnit": "g",
    "store": "rimi",
    "externalUrl": "https://www.rimi.lv/e-veikals/lv/produkti/p/952513",
    "slug": "latvijas-graudu-maize-kliju-pilngraudu-300g-3975",
    "nutrition": {
      "protein": "11.10",
      "carbsSugars": "0.50",
      "fatTotal": "3.60",
      "salt": "1.00",
      "nutriScoreGrade": "B"
    }
  }],
  "totalCount": 7578
}
```

Maxima detail excerpt, returned directly rather than under `product`:

```json
{
  "productId": 7451,
  "name": "100% rudzu miltu tostermaize Latvijas Tost Maize LATVIJAS MAIZNIEKS 390g",
  "quantityValue": "390",
  "quantityUnit": "g",
  "store": "maxima",
  "externalUrl": "https://barbora.lv/produkti/tostermaize-latv-tost-maize-rudzu-390-g",
  "nutrition": {
    "protein": "11.9",
    "carbsSugars": "4.6",
    "fatTotal": "4.6",
    "salt": "1.6",
    "nutriScoreGrade": "D",
    "dataSourceDate": null
  }
}
```

Category excerpt:

```json
{
  "categoryId": 10,
  "rimiCategoryCode": "SH-7",
  "nameLv": "Maize un konditoreja",
  "nameEn": "Bread and pastry shop",
  "parentCategoryId": null,
  "level": 1,
  "slug": "maize-un-konditoreja-10"
}
```

## Mapping into MCP output

| MCP concept | Source |
|---|---|
| Product reference | Pair `store` + `productId`, never ID alone |
| Name | `name`, preserve original text |
| Brand | No dedicated field exposed; do not invent/extract silently |
| Package | `quantityValue` + `quantityUnit`, both potentially missing |
| Protein | `nutrition.protein` |
| Sugar | `nutrition.carbsSugars` |
| Fat / saturated fat | `nutrition.fatTotal` / `nutrition.fatSaturated` |
| Salt / fibre | `nutrition.salt` / `nutrition.fiber` |
| Carbohydrates | `nutrition.carbsTotal` |
| Energy | `nutrition.energyKcal` / `nutrition.energyKj` |
| Nutri-Score | `nutrition.nutriScoreGrade` |
| Ingredients text | `nutrition.ingredientsText` |
| Ingredient analysis | `ingredientCard`; may be omitted, not an allergen-safety guarantee |
| Retailer link | `externalUrl`, or Rimi's `rimiUrl` if necessary |
| Photo | `photos.find(p => p.isPrimary)?.photoUrl`, then first photo, then null |
| Category translation | `category.nameLv` / `category.nameEn` |
| Price / currency / discount / price per kg | Not exposed by current product API |
| Nutrition date | `nutrition.dataSourceDate`, nullable |
| Product update date | `updatedAt`, not proof of nutrition or price freshness |

Parse finite numeric strings to numbers; preserve null, undefined, and empty values as unknown, never zero. Legitimate numeric zero must remain zero. Grades outside A–E become unknown.

The API has no explicit nutrient-basis field distinguishing per-100-g from per-100-ml or dry/prepared values. For mass-packaged foods, expose the site's per-100-g convention as an assumption, not a separately verified label. For volume/piece/unknown-unit products, do not relabel uncertain values as per-100-g or compute package protein without a verified compatible basis.

Ingredient text and product names are not automatically translated. No full-text allergen guarantees, clinical recommendations, or live stock promises follow from these fields.

## Confirmed integration limitations

### Store and nutrient filters

The live search probes with `store=rimi` and `store=maxima`, otherwise identical, both returned Maxima 11277 followed by Rimi 192 and `totalCount: 254`. Returned protein values were 17.0 and 16.00.

The stronger probe `search=maize&store=maxima&proteinMin=90` returned Maxima 11277 and 7467 with protein 17.0 and 16.0, `totalCount: 202`.

Source review agrees: search combines both stores, ignores the store option and category selection, and applies only a subset of nutritional conditions to Maxima. The non-search Maxima helper also lacks complete numeric nutrient filtering. Therefore:

- Recheck store and every requested nutrient bound against actual returned fields in the MCP adapter, for both browsing and search.
- Missing values do not satisfy numeric constraints.
- Preserve store-qualified identities and never relabel a returned store based on the requested store.
- Use bounded page scanning to fill results; do not download the whole catalogue.
- Return `partial`, `candidate_count`, `pages_scanned`, `has_more_candidates`, and limitations as appropriate.
- Upstream `totalCount` is not an authoritative count after adapter filtering.
- Search candidate sets are internally capped at 1,000 per store. Combined browsing is also capped internally. Do not promise exhaustive results or globally optimal nutrition rankings.

### Availability

Catalogue inclusion uses the latest stored availability record, not a live retailer stock check. Detail lookup may find items outside currently visible catalogue results. Retailer links can change.

### Detail versus mobile routes

Use the ordinary `/products/:id?store=...` route. The existing simplified `/mobile/product/:store/:id` response omits Nutri-Score and detailed ingredient analysis, so it is not a substitute.

### Errors

List validation returns HTTP 400 with `message` and an `errors` array. Missing product returns 404 with `message`; database failures generally return 500 with `message`. Do not assume every failure is JSON: gateways can return HTML. Handle content type, response size, parse errors, and timeouts explicitly.

### Images and external links

Do not download images in MCP search/detail tools. Return validated HTTPS URLs as data. Maxima links lead to Barbora. The existing `/image-proxy?url=...&w=300` only allows Barbora's CDN; it is not a generic image relay and can return 502/504.

Keep source-site and retailer links distinct. If returning an ABCDE.lv product link, use its returned slug rather than a numeric-only link, because IDs overlap across stores.
