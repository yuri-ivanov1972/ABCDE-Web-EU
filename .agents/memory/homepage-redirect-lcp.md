---
name: Homepage redirect and LCP
description: Why the / → /lv redirect must be a fast inline script, not a React client-side redirect, for good Lighthouse LCP.
---

# Homepage redirect and LCP

## The rule
The root `/` path must redirect to `/lv` via a tiny inline `<script>` in `index.html`, NOT via wouter's `<Redirect>` component in React.

## Why
Lighthouse tests the root URL `/`. When the redirect is done by React (wouter), Lighthouse must wait for the entire JS bundle to download and execute (~3.3s FCP) before the redirect fires. That makes LCP 7+ seconds.

The inline script in `index.html` fires during HTML parsing, before any bundle download — the redirect happens in <100ms. Lighthouse then times LCP from the SSR-enriched `/lv` page, which has products pre-embedded and a `<link rel="preload" fetchpriority="high">` for the LCP image.

## How to apply
- Keep the `window.location.replace(...)` block at the top of the existing inline `<script>` in `index.html`.
- Express handles `/lv` and `/en` via `serveHomepage()` in routes.ts — it injects `__ABCDE_INITIAL_DATA__` (skips first API round-trip) and the LCP image preload.
- Do NOT remove or defer the inline redirect script.
- `/lv` and `/en` must stay in the api-server `artifact.toml` paths so Express intercepts them (not the Vite static server).

## Dev mode note
In dev, `serveHomepage()` must inject `DEV_VITE_PREAMBLE` into the base HTML before calling `injectSeoTags()`. Without it, `@vitejs/plugin-react` throws "can't detect preamble" and the page is blank.
