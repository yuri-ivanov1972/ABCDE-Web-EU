# LCP Measurement Report — Product Pages
**Task:** #13 | **Date:** 2026-05-21 | **Author:** Agent

---

## Background

Task #12 addressed the root cause of 10,000+ "poor LCP" URLs in Google Search Console by injecting server-rendered content into every product page HTML response before the React bundle executes:

| Optimization | What it does |
|---|---|
| `<link rel="preload" as="image" fetchpriority="high">` | Injected early in `<head>`, before Cloudinary preconnect link — browser starts image download before JS/CSS bundles are parsed |
| `<img fetchpriority="high" loading="eager">` in `#seo-prerender` | Visible above-fold image present in the initial HTML response; becomes the LCP candidate immediately |
| `<script id="__ABCDE_PRODUCT_DATA__">` | Full product JSON in the HTML; React hydrates without a blocking API round-trip |

---

## HTML-Level Verification (2026-05-21)

The following checks were performed by fetching product page HTML from the running server and confirming the expected tags are present.

### Product 486 — Rimi / Cloudinary image

**URL:** `https://abcde.lv/lv/product/olas-zemnieku-a-lm-nr2-10gab-486`  
**Image type:** Cloudinary CDN (direct, responsive srcset)

**Verified present in HTML:**
```html
<!-- Early preload in <head> -->
<link rel="preload" as="image"
  href="https://rimibaltic-res.cloudinary.com/.../MAT_279989_PCE_LV"
  imagesrcset="...w_300... 300w, ...w_600... 600w, ...w_900... 900w"
  imagesizes="(min-width: 768px) 50vw, 100vw"
  fetchpriority="high" />

<!-- SSR img in #root before React bundle runs -->
<div id="seo-prerender">
  <img src="https://rimibaltic-res.cloudinary.com/.../MAT_279989_PCE_LV"
    srcset="...300w, ...600w, ...900w"
    width="600" height="400"
    fetchpriority="high" loading="eager"
    alt="Olas Zemnieku A/LM nr2 10gab"
    style="width:100%;max-width:600px;height:auto;display:block" />
  <h1>Olas Zemnieku A/LM nr2 10gab</h1>
  <p>Nutri-Score A</p>
  ...
</div>

<!-- Product data script — eliminates API round-trip -->
<script id="__ABCDE_PRODUCT_DATA__" type="application/json">
  {"productId":486,"name":"Olas Zemnieku A/LM nr2 10gab",...}
</script>
```
✅ All three LCP optimizations confirmed present.

---

### Product 11263 — Maxima / Barbora image (via proxy)

**URL:** `https://abcde.lv/lv/product/biezpiens-vajpiena-limbazu-piens-0-5-170g-11263`  
**Image type:** Barbora CDN → `/api/image-proxy` (WebP, resized)

**Verified present in HTML:**
```html
<!-- Early preload — proxy URL -->
<link rel="preload" as="image"
  href="/api/image-proxy?url=https%3A%2F%2Fcdn.barbora.lv%2F...&amp;w=900"
  imagesrcset="/api/image-proxy?...&amp;w=300 300w, ...&amp;w=600 600w, ...&amp;w=900 900w"
  imagesizes="(min-width: 768px) 50vw, 100vw"
  fetchpriority="high" />

<!-- SSR img via proxy -->
<div id="seo-prerender">
  <img src="/api/image-proxy?url=...&amp;w=900"
    srcset="/api/image-proxy?...&amp;w=300 300w, ..."
    fetchpriority="high" loading="eager"
    alt="Biezpiens vājpiena LIMBAŽU PIENS 0,5% 170g" />
  <h1>Biezpiens vājpiena LIMBAŽU PIENS 0,5% 170g</h1>
  <p>Nutri-Score A</p>
  ...
</div>

<script id="__ABCDE_PRODUCT_DATA__" type="application/json">
  {"productId":11263,"store":"maxima",...}
</script>
```
✅ All three LCP optimizations confirmed present.

---

## Image URL Pattern Distribution

From `/api/lcp-diagnostic?sample=50` (top-50 Nutri-Score A/B products per store):

| Image type | Store | Count (of 100) | % | LCP expectation |
|---|---|---|---|---|
| Cloudinary CDN | Rimi (~5,935 products) | 50 | 50% | Fast — direct CDN, no proxy hop |
| Barbora proxy | Maxima (~1,802 products) | 50 | 50% | Good if proxy cache is warm; cold miss adds ~200–400ms |
| No photo | — | 0 | 0% | Text becomes LCP candidate (usually fast, ~0.5–1.0s) |

> Note: Distribution reflects the best Nutri-Score products. Across the full catalog, Rimi accounts for ~76% of products and Maxima ~24%.

---

## Lighthouse Mobile — How to Run

Since PageSpeed Insights API quota was exhausted during automated measurement, run manually using one of:

### Option A: PageSpeed Insights Web UI
1. Open https://pagespeed.web.dev/
2. Test these representative URLs (mobile preset):
   - **Rimi/Cloudinary:** `https://abcde.lv/lv/product/olas-zemnieku-a-lm-nr2-10gab-486`
   - **Rimi/Cloudinary:** `https://abcde.lv/lv/product/rupjmaize-dzirnavu-borodina-250g-256`
   - **Maxima/Barbora:** `https://abcde.lv/lv/product/biezpiens-vajpiena-limbazu-piens-0-5-170g-11263`
   - **Maxima/Barbora:** `https://abcde.lv/lv/product/lecas-just-nature-sarkanas-nelobitas-500g-4381`
3. Record LCP values. Target: ≤ 2.5s (good = ≤ 2.0s)

### Option B: Lighthouse CLI
```bash
npx lighthouse https://abcde.lv/lv/product/olas-zemnieku-a-lm-nr2-10gab-486 \
  --strategy=mobile \
  --only-audits=largest-contentful-paint,server-response-time \
  --output=json | jq '.audits["largest-contentful-paint"].numericValue'
```

### Expected results (post-Task #12)
- **Before Task #12:** Browser could not start image download until React bundle was parsed and hydrated (~2–4s on mobile 4G). LCP element was discovered late → "Poor" (> 4s).
- **After Task #12:** Preload tag fires at HTML parse time; SSR `<img>` is immediately visible. LCP target: ≤ 2.0s for Cloudinary, ≤ 2.5s for Barbora proxy (warm cache).

---

## GSC Core Web Vitals — 28-Day Monitoring Checklist

GSC uses a rolling 28-day field data window. Recovery is visible gradually.

| Date | Action | Expected |
|---|---|---|
| 2026-05-21 | Task #12 deployed. Baseline: ~12,000 poor LCP URLs | — |
| 2026-05-28 | Check GSC → Core Web Vitals → Mobile → Poor URLs | Count should start declining |
| 2026-06-04 | Second check (+14 days post-deploy) | Significant drop if crawler re-indexed pages |
| 2026-06-18 | Final check (+28 days post-deploy) | Target: poor URLs ≈ pre-May-14 baseline (~483) |

**How to check in GSC:**
1. Google Search Console → abcde.lv property
2. Core Web Vitals (left sidebar)
3. Mobile → Open Report
4. "Poor URLs" count (filter: LCP)
5. Click "Validate Fix" when count drops — this accelerates re-crawling

---

## Diagnostic Endpoint

Use `/api/lcp-diagnostic` (added in Task #13) to inspect any product:

```bash
# Single product — returns preload URL, imageType, optimization flags
curl "https://abcde.lv/api/lcp-diagnostic?productId=486"

# Distribution across top-N products per store
curl "https://abcde.lv/api/lcp-diagnostic?sample=20"
```

If post-deployment LCP remains > 2.5s for Barbora proxy products, check:
1. Is the proxy cache warm? (Server restart clears it; startup warmup covers only top-24)
2. Is the Barbora CDN responding slowly? (Check `/api/image-proxy?url=...&w=300` directly)
3. For Cloudinary products still slow: check if Cloudinary transformation cache is cold (first-request penalty)
