import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// 301 Redirect www to non-www for SEO canonicalization
app.use((req, res, next) => {
  const host = req.headers.host || '';
  if (host.startsWith('www.')) {
    // Only allow https or http protocols to prevent open redirect vulnerability
    const forwardedProto = req.headers['x-forwarded-proto'];
    const protocol = (forwardedProto === 'https' || forwardedProto === 'http') ? forwardedProto : 'https';
    const newHost = host.replace(/^www\./, '');
    return res.redirect(301, `${protocol}://${newHost}${req.originalUrl}`);
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

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
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

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
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
