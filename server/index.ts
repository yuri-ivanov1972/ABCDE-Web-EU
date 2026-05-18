import express, { type Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { injectSeoTags, type ProductSeoData, type CategorySeoData } from "./seo";
import { storage, type Store } from "./storage";
import { extractIdFromSlug, productSlug } from "./utils/slugify";
import { warmCache } from "./imageProxy";

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// CORS for mobile API endpoints (Expo Go and React Native apps)
app.use('/api/mobile', (req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// SEO: Inject canonical and hreflang tags into HTML responses
// This runs server-side so Google sees these tags immediately without JS execution
app.use((req: Request, res: Response, next: NextFunction) => {
  const originalSend = res.send;
  const originalEnd = res.end;
  
  const injectIfHtml = (body: any): any => {
    const contentType = res.get('Content-Type') || '';
    const isHtml = contentType.includes('text/html') || 
                   (typeof body === 'string' && body.includes('<!DOCTYPE html>'));
    
    if (isHtml && typeof body === 'string') {
      const urlPath = req.originalUrl || req.path;
      if (!urlPath.startsWith('/api') && !urlPath.includes('.')) {
        res.set('Cache-Control', 'public, max-age=300');
        const pageData: { product?: ProductSeoData; category?: CategorySeoData } = {};
        if (res.locals.seoProduct) pageData.product = res.locals.seoProduct;
        if (res.locals.seoCategory) pageData.category = res.locals.seoCategory;
        return injectSeoTags(body, urlPath, pageData);
      }
    }
    return body;
  };
  
  res.send = function(body: any): Response {
    return originalSend.call(this, injectIfHtml(body));
  };
  
  // Vite uses res.end() instead of res.send()
  (res as any).end = function(chunk?: any, encoding?: any, callback?: any): Response {
    if (typeof chunk === 'string') {
      chunk = injectIfHtml(chunk);
    }
    return originalEnd.call(this, chunk, encoding, callback);
  };
  
  next();
});

// 301 Redirect www to non-www for SEO canonicalization
app.use((req, res, next) => {
  const host = req.headers.host || '';
  if (host.startsWith('www.')) {
    const forwardedProto = req.headers['x-forwarded-proto'];
    const protocol = (forwardedProto === 'https' || forwardedProto === 'http') ? forwardedProto : 'https';
    const newHost = host.replace(/^www\./, '');
    return res.redirect(301, `${protocol}://${newHost}${req.originalUrl}`);
  }
  next();
});

// 301 Redirect trailing slashes to prevent duplicate content
app.use((req, res, next) => {
  const fullUrl = req.originalUrl || req.url;
  const qIndex = fullUrl.indexOf('?');
  const pathname = qIndex >= 0 ? fullUrl.substring(0, qIndex) : fullUrl;
  const query = qIndex >= 0 ? fullUrl.substring(qIndex) : '';
  if (pathname.length > 1 && pathname.endsWith('/') && !pathname.startsWith('/api') && !pathname.startsWith('/@') && !pathname.startsWith('/src') && !pathname.startsWith('/node_modules')) {
    return res.redirect(301, pathname.slice(0, -1) + query);
  }
  next();
});

// 301 redirect: /product/:id → /lv/product/:id  and  /category/:id → /lv/category/:id
// Must be BEFORE Vite/registerRoutes so Vite doesn't serve index.html first
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  const urlPath = req.path;
  const qs = req.originalUrl.includes('?') ? req.originalUrl.substring(req.originalUrl.indexOf('?')) : '';

  const noLangProduct = urlPath.match(/^\/product\/(.+)$/);
  if (noLangProduct) {
    return res.redirect(301, `/lv/product/${noLangProduct[1]}${qs}`);
  }

  const noLangCategory = urlPath.match(/^\/category\/(.+)$/);
  if (noLangCategory) {
    return res.redirect(301, `/lv/category/${noLangCategory[1]}${qs}`);
  }

  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // Pre-warm Barbora image cache — runs in background, doesn't delay server startup
  (async () => {
    try {
      const { products: firstPage } = await storage.getProducts({
        sortBy: "nutriScore",
        sortOrder: "asc",
        page: 1,
        pageSize: 24,
      });
      const seen = new Set<string>();
      const barboraUrls: string[] = [];
      for (const p of firstPage) {
        const primaryUrl = p.photos?.[0]?.photoUrl;
        if (
          typeof primaryUrl === "string" &&
          !seen.has(primaryUrl)
        ) {
          try {
            const { hostname } = new URL(primaryUrl);
            if (hostname === "cdn.barbora.lv") {
              seen.add(primaryUrl);
              barboraUrls.push(primaryUrl);
            }
          } catch { /* skip invalid URLs */ }
        }
      }
      if (barboraUrls.length > 0) {
        await warmCache(barboraUrls, 300);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[imageProxy] warmup failed:", msg);
    }
  })();

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // 301 redirect: /:lang/product/123 → /:lang/product/name-123 (old numeric URLs → slug URLs)
  // 301 redirect: /:lang/category/123 → /:lang/category/name-123
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const urlPath = req.path;

    const productNumeric = urlPath.match(/^\/(lv|en)\/product\/(\d+)$/);
    if (productNumeric) {
      const [, lang, rawId] = productNumeric;
      try {
        const product = await storage.getProductById(parseInt(rawId, 10));
        if (product?.slug) {
          const qs = req.originalUrl.includes('?') ? req.originalUrl.substring(req.originalUrl.indexOf('?')) : '';
          return res.redirect(301, `/${lang}/product/${product.slug}${qs}`);
        }
      } catch { /* fall through to next middleware */ }
      return next();
    }

    const categoryNumeric = urlPath.match(/^\/(lv|en)\/category\/(\d+)$/);
    if (categoryNumeric) {
      const [, lang, rawId] = categoryNumeric;
      try {
        const category = await storage.getCategoryById(parseInt(rawId, 10));
        if (category?.slug) {
          return res.redirect(301, `/${lang}/category/${category.slug}`);
        }
      } catch { /* fall through to next middleware */ }
      return next();
    }

    next();
  });

  // Catch-all redirect for non-language-prefixed SPA paths to /lv/ (default language) for SEO
  // This ensures Googlebot sees proper 301 redirects for all pages without language prefix
  // Must be placed BEFORE Vite middleware which serves HTML for all remaining routes
  app.use((req: Request, res: Response, next: NextFunction) => {
    const urlPath = req.path;
    
    // Skip paths that should not be redirected
    if (
      urlPath.startsWith('/lv') ||
      urlPath.startsWith('/en') ||
      urlPath.startsWith('/api') ||
      urlPath.startsWith('/@') ||  // Vite internal paths
      urlPath.startsWith('/src') || // Vite source files in dev
      urlPath.startsWith('/node_modules') ||
      urlPath === '/robots.txt' ||
      urlPath === '/sitemap.xml' ||
      urlPath.includes('.') // Static files with extensions (favicon.ico, etc.)
    ) {
      return next();
    }
    
    // Only redirect GET/HEAD requests that accept HTML (browsers, crawlers)
    // This avoids redirecting POST/PUT/DELETE requests, health checks, or other tooling
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next();
    }
    
    const acceptsHtml = req.accepts(['html', 'json']) === 'html';
    if (!acceptsHtml && req.headers.accept && !req.headers.accept.includes('*/*')) {
      return next();
    }
    
    // Redirect any non-prefixed SPA path to /lv/...
    const queryString = req.originalUrl.includes('?') ? req.originalUrl.substring(req.originalUrl.indexOf('?')) : '';
    const redirectUrl = `/lv${urlPath === '/' ? '' : urlPath}${queryString}`;
    return res.redirect(301, redirectUrl);
  });

  // Server-side 404 detection for product and category pages
  // Returns real HTTP 404 status to prevent Google "Soft 404" errors
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    const urlPath = req.path;
    
    // Only check HTML page requests (not API, assets, etc.)
    if (req.method !== 'GET' || urlPath.startsWith('/api') || urlPath.includes('.')) {
      return next();
    }
    
    // Helper to serve proper 404 page
    const serve404 = (lang: string) => {
      const isLv = lang === 'lv';
      const title = isLv ? 'Lapa nav atrasta' : 'Page Not Found';
      const message = isLv ? 'Atvainojiet, šī lapa neeksistē.' : 'Sorry, this page does not exist.';
      const backHome = isLv ? 'Atpakaļ uz sākumu' : 'Back to Home';
      
      res.status(404).set({ 'Content-Type': 'text/html' }).send(`<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex">
  <title>${title} - ABCDE.lv</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f9fafb; }
    .card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center; max-width: 400px; }
    h1 { color: #111827; margin: 0 0 1rem; }
    p { color: #6b7280; margin: 0 0 1.5rem; }
    a { display: inline-block; background: #16a34a; color: white; padding: 0.75rem 1.5rem; border-radius: 6px; text-decoration: none; }
    a:hover { background: #15803d; }
  </style>
</head>
<body>
  <div class="card">
    <h1>404</h1>
    <p>${message}</p>
    <a href="/${lang}">${backHome}</a>
  </div>
</body>
</html>`);
    };
    
    const productMatch = urlPath.match(/^\/(lv|en)\/product\/([a-z0-9][a-z0-9-]*-\d+|\d+)$/i);
    if (productMatch) {
      const lang = productMatch[1];
      const urlSlug = productMatch[2];
      const productId = extractIdFromSlug(urlSlug)!;
      try {
        let product = await storage.getProductById(productId);

        // Rimi and Maxima can share the same numeric product ID.
        // If the returned product's slug doesn't match the URL slug, the lookup
        // found the wrong store's product — try the other store explicitly.
        if (product && productSlug(product.name, product.productId) !== urlSlug) {
          const maximaProduct = await storage.getProductById(productId, 'maxima' as Store);
          if (maximaProduct && productSlug(maximaProduct.name, maximaProduct.productId) === urlSlug) {
            product = maximaProduct;
          }
        }

        if (!product) {
          log(`404: Product ${productId} not found`);
          return serve404(lang);
        }
        res.locals.seoProduct = {
          name: product.name,
          nutriScoreGrade: product.nutrition?.nutriScoreGrade || null,
          energyKcal: product.nutrition?.energyKcal || null,
          categoryNameLv: product.category?.nameLv || null,
          categoryNameEn: product.category?.nameEn || null,
          store: product.store || 'rimi',
          photoUrl: product.photos?.[0]?.photoUrl || null,
          quantityValue: product.quantityValue || null,
          quantityUnit: product.quantityUnit || null,
          productId: product.productId,
        } as ProductSeoData;
      } catch (err) {
        console.error('Error checking product existence:', err);
      }
      return next();
    }
    
    const categoryMatch = urlPath.match(/^\/(lv|en)\/category\/([a-z0-9][a-z0-9-]*-\d+|\d+)$/i);
    if (categoryMatch) {
      const lang = categoryMatch[1];
      const categoryId = extractIdFromSlug(categoryMatch[2])!;
      try {
        const category = await storage.getCategoryById(categoryId);
        if (!category) {
          log(`404: Category ${categoryId} not found`);
          return serve404(lang);
        }
        res.locals.seoCategory = {
          nameLv: category.nameLv,
          nameEn: category.nameEn,
          categoryId: category.categoryId,
          level: category.level,
        } as CategorySeoData;
      } catch (err) {
        console.error('Error checking category existence:', err);
      }
      return next();
    }
    
    next();
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    const distPath = path.resolve(import.meta.dirname, "public");
    if (!fs.existsSync(distPath)) {
      throw new Error(`Could not find the build directory: ${distPath}, make sure to build the client first`);
    }
    app.use(express.static(distPath));
    const indexHtml = fs.readFileSync(path.resolve(distPath, "index.html"), "utf-8");
    app.use("*", (_req, res) => {
      res.status(200).set({ "Content-Type": "text/html" }).send(indexHtml);
    });
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
