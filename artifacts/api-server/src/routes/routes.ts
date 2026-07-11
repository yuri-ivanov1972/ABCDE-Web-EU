import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { readFile } from "fs/promises";
import { join } from "path";
import { storage } from "../storage";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";
import { rimiDb, maximaDb, rimiPool, maximaPool } from "../db";
import { normalizeLvText } from "../utils/textNormalization";
import { categorySlug, productSlug, extractIdFromSlug } from "../utils/slugify";
import { handleImageProxy } from "../imageProxy";
import type { Store } from "@workspace/db";
import { injectSeoTags } from "../seo";

// Define API route schemas
const getCategoriesQuerySchema = z.object({
  level: z.coerce.number().optional(),
  parentId: z.coerce.number().optional()
});

const getProductsQuerySchema = z.object({
  categoryId: z.coerce.number().optional(),
  page: z.coerce.number().optional().default(1),
  pageSize: z.coerce.number().optional().default(12),
  nutriScores: z.string().optional().transform(val => val ? val.split(',') : undefined),
  sugarMin: z.coerce.number().optional(),
  sugarMax: z.coerce.number().optional(),
  fatMin: z.coerce.number().optional(),
  fatMax: z.coerce.number().optional(),
  proteinMin: z.coerce.number().optional(),
  proteinMax: z.coerce.number().optional(),
  saltMin: z.coerce.number().optional(),
  saltMax: z.coerce.number().optional(),
  sortBy: z.enum(['name', 'nutriScore', 'sugar', 'fat', 'protein', 'salt']).optional().default('name'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
  search: z.string().optional(),
  madeInLatvia: z.string().optional().transform(val => val === 'true'),
  store: z.enum(['rimi', 'maxima']).optional()
});

function classifyImageUrl(url: string | null | undefined): 'cloudinary' | 'barbora' | 'none' {
  if (!url) return 'none';
  if (url.includes('cloudinary.com')) return 'cloudinary';
  if (url.includes('barbora.lv')) return 'barbora';
  return 'none';
}

function buildLcpPreloadUrls(rawUrl: string, type: 'cloudinary' | 'barbora'): { src: string; srcset: string } {
  if (type === 'cloudinary') {
    const base = rawUrl
      .replace(/dpr_auto,/g, '')
      .replace(/,dpr_auto/g, '')
      .replace(/\bq_auto:low\b/g, 'q_auto');
    const makeSrc = (w: number) => base.replace(/\bw_auto\b/g, `w_${w}`).replace(/\bw_\d+\b/g, `w_${w}`);
    return {
      src: makeSrc(900),
      srcset: [300, 600, 900].map(w => `${makeSrc(w)} ${w}w`).join(', '),
    };
  }
  const proxyBase = `/api/image-proxy?url=${encodeURIComponent(rawUrl)}`;
  return {
    src: `${proxyBase}&w=900`,
    srcset: [300, 600, 900].map(w => `${proxyBase}&w=${w} ${w}w`).join(', '),
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Image proxy — converts external Barbora CDN images to WebP with resizing and server-side caching
  app.get("/api/image-proxy", handleImageProxy);

  // LCP diagnostic — reports which image URL pattern a product page would use and confirms
  // that the Task #12 server-side preload/img injection is in place.
  // Usage:
  //   GET /api/lcp-diagnostic?productId=12345            — single product report
  //   GET /api/lcp-diagnostic?productId=12345&store=maxima
  //   GET /api/lcp-diagnostic?sample=20                  — top-N by Nutri-Score per store (default 10, max 50)
  app.get("/api/lcp-diagnostic", async (req: Request, res: Response) => {
    try {
      const sampleParam = req.query.sample;
      if (sampleParam !== undefined) {
        // Sample mode: fetch up to N products per store (sorted by Nutri-Score asc) and return
        // image URL type distribution. Use ?productId=X for per-product LCP detail.
        const perStore = Math.min(50, Math.max(1, parseInt(String(sampleParam), 10) || 10));
        const [rimiResult, maximaResult] = await Promise.allSettled([
          storage.getProducts({ page: 1, pageSize: perStore, store: 'rimi', sortBy: 'nutriScore', sortOrder: 'asc' }),
          storage.getProducts({ page: 1, pageSize: perStore, store: 'maxima', sortBy: 'nutriScore', sortOrder: 'asc' }),
        ]);

        const counts = { cloudinary: 0, barbora: 0, none: 0 };
        const exampleProducts: any[] = [];

        for (const result of [rimiResult, maximaResult]) {
          if (result.status !== 'fulfilled') continue;
          for (const p of result.value.products) {
            const photoUrl = (p.photos?.find((ph: any) => ph.isPrimary) || p.photos?.[0])?.photoUrl || null;
            const type = classifyImageUrl(photoUrl);
            counts[type]++;
            if (exampleProducts.filter(e => e.imageType === type).length < 2) {
              exampleProducts.push({
                productId: p.productId,
                name: p.name,
                store: p.store,
                imageType: type,
                diagnosticUrl: `/api/lcp-diagnostic?productId=${p.productId}${p.store === 'maxima' ? '&store=maxima' : ''}`,
              });
            }
          }
        }

        const total = counts.cloudinary + counts.barbora + counts.none;
        return res.json({
          requestedPerStore: perStore,
          actualProductsChecked: total,
          note: 'Products are the top-N by Nutri-Score A→E from each store. Use ?productId=X for per-URL LCP detail.',
          distribution: {
            cloudinary: { count: counts.cloudinary, pct: total ? Math.round(counts.cloudinary / total * 100) : 0, note: 'Rimi products — direct Cloudinary CDN with srcset' },
            barbora: { count: counts.barbora, pct: total ? Math.round(counts.barbora / total * 100) : 0, note: 'Maxima products — routed through /api/image-proxy (WebP, resized)' },
            none: { count: counts.none, pct: total ? Math.round(counts.none / total * 100) : 0, note: 'No photo; text element becomes LCP candidate' },
          },
          exampleProducts,
        });
      }

      // Single-product mode
      const productIdParam = req.query.productId;
      if (!productIdParam) {
        return res.status(400).json({ error: 'Provide ?productId=X or ?sample=N' });
      }
      const productId = parseInt(String(productIdParam), 10);
      if (isNaN(productId)) {
        return res.status(400).json({ error: 'productId must be a number' });
      }
      const storeParam = req.query.store as Store | undefined;
      const product = await storage.getProductById(productId, storeParam);
      if (!product) {
        return res.status(404).json({ error: `Product ${productId} not found` });
      }

      const photoUrl = (product.photos?.find((p: any) => p.isPrimary) || product.photos?.[0])?.photoUrl || null;
      const imageType = classifyImageUrl(photoUrl);
      const preloadUrls = imageType !== 'none' ? buildLcpPreloadUrls(photoUrl!, imageType) : null;

      return res.json({
        productId: product.productId,
        name: product.name,
        store: product.store || 'rimi',
        slug: product.slug,
        productPageUrl: `https://abcde.lv/lv/product/${product.slug || product.productId}`,
        imageType,
        photoUrl,
        preload: preloadUrls
          ? { src: preloadUrls.src, srcset: preloadUrls.srcset }
          : null,
        lcpOptimizations: {
          serverSideImgInjected: imageType !== 'none',
          preloadTagInjected: imageType !== 'none',
          productDataScriptInjected: true,
          note: imageType === 'none'
            ? 'No product photo — no LCP image to preload; text content becomes LCP element'
            : imageType === 'barbora'
            ? 'Barbora image routed through /api/image-proxy (WebP, resized). Ensure proxy cache is warm.'
            : 'Cloudinary image served directly with responsive srcset.',
        },
        nutriScoreGrade: product.nutrition?.nutriScoreGrade || null,
      });
    } catch (err: any) {
      console.error('[lcp-diagnostic] error:', err?.message || err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Robots.txt for SEO - block ?store= query parameters to avoid duplicate content
  app.get("/robots.txt", (_req: Request, res: Response) => {
    const robotsTxt = `User-agent: *
Allow: /

# Block English locale — Latvian (LV) is the canonical language for this site
Disallow: /en/

# Block query parameter variations to avoid duplicate content
# These create duplicate pages with different filters/pagination
Disallow: /*?store
Disallow: /*&store
Disallow: /*?page=
Disallow: /*&page=
Disallow: /*?nutriScores=
Disallow: /*&nutriScores=
Disallow: /*?sortBy=
Disallow: /*&sortBy=
Disallow: /*?sortOrder=
Disallow: /*&sortOrder=
Disallow: /*?madeInLatvia=
Disallow: /*&madeInLatvia=
Disallow: /*?sugarMin=
Disallow: /*&sugarMin=
Disallow: /*?sugarMax=
Disallow: /*&sugarMax=
Disallow: /*?fatMin=
Disallow: /*&fatMin=
Disallow: /*?fatMax=
Disallow: /*&fatMax=
Disallow: /*?proteinMin=
Disallow: /*&proteinMin=
Disallow: /*?proteinMax=
Disallow: /*&proteinMax=
Disallow: /*?saltMin=
Disallow: /*&saltMin=
Disallow: /*?saltMax=
Disallow: /*&saltMax=
Disallow: /*?search=
Disallow: /*&search=
Disallow: /*?pageSize=
Disallow: /*&pageSize=

# Sitemap location
Sitemap: https://abcde.lv/sitemap.xml
`;
    res.header('Content-Type', 'text/plain');
    res.send(robotsTxt);
  });

  // API routes - all prefixed with /api
  // Note: Non-language-prefixed SPA path redirects are handled in server/index.ts
  // as a catch-all middleware before Vite serves HTML

  // Debug route to check database connectivity
  app.get("/api/debug/db-status", async (_req: Request, res: Response) => {
    try {
      let categoriesConnected = false;
      let productsConnected = false;
      let categoriesCount = 0;
      let productsCount = 0;
      let errors = [];
      let testCategoryData = null;
      let testProductData = null;

      try {
        // Check categories database
        const categoriesResult = await rimiDb.execute(sql`SELECT 1 as check`);
        categoriesConnected = !!categoriesResult;
        
        // Get categories count if connected
        const categoriesCountResult = await rimiDb.execute(sql`SELECT COUNT(*) as count FROM normalized_categories`);
        categoriesCount = categoriesCountResult && 
          typeof categoriesCountResult === 'object' && 
          Array.isArray(categoriesCountResult) && 
          categoriesCountResult.length > 0 ? 
            Number(categoriesCountResult[0].count) : 0;
            
        // Get first category for testing
        if (categoriesCount > 0) {
          const firstCategoryResult = await rimiDb.execute(sql`
            SELECT * FROM normalized_categories 
            ORDER BY category_id ASC 
            LIMIT 1
          `);
          testCategoryData = firstCategoryResult && Array.isArray(firstCategoryResult) && firstCategoryResult.length > 0 ? 
            firstCategoryResult[0] : null;
        }
      } catch (err) {
        console.error("Categories DB error:", err);
        errors.push({
          type: "categories",
          message: err instanceof Error ? err.message : String(err)
        });
      }

      try {
        // Check products database
        const productsResult = await rimiDb.execute(sql`SELECT 1 as check`);
        productsConnected = !!productsResult;
        
        // Get products count if connected
        const productsCountResult = await rimiDb.execute(sql`SELECT COUNT(*) as count FROM products`);
        productsCount = productsCountResult && 
          typeof productsCountResult === 'object' && 
          Array.isArray(productsCountResult) && 
          productsCountResult.length > 0 ? 
            Number(productsCountResult[0].count) : 0;
            
        // Get first product for testing
        if (productsCount > 0) {
          const firstProductResult = await rimiDb.execute(sql`
            SELECT * FROM products 
            ORDER BY product_id ASC 
            LIMIT 1
          `);
          testProductData = firstProductResult && Array.isArray(firstProductResult) && firstProductResult.length > 0 ? 
            firstProductResult[0] : null;
        }
      } catch (err) {
        console.error("Products DB error:", err);
        errors.push({
          type: "products",
          message: err instanceof Error ? err.message : String(err)
        });
      }

      res.json({
        status: errors.length > 0 ? "error" : (categoriesCount > 0 && productsCount > 0 ? "ok" : "warning"),
        connections: {
          categories: categoriesConnected,
          products: productsConnected
        },
        counts: {
          categories: categoriesCount,
          products: productsCount
        },
        env: {
          categoriesUrl: !!process.env.CATEGORIES_DB_URL,
          productsUrl: !!process.env.PRODUCTS_DB_URL
        },
        // Add test data for debugging
        testData: {
          category: testCategoryData,
          product: testProductData
        },
        errors: errors.length > 0 ? errors : undefined,
        message: errors.length > 0 
          ? "Database connection errors occurred" 
          : (categoriesCount === 0 || productsCount === 0 
              ? "One or more databases appear to be empty" 
              : "Database connections successful")
      });
    } catch (error) {
      console.error("Error checking database status:", error);
      res.status(500).json({ 
        status: "error", 
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  });
  
  // Category routes
  app.get("/api/categories", async (req: Request, res: Response) => {
    try {
      const { level, parentId } = getCategoriesQuerySchema.parse(req.query);
      
      if (parentId) {
        const categories = await storage.getSubcategories(parentId);
        res.set('Cache-Control', 'public, max-age=1800, stale-while-revalidate=300');
        return res.json(categories);
      }
      
      const categories = await storage.getCategories(level);
      res.set('Cache-Control', 'public, max-age=1800, stale-while-revalidate=300');
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });
  
  app.get("/api/categories/:id", async (req: Request, res: Response) => {
    try {
      const categoryId = extractIdFromSlug(req.params.id);
      
      if (!categoryId) {
        return res.status(400).json({ message: "Invalid category ID" });
      }
      
      const category = await storage.getCategoryById(categoryId);
      
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      
      res.json(category);
    } catch (error) {
      console.error("Error fetching category:", error);
      res.status(500).json({ message: "Failed to fetch category" });
    }
  });
  
  app.get("/api/categories/:id/path", async (req: Request, res: Response) => {
    try {
      const categoryId = extractIdFromSlug(req.params.id);
      
      if (!categoryId) {
        return res.status(400).json({ message: "Invalid category ID" });
      }
      
      const categoryPath = await storage.getCategoryPath(categoryId);
      
      if (!categoryPath.length) {
        return res.status(404).json({ message: "Category path not found" });
      }
      
      res.json(categoryPath);
    } catch (error) {
      console.error("Error fetching category path:", error);
      res.status(500).json({ message: "Failed to fetch category path" });
    }
  });

  // Check if healthier products exist in a category
  app.get("/api/categories/:id/has-healthier-products", async (req: Request, res: Response) => {
    try {
      const categoryId = extractIdFromSlug(req.params.id);
      const currentGrade = req.query.currentGrade as string;
      const store = req.query.store as string | undefined;
      
      // Excluded category IDs (Gatavots Rimi and its subcategory)
      const excludedCategoryIds = [5, 40];
      
      if (!categoryId) {
        return res.status(400).json({ message: "Invalid category ID" });
      }
      
      // Return 0 for excluded categories
      if (excludedCategoryIds.includes(categoryId)) {
        return res.json({ hasHealthierProducts: false, betterGrades: [], count: 0 });
      }
      
      if (!currentGrade || !['C', 'D', 'E'].includes(currentGrade)) {
        return res.status(400).json({ message: "Invalid current grade. Must be C, D, or E." });
      }
      
      // Validate store parameter if provided
      if (store && !['rimi', 'maxima'].includes(store)) {
        return res.status(400).json({ message: "Invalid store. Must be 'rimi' or 'maxima'." });
      }
      
      // Determine which grades are better
      let betterGrades: string[] = [];
      if (currentGrade === 'C') betterGrades = ['A', 'B'];
      else if (currentGrade === 'D') betterGrades = ['A', 'B', 'C'];
      else if (currentGrade === 'E') betterGrades = ['A', 'B', 'C', 'D'];
      
      // Build category list including subcategories (same logic as products API)
      let allCategoriesToInclude: number[] = [categoryId];
      
      // Get the current category to check its level
      const categoryResult = await rimiDb.execute(sql`
        SELECT level FROM normalized_categories WHERE category_id = ${categoryId}
      `);
      
      if (categoryResult && Array.isArray(categoryResult) && categoryResult.length > 0) {
        const level = Number(categoryResult[0].level);
        
        // If level 1 or 2, include subcategories
        if (level < 3) {
          const subcatsResult = await rimiDb.execute(sql`
            SELECT category_id FROM normalized_categories WHERE parent_category_id = ${categoryId}
          `);
          
          if (subcatsResult && Array.isArray(subcatsResult)) {
            const subcatIds = subcatsResult.map((r: any) => Number(r.category_id));
            allCategoriesToInclude.push(...subcatIds);
            
            // If level 1, go one level deeper
            if (level === 1 && subcatIds.length > 0) {
              const subsubcatsResult = await rimiDb.execute(sql`
                SELECT category_id FROM normalized_categories 
                WHERE parent_category_id IN (${sql.join(subcatIds.map(id => sql`${id}`), sql`, `)})
              `);
              
              if (subsubcatsResult && Array.isArray(subsubcatsResult)) {
                allCategoriesToInclude.push(...subsubcatsResult.map((r: any) => Number(r.category_id)));
              }
            }
          }
        }
      }
      
      let rimiCount = 0;
      let maximaCount = 0;
      
      // Check Rimi products only if no store filter or store is 'rimi'
      if (!store || store === 'rimi') {
        const rimiResult = await rimiDb.execute(sql`
          SELECT COUNT(*) as count FROM products p
          JOIN nutritionfacts nf ON p.product_id = nf.product_id
          WHERE p.category_id IN (${sql.join(allCategoriesToInclude.map(id => sql`${id}`), sql`, `)})
          AND nf.nutri_score_grade IN (${sql.join(betterGrades.map(g => sql`${g}`), sql`, `)})
        `);
        
        // Handle Neon result which has rows property
        const rimiRows = rimiResult && typeof rimiResult === 'object' && 'rows' in rimiResult 
          ? (rimiResult as any).rows 
          : (Array.isArray(rimiResult) ? rimiResult : []);
        rimiCount = rimiRows.length > 0 ? Number(rimiRows[0].count) : 0;
      }
      
      // Check Maxima products only if no store filter or store is 'maxima'
      if (!store || store === 'maxima') {
        try {
          if (maximaDb) {
            const maximaResult = await maximaDb.execute(sql`
              SELECT COUNT(*) as count FROM products p
              JOIN nutritionfacts nf ON p.product_id = nf.product_id
              WHERE p.rimi_category_code IN (${sql.join(allCategoriesToInclude.map(id => sql`${id}`), sql`, `)})
              AND nf.nutri_score_grade IN (${sql.join(betterGrades.map(g => sql`${g}`), sql`, `)})
            `);
            // Handle Neon result which has rows property
            const maximaRows = maximaResult && typeof maximaResult === 'object' && 'rows' in maximaResult 
              ? (maximaResult as any).rows 
              : (Array.isArray(maximaResult) ? maximaResult : []);
            maximaCount = maximaRows.length > 0 ? Number(maximaRows[0].count) : 0;
          }
        } catch (err) {
          // Maxima DB might not be available, that's ok
          console.log("Maxima DB check failed:", err);
        }
      }
      
      const hasHealthierProducts = (rimiCount + maximaCount) > 0;
      
      res.json({ 
        hasHealthierProducts,
        betterGrades,
        count: rimiCount + maximaCount
      });
    } catch (error) {
      console.error("Error checking for healthier products:", error);
      res.status(500).json({ message: "Failed to check for healthier products" });
    }
  });
  
  // Product routes
  app.get("/api/products", async (req: Request, res: Response) => {
    try {
      const { 
        search, 
        categoryId, 
        page, 
        pageSize, 
        nutriScores, 
        sugarMin, 
        sugarMax, 
        fatMin, 
        fatMax, 
        proteinMin, 
        proteinMax,
        saltMin,
        saltMax,
        sortBy,
        sortOrder,
        store,
        madeInLatvia
      } = getProductsQuerySchema.parse(req.query);
      
      // Cast nutriScores to the correct type (A, B, C, D, E)
      const validGrades = ['A', 'B', 'C', 'D', 'E'];
      const validatedNutriScores = nutriScores?.filter(grade => 
          validGrades.includes(grade.toUpperCase())
        ).map(grade => grade.toUpperCase() as any);
      
      const options = {
        categoryId,
        page,
        pageSize,
        nutriScores: validatedNutriScores,
        sugarMin,
        sugarMax,
        fatMin,
        fatMax,
        proteinMin,
        proteinMax,
        saltMin,
        saltMax,
        sortBy,
        sortOrder,
        store,
        madeInLatvia
      };
      
      // If search query is provided, use search endpoint
      if (search) {
        const result = await storage.searchProducts(search, options);
        console.log(`Search query "${search}" returned ${result.products.length} products, total: ${result.totalCount}`);
        return res.json(result);
      }
      
      const result = await storage.getProducts(options);
      console.log(`GET products with options ${JSON.stringify({
        categoryId, page, pageSize, 
        filters: {
          nutriScores: nutriScores?.length ? nutriScores : 'none',
          nutrients: {sugarMin, sugarMax, fatMin, fatMax, proteinMin, proteinMax, saltMin, saltMax}
        },
        sort: {sortBy, sortOrder}
      })} returned ${result.products.length} products, total: ${result.totalCount}`);
      res.set('Cache-Control', 'public, max-age=180, stale-while-revalidate=60');
      res.json(result);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });
  
  app.get("/api/products/:id", async (req: Request, res: Response) => {
    try {
      const urlSlug = req.params.id;
      const productId = extractIdFromSlug(urlSlug);
      const store = req.query.store as 'rimi' | 'maxima' | undefined;
      
      if (!productId) {
        return res.status(400).json({ message: "Invalid product ID" });
      }
      
      let product = await storage.getProductById(productId, store);

      // Rimi and Maxima can share the same numeric product ID (different products).
      // When no store hint is given, apply slug-based disambiguation: if the returned
      // product's slug doesn't match the URL slug, the lookup found the wrong store's
      // product — try Maxima explicitly. Mirrors the same logic in the SSR middleware.
      if (!store && product && productSlug(product.name, product.productId) !== urlSlug) {
        const maximaProduct = await storage.getProductById(productId, 'maxima');
        if (maximaProduct && productSlug(maximaProduct.name, maximaProduct.productId) === urlSlug) {
          product = maximaProduct;
        }
      }
      
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      res.json(product);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });
  
  app.get("/api/products/sku/:sku", async (req: Request, res: Response) => {
    try {
      const { sku } = req.params;
      
      if (!sku) {
        return res.status(400).json({ message: "Invalid product SKU" });
      }
      
      const product = await storage.getProductBySku(sku);
      
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      res.json(product);
    } catch (error) {
      console.error("Error fetching product by SKU:", error);
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });
  
  // Get product by Rimi URL
  app.get("/api/products/url/:url", async (req: Request, res: Response) => {
    try {
      const { url } = req.params;
      
      if (!url) {
        return res.status(400).json({ message: "Invalid product URL" });
      }
      
      // URL may need decoding as it could contain slashes and other special characters
      const decodedUrl = decodeURIComponent(url);
      
      const product = await storage.getProductByRimiUrl(decodedUrl);
      
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      res.json(product);
    } catch (error) {
      console.error("Error fetching product by URL:", error);
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  // Helper function to merge adjacent OCR segments into meaningful patterns
  // e.g., "35" + "%" → "35%", "200" + "g" → "200g", "UHT" stays as is
  const mergeAdjacentSegments = (segments: string[]): string[] => {
    // First, trim all segments to handle OCR whitespace artifacts
    const trimmedSegments = segments.map(s => s.trim()).filter(s => s.length > 0);
    
    const merged: string[] = [];
    let i = 0;
    
    while (i < trimmedSegments.length) {
      const current = trimmedSegments[i];
      const next = trimmedSegments[i + 1];
      const nextTrimmed = next ? next.trim() : '';
      
      // Pattern: number + "%" → percentage (e.g., "35" + "%" → "35%")
      if (nextTrimmed === '%' && /^\d+(\.\d+)?$/.test(current)) {
        merged.push(current + '%');
        i += 2;
        continue;
      }
      
      // Pattern: number + unit → quantity (e.g., "200" + "g" → "200g", "200" + "ml" → "200ml")
      if (nextTrimmed && /^(g|kg|ml|l|gr)$/i.test(nextTrimmed) && /^\d+(\.\d+)?$/.test(current)) {
        merged.push(current + nextTrimmed.toLowerCase());
        i += 2;
        continue;
      }
      
      // Keep the current segment as-is
      merged.push(current);
      i++;
    }
    
    return merged;
  };
  
  // Check if a segment is a percentage value (critical for product differentiation)
  const isPercentageValue = (segment: string): boolean => {
    return /^\d+(\.\d+)?%$/.test(segment.trim());
  };
  
  // Check if a segment is a quantity value (useful for matching)
  const isQuantityValue = (segment: string): boolean => {
    return /^\d+(\.\d+)?(g|kg|ml|l|gr)$/i.test(segment.trim());
  };
  
  // Helper function to normalize and filter text segments
  // Now preserves percentages and quantities even if short
  const normalizeTextSegments = (segments: string[]): string[] => {
    // First merge adjacent segments to form patterns like "35%"
    const mergedSegments = mergeAdjacentSegments(segments);
    
    return mergedSegments
      .map(segment => normalizeLvText(segment.trim()))
      .filter(segment => {
        // Always keep percentage values (critical for product differentiation)
        if (isPercentageValue(segment)) return true;
        // Always keep quantity values
        if (isQuantityValue(segment)) return true;
        // Keep short but common product identifiers (UHT, BIO, etc.)
        if (/^(uht|bio|eko)$/i.test(segment)) return true;
        // Filter out segments shorter than 4 characters (noise like "ES", "RTI", etc.)
        return segment.length > 3;
      });
  };
  
  // Extract and normalize percentage from a product name (e.g., "10%" from "Saldais krējums 10% UHT")
  // Returns lowercase normalized percentage for consistent comparison
  const extractPercentage = (text: string): string | null => {
    const match = text.match(/(\d+(?:\.\d+)?)\s*%/);
    return match ? match[1] + '%' : null;
  };

  // Helper function to find matching product using two-pass token matching
  const findMatchingProduct = async (textSegments: string[]): Promise<any | null> => {
    if (!textSegments || textSegments.length === 0) {
      console.log('No text segments provided for matching');
      return null;
    }

    const normalizedSegments = normalizeTextSegments(textSegments);
    
    if (normalizedSegments.length === 0) {
      console.log('No segments long enough for matching after filtering');
      return null;
    }

    console.log(`Normalized segments for matching: ${normalizedSegments.join(', ')}`);
    
    // Extract percentage from OCR segments for strict matching
    const ocrPercentage = normalizedSegments.find(s => isPercentageValue(s));
    if (ocrPercentage) {
      console.log(`OCR detected percentage: ${ocrPercentage}`);
    }

    // PASS 1: Find potential matches using SQL - products containing any of the segments
    const potentialMatches: any[] = [];
    
    // Prioritize searching with percentage if available
    const searchSegments = ocrPercentage 
      ? [ocrPercentage, ...normalizedSegments.filter(s => s !== ocrPercentage)]
      : normalizedSegments;
    
    for (const segment of searchSegments) {
      // Skip searching with just percentage as it won't find products
      if (segment === ocrPercentage) continue;
      
      try {
        const searchResults = await storage.searchProducts(segment, {
          page: 1,
          pageSize: 50 // Get more results for better matching
        });
        
        for (const product of searchResults.products) {
          // Avoid duplicates
          if (!potentialMatches.find(m => m.productId === product.productId && m.store === product.store)) {
            potentialMatches.push(product);
          }
        }
      } catch (err) {
        console.error(`Error searching for segment "${segment}":`, err);
      }
    }

    if (potentialMatches.length === 0) {
      console.log('No potential matches found in Pass 1');
      return null;
    }

    console.log(`Pass 1 found ${potentialMatches.length} potential matches`);

    // PASS 2: Token-based verification with confidence scoring
    // Now includes percentage matching for accurate differentiation
    const confirmedMatches: Array<{
      product: any;
      matchConfidence: number;
      tokenCount: number;
      percentageMatch: boolean;
    }> = [];

    for (const product of potentialMatches) {
      const normalizedProductName = normalizeLvText(product.name);
      const tokens = normalizedProductName.split(/\s+/);
      
      // Extract percentage from product name (already normalized to lowercase like "35%")
      const productPercentage = extractPercentage(product.name);
      
      // Check percentage match - CRITICAL for differentiating variants
      let percentageMatch = true; // Default to true if no percentage in OCR
      if (ocrPercentage) {
        // OCR detected a percentage value
        if (productPercentage) {
          // Both OCR and product have percentages - they must match
          percentageMatch = ocrPercentage === productPercentage;
          if (!percentageMatch) {
            console.log(`Percentage mismatch: OCR "${ocrPercentage}" vs Product "${productPercentage}" (${product.name})`);
          }
        } else {
          // OCR has percentage but product doesn't - demote this product
          percentageMatch = false;
          console.log(`Product missing percentage: OCR "${ocrPercentage}" but product has none (${product.name})`);
        }
      }
      
      // Include ALL tokens for matching, including short ones like percentage and UHT
      const tokensToMatch = tokens;

      // Calculate how many tokens are found in the text segments
      let matchingTokenCount = 0;
      
      for (const token of tokensToMatch) {
        const tokenFound = normalizedSegments.some((segment: string) => 
          segment.includes(token) || token.includes(segment)
        );
        if (tokenFound) {
          matchingTokenCount++;
        }
      }

      // Calculate match confidence
      const matchConfidence = tokensToMatch.length > 0 
        ? matchingTokenCount / tokensToMatch.length 
        : 0;

      // Add to confirmed matches if confidence >= 60%
      if (matchConfidence >= 0.6) {
        confirmedMatches.push({
          product,
          matchConfidence,
          tokenCount: tokens.length,
          percentageMatch
        });
      }
    }

    if (confirmedMatches.length === 0) {
      console.log('No confirmed matches found in Pass 2');
      return null;
    }

    // Sort by: 1) percentage match (exact match first), 2) confidence, 3) token count
    confirmedMatches.sort((a, b) => {
      // Percentage match takes priority
      if (a.percentageMatch !== b.percentageMatch) {
        return a.percentageMatch ? -1 : 1;
      }
      // Then by confidence
      if (b.matchConfidence !== a.matchConfidence) {
        return b.matchConfidence - a.matchConfidence;
      }
      // Then by token count for specificity
      return b.tokenCount - a.tokenCount;
    });

    const bestMatch = confirmedMatches[0];
    console.log(`Best match: ${bestMatch.product.name} with confidence ${bestMatch.matchConfidence.toFixed(2)}, percentage match: ${bestMatch.percentageMatch}`);

    return bestMatch.product;
  };

  // Scan product endpoint - accepts base64 image
  const scanRequestSchema = z.object({
    image: z.string().min(1, "Image data is required")
  });

  app.post("/api/scan", async (req: Request, res: Response) => {
    try {
      const result = scanRequestSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ 
          success: false,
          message: "Invalid request data",
          errors: result.error.errors
        });
      }

      const { image } = result.data;
      console.log(`Received image for scanning, size: ${image.length} bytes`);
      
      // Decode and log image dimensions for debugging
      try {
        const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Read basic JPEG dimensions (very simple parser for width/height)
        if (buffer[0] === 0xFF && buffer[1] === 0xD8) { // JPEG magic number
          let offset = 2;
          while (offset < buffer.length) {
            if (buffer[offset] === 0xFF && (buffer[offset + 1] === 0xC0 || buffer[offset + 1] === 0xC2)) {
              const height = (buffer[offset + 5] << 8) | buffer[offset + 6];
              const width = (buffer[offset + 7] << 8) | buffer[offset + 8];
              console.log(`📷 Image dimensions: ${width}x${height} (aspect ratio: ${(width/height).toFixed(2)})`);
              break;
            }
            offset++;
          }
        }
      } catch (e) {
        console.log('Could not parse image dimensions');
      }
      
      // Photo data is stored directly in the database (no Object Storage dependency)
      
      // Cleanup old scans (30+ days) asynchronously
      storage.cleanupOldScans(30).catch(err => {
        console.error("Error cleaning up old scans:", err);
      });

      // Get API key from environment
      const apiKey = process.env.GOOGLE_CLOUD_API_KEY;
      if (!apiKey) {
        console.error("GOOGLE_CLOUD_API_KEY not configured");
        return res.status(500).json({
          success: false,
          message: "OCR service not configured"
        });
      }

      // Strip data URL prefix if present (data:image/jpeg;base64,)
      const base64Image = image.replace(/^data:image\/[a-z]+;base64,/, '');

      // Call Google Cloud Vision API
      const visionApiUrl = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;
      
      const visionResponse = await fetch(visionApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              image: {
                content: base64Image
              },
              features: [
                {
                  type: 'TEXT_DETECTION'
                }
              ]
            }
          ]
        })
      });

      if (!visionResponse.ok) {
        const errorText = await visionResponse.text();
        console.error(`Vision API error: ${visionResponse.status} - ${errorText}`);
        return res.status(500).json({
          success: false,
          message: "OCR processing failed"
        });
      }

      const visionData = await visionResponse.json();
      
      // Check for Vision API errors in the response
      const response = visionData.responses?.[0];
      if (response?.error) {
        console.error(`Vision API error in response: ${JSON.stringify(response.error)}`);
        return res.status(400).json({
          success: false,
          message: `OCR failed: ${response.error.message || 'Unknown error'}`
        });
      }
      
      // Extract text from response
      const textAnnotations = response?.textAnnotations;
      
      if (!textAnnotations || textAnnotations.length === 0) {
        return res.json({
          success: false,
          text: '',
          message: "No text detected in image. Please try again with a clearer photo."
        });
      }

      // Extract individual text segments (skip first element which is the full text)
      const textSegments: string[] = textAnnotations.slice(1).map((annotation: any) => annotation.description || '');
      
      console.log(`OCR detected ${textSegments.length} text segments:`, textSegments);

      // Find matching product using two-pass token matching
      const matchedProduct = await findMatchingProduct(textSegments);

      // Get the full text for display purposes
      const fullText = textAnnotations[0]?.description || textSegments.join(' ');
      
      // Save scan metadata to database (always save, even if photo wasn't stored)
      let createdScan;
      try {
        createdScan = await storage.createScan({
          photoData: image,
          ocrText: fullText,
          productId: matchedProduct?.productId || null,
          matchConfidence: matchedProduct ? "85.00" : null,
          success: !!matchedProduct,
          language: req.headers['accept-language']?.split(',')[0]?.substring(0, 2) || 'unknown'
        });
        console.log(`Scan saved. Product: ${matchedProduct ? matchedProduct.name : 'none'}, Token: ${createdScan.photoAccessToken}`);
      } catch (dbError) {
        console.error("Failed to save scan metadata:", dbError);
        // Continue even if DB save fails
      }

      res.json({
        success: true,
        text: fullText,
        message: matchedProduct 
          ? `Product found: ${matchedProduct.name}`
          : "Text extracted successfully. No matching product found.",
        photoAccessToken: createdScan?.photoAccessToken || null,
        product: matchedProduct ? {
          productId: matchedProduct.productId,
          slug: productSlug(matchedProduct.name, matchedProduct.productId),
          name: matchedProduct.name,
          sku: matchedProduct.sku,
          rimiUrl: matchedProduct.rimiUrl,
          nutriScoreGrade: matchedProduct.nutrition?.nutriScoreGrade || null,
          store: matchedProduct.store || 'rimi',
          externalUrl: matchedProduct.externalUrl || matchedProduct.rimiUrl
        } : null
      });
    } catch (error) {
      console.error("Error processing scan:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to process image" 
      });
    }
  });

  // Mobile API: Match products from raw OCR text (no image upload needed)
  const mobileMatchTextSchema = z.object({
    textSegments: z.array(z.string()).min(1, "At least one text segment is required"),
    language: z.string().optional().default('lv'),
  });

  app.post("/api/mobile/match-text", async (req: Request, res: Response) => {
    try {
      const result = mobileMatchTextSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ 
          success: false,
          message: "Invalid request data",
          errors: result.error.errors
        });
      }

      const { textSegments, language } = result.data;
      console.log(`Mobile match-text: received ${textSegments.length} segments`);

      const matchedProduct = await findMatchingProduct(textSegments);

      if (!matchedProduct) {
        return res.json({
          success: false,
          message: "No matching product found",
          product: null
        });
      }

      const productDetails = await storage.getProductById(matchedProduct.productId, matchedProduct.store);

      if (!productDetails) {
        return res.json({
          success: false,
          message: "Product details not found",
          product: null
        });
      }

      const isLv = language === 'lv';

      res.json({
        success: true,
        message: `Product found: ${productDetails.name}`,
        product: {
          productId: productDetails.productId,
          name: productDetails.name,
          sku: productDetails.sku,
          store: productDetails.store || 'rimi',
          externalUrl: productDetails.externalUrl,
          quantityValue: productDetails.quantityValue,
          quantityUnit: productDetails.quantityUnit,
          categoryName: isLv ? productDetails.category?.nameLv : productDetails.category?.nameEn,
          nutriScoreGrade: productDetails.nutrition?.nutriScoreGrade || null,
          energyKcal: productDetails.nutrition?.energyKcal || null,
          energyKj: productDetails.nutrition?.energyKj || null,
          fatTotal: productDetails.nutrition?.fatTotal || null,
          fatSaturated: productDetails.nutrition?.fatSaturated || null,
          carbsTotal: productDetails.nutrition?.carbsTotal || null,
          carbsSugars: productDetails.nutrition?.carbsSugars || null,
          protein: productDetails.nutrition?.protein || null,
          salt: productDetails.nutrition?.salt || null,
          fiber: productDetails.nutrition?.fiber || null,
          photoUrl: productDetails.photos?.[0]?.photoUrl || null,
          ingredientsText: productDetails.nutrition?.ingredientsText || null,
          ingredientCard: productDetails.ingredientCard ? {
            naturalCount: productDetails.ingredientCard.naturalCount,
            processedCount: productDetails.ingredientCard.processedCount,
            avoidCount: productDetails.ingredientCard.avoidCount,
            limitCount: productDetails.ingredientCard.limitCount,
            cautionCount: productDetails.ingredientCard.cautionCount,
          } : null,
        }
      });
    } catch (error) {
      console.error("Error processing mobile match-text:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to match product from text" 
      });
    }
  });

  // Mobile API: Get product details by store and product ID
  app.get("/api/mobile/product/:store/:id", async (req: Request, res: Response) => {
    try {
      const { store, id } = req.params;

      if (store !== 'rimi' && store !== 'maxima') {
        return res.status(400).json({
          success: false,
          message: "Invalid store. Must be 'rimi' or 'maxima'."
        });
      }

      const productId = parseInt(id, 10);
      if (isNaN(productId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid product ID."
        });
      }

      const product = await storage.getProductById(productId, store);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found."
        });
      }

      res.json({
        success: true,
        product: {
          productId: product.productId,
          name: product.name,
          quantityValue: product.quantityValue,
          quantityUnit: product.quantityUnit,
          categoryName: product.category?.nameLv || null,
          photoUrl: product.photos?.[0]?.photoUrl || null,
          ingredientsText: product.nutrition?.ingredientsText || null,
          energyKj: product.nutrition?.energyKj || null,
          energyKcal: product.nutrition?.energyKcal || null,
          fatTotal: product.nutrition?.fatTotal || null,
          fatSaturated: product.nutrition?.fatSaturated || null,
          carbsTotal: product.nutrition?.carbsTotal || null,
          carbsSugars: product.nutrition?.carbsSugars || null,
          fiber: product.nutrition?.fiber || null,
          protein: product.nutrition?.protein || null,
          salt: product.nutrition?.salt || null,
        }
      });
    } catch (error) {
      console.error("Error fetching mobile product:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch product details."
      });
    }
  });

  // Nutri-Score distribution stats with weekly caching
  let nutriScoreStatsCache: { data: any; timestamp: number } | null = null;
  const STATS_CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

  // Helper function to query Nutri-Score distribution
  async function queryNutriScoreDistribution(countryFilter?: string) {
    const countryCondition = countryFilter ? sql`AND p.country_of_origin = ${countryFilter}` : sql``;
    
    // Query Rimi database
    const rimiStatsResult = await rimiDb.execute(sql`
      SELECT 
        nf.nutri_score_grade as grade,
        COUNT(*) as count
      FROM products p
      JOIN nutritionfacts nf ON p.product_id = nf.product_id
      WHERE nf.nutri_score_grade IS NOT NULL
      AND nf.nutri_score_grade IN ('A', 'B', 'C', 'D', 'E')
      AND p.category_id NOT IN (5, 40)
      ${countryCondition}
      GROUP BY nf.nutri_score_grade
      ORDER BY nf.nutri_score_grade
    `);

    const rimiStats = Array.isArray(rimiStatsResult) ? rimiStatsResult :
      (rimiStatsResult && typeof rimiStatsResult === 'object' && 'rows' in rimiStatsResult) ?
        (rimiStatsResult as any).rows : [];

    // Query Maxima database
    let maximaStats: any[] = [];
    if (maximaDb) {
      const maximaStatsResult = await maximaDb.execute(sql`
        SELECT 
          nf.nutri_score_grade as grade,
          COUNT(*) as count
        FROM products p
        JOIN nutritionfacts nf ON p.product_id = nf.product_id
        WHERE nf.nutri_score_grade IS NOT NULL
        AND nf.nutri_score_grade IN ('A', 'B', 'C', 'D', 'E')
        ${countryCondition}
        GROUP BY nf.nutri_score_grade
        ORDER BY nf.nutri_score_grade
      `);
      maximaStats = Array.isArray(maximaStatsResult) ? maximaStatsResult :
        (maximaStatsResult && typeof maximaStatsResult === 'object' && 'rows' in maximaStatsResult) ?
          (maximaStatsResult as any).rows : [];
    }

    // Combine stats from both stores
    const combinedStats: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };
    
    for (const row of rimiStats) {
      const grade = (row as any).grade?.toUpperCase();
      if (grade && combinedStats.hasOwnProperty(grade)) {
        combinedStats[grade] += Number((row as any).count) || 0;
      }
    }
    
    for (const row of maximaStats) {
      const grade = (row as any).grade?.toUpperCase();
      if (grade && combinedStats.hasOwnProperty(grade)) {
        combinedStats[grade] += Number((row as any).count) || 0;
      }
    }

    const totalProducts = Object.values(combinedStats).reduce((sum, count) => sum + count, 0);

    return {
      distribution: Object.entries(combinedStats).map(([grade, count]) => ({
        grade,
        count,
        percentage: totalProducts > 0 ? Math.round((count / totalProducts) * 1000) / 10 : 0
      })),
      totalProducts
    };
  }

  app.get("/api/stats/nutri-score-distribution", async (_req: Request, res: Response) => {
    try {
      // Check if cache is still valid
      const now = Date.now();
      if (nutriScoreStatsCache && (now - nutriScoreStatsCache.timestamp) < STATS_CACHE_DURATION) {
        return res.json(nutriScoreStatsCache.data);
      }

      // Query all products and Latvian-made products in parallel
      const [allProducts, latvianProducts] = await Promise.all([
        queryNutriScoreDistribution(),
        queryNutriScoreDistribution('Latvija')
      ]);

      const responseData = {
        distribution: allProducts.distribution,
        totalProducts: allProducts.totalProducts,
        latvianProducts: {
          distribution: latvianProducts.distribution,
          totalProducts: latvianProducts.totalProducts
        },
        lastUpdated: new Date().toISOString(),
        cacheExpiresAt: new Date(now + STATS_CACHE_DURATION).toISOString()
      };

      // Cache the result
      nutriScoreStatsCache = { data: responseData, timestamp: now };

      res.json(responseData);
    } catch (error) {
      console.error("Error fetching Nutri-Score stats:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to fetch statistics" 
      });
    }
  });

  // Stream scan photo directly from storage using secure token
  app.get("/api/scan/photo/:token", async (req: Request, res: Response) => {
    try {
      const token = req.params.token;
      
      if (!token || token.length !== 36) {
        return res.status(400).json({
          success: false,
          message: "Invalid photo access token"
        });
      }

      // Get the scan from database by token
      const scan = await storage.getScanByToken(token);
      
      if (!scan) {
        return res.status(404).json({
          success: false,
          message: "Scan not found"
        });
      }

      if (!scan.photoData) {
        return res.status(404).json({
          success: false,
          message: "No photo associated with this scan"
        });
      }

      // Serve photo stored as base64 directly from the database
      const base64Data = scan.photoData.replace(/^data:image\/[a-z]+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      res.set('Content-Type', 'image/jpeg');
      res.set('Cache-Control', 'private, max-age=2592000');
      res.send(buffer);
    } catch (error) {
      console.error("Error serving scan photo:", error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: "Failed to serve photo"
        });
      }
    }
  });

  // ── Category Report: Ice Cream ───────────────────────────────────────────
  // Returns all products from Porcijas saldējumi (145) + Lielo iepakojumu
  // saldējumi (146) with full nutrition, NOVA, photo, and derived ingredient /
  // additive counts. Used by the /lv/raksti/saldejums article page.
  // Designed as a template for future category reports.

  /** Count top-level comma-separated ingredients (ignoring commas inside parens). */
  function countTopLevelIngredients(text: string): number | null {
    if (!text.trim()) return null;
    let depth = 0;
    let count = 1;
    for (const ch of text) {
      if (ch === '(' || ch === '[') depth++;
      else if (ch === ')' || ch === ']') depth--;
      else if (ch === ',' && depth === 0) count++;
    }
    return count;
  }

  app.get("/api/reports/ice-cream", async (_req: Request, res: Response) => {
    try {
      const rimiQuery = rimiDb.execute(sql`
        SELECT
          p.product_id,
          p.sku,
          p.name,
          p.nova_score,
          p.quantity_value,
          p.quantity_unit,
          nf.energy_kcal,
          nf.fat_total,
          nf.fat_saturated,
          nf.carbs_total,
          nf.carbs_sugars,
          nf.protein,
          nf.salt,
          nf.fiber,
          nf.nutri_score_grade,
          nf.nutri_score_points,
          nf.ingredients_text,
          c.name_lv  AS category_name_lv,
          c.name_en  AS category_name_en,
          pp.photo_url
        FROM products p
        JOIN nutritionfacts nf       ON nf.product_id = p.product_id
        JOIN normalized_categories c ON c.category_id = p.category_id
        LEFT JOIN productphotos pp   ON pp.product_id = p.product_id
                                    AND pp.is_primary = true
        WHERE p.category_id IN (145, 146)
          AND p.product_id IN (
            SELECT product_id FROM (
              SELECT DISTINCT ON (product_id) product_id, is_available
              FROM product_price_history
              ORDER BY product_id, recorded_at DESC
            ) latest
            WHERE latest.is_available = true
          )
        ORDER BY p.product_id
      `);

      const maximaQuery = maximaDb ? maximaDb.execute(sql`
        SELECT
          p.product_id,
          p.sku,
          p.name,
          p.nova_score,
          p.quantity_value,
          p.quantity_unit,
          nf.energy_kcal,
          nf.fat_total,
          nf.fat_saturated,
          nf.carbs_total,
          nf.carbs_sugars,
          nf.protein,
          nf.salt,
          nf.fiber,
          nf.nutri_score_grade,
          nf.nutri_score_points,
          nf.ingredients_text,
          pp.photo_url
        FROM products p
        JOIN nutritionfacts nf ON nf.product_id = p.product_id
        LEFT JOIN productphotos pp ON pp.product_id = p.product_id
                                  AND pp.is_primary = true
        WHERE p.rimi_category_code IN (145, 146)
          AND p.product_id IN (
            SELECT product_id FROM (
              SELECT DISTINCT ON (product_id) product_id, is_available
              FROM product_price_history
              ORDER BY product_id, recorded_at DESC
            ) latest
            WHERE latest.is_available = true
          )
        ORDER BY p.product_id
      `) : Promise.resolve(null);

      const [rimiResult, maximaResult] = await Promise.all([rimiQuery, maximaQuery]);

      const rimiRawRows = Array.isArray(rimiResult) ? rimiResult : (rimiResult as any)?.rows ?? [];
      const maximaRawRows = maximaResult
        ? (Array.isArray(maximaResult) ? maximaResult : (maximaResult as any)?.rows ?? [])
        : [];

      // Fetch per-product concern counts (avoid + limit + caution) from ingredient_product_mapping
      const rimiSkus = (rimiRawRows as any[]).map(r => r.sku as string).filter(Boolean);
      const maximaSkus = (maximaRawRows as any[]).map(r => r.sku as string).filter(Boolean);

      const concernQuery = (pool: typeof rimiPool, skus: string[]) => {
        if (!pool || skus.length === 0) return Promise.resolve([] as any[]);
        const phs = skus.map((_, i) => `$${i + 1}`).join(', ');
        return pool.query(`
          SELECT ipm.product_sku,
                 COUNT(CASE WHEN ia.suspicion_level IN ('avoid','limit','caution') THEN 1 END)::int AS concern_count
          FROM ingredient_product_mapping ipm
          JOIN ingredient_analysis ia ON ipm.ingredient_id = ia.id
          WHERE ipm.product_sku IN (${phs})
          GROUP BY ipm.product_sku
        `, skus).then(r => r.rows).catch(() => [] as any[]);
      };

      const [rimiConcernRows, maximaConcernRows] = await Promise.all([
        concernQuery(rimiPool, rimiSkus),
        maximaPool ? concernQuery(maximaPool, maximaSkus) : Promise.resolve([] as any[]),
      ]);

      const additiveCounts = new Map<string, number>();
      for (const r of [...rimiConcernRows, ...maximaConcernRows]) {
        additiveCounts.set(r.product_sku, Number(r.concern_count));
      }

      function mapRow(row: any, store: 'rimi' | 'maxima') {
        const slug = productSlug(row.name ?? '', row.product_id);
        const ingredientsText: string = row.ingredients_text ?? '';
        return {
          productId:        row.product_id,
          name:             row.name,
          slug,
          store,
          categoryNameLv:   row.category_name_lv ?? null,
          categoryNameEn:   row.category_name_en ?? null,
          photoUrl:         row.photo_url ?? null,
          novaScore:        row.nova_score !== null ? Number(row.nova_score) : null,
          nutriScoreGrade:  row.nutri_score_grade ?? null,
          nutriScorePoints: row.nutri_score_points !== null ? Number(row.nutri_score_points) : null,
          energyKcal:       row.energy_kcal    !== null ? Number(row.energy_kcal)    : null,
          fatTotal:         row.fat_total      !== null ? Number(row.fat_total)      : null,
          fatSaturated:     row.fat_saturated  !== null ? Number(row.fat_saturated)  : null,
          carbsTotal:       row.carbs_total    !== null ? Number(row.carbs_total)    : null,
          carbsSugars:      row.carbs_sugars   !== null ? Number(row.carbs_sugars)   : null,
          protein:          row.protein        !== null ? Number(row.protein)        : null,
          salt:             row.salt           !== null ? Number(row.salt)           : null,
          fiber:            row.fiber          !== null ? Number(row.fiber)          : null,
          quantityValue:    row.quantity_value !== null ? Number(row.quantity_value) : null,
          quantityUnit:     row.quantity_unit  ?? null,
          ingredientCount:  countTopLevelIngredients(ingredientsText),
          additiveCount:    additiveCounts.has(row.sku) ? (additiveCounts.get(row.sku) ?? null) : null,
        };
      }

      const products = [
        ...rimiRawRows.map((row: any) => mapRow(row, 'rimi')),
        ...maximaRawRows.map((row: any) => mapRow(row, 'maxima')),
      ];

      res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
      res.json({ products, total: products.length });
    } catch (error) {
      console.error('[reports/ice-cream] error:', error);
      res.status(500).json({ message: 'Failed to fetch ice cream report data' });
    }
  });

  // Sitemap.xml endpoint for SEO
  app.get("/sitemap.xml", async (_req: Request, res: Response) => {
    try {
      const baseUrl = "https://abcde.lv";
      const languages = ['lv', 'en'];
      const currentDate = new Date().toISOString().split('T')[0];
      
      // Static pages with their priorities and change frequencies
      // Some pages have language-specific paths (pathLv/pathEn), others use same path for all languages
      const staticPages: Array<{
        path?: string;
        pathLv?: string;
        pathEn?: string;
        priority: string;
        changefreq: string;
      }> = [
        { path: '/', priority: '1.0', changefreq: 'daily' },
        { path: '/about-nutriscore', priority: '0.8', changefreq: 'monthly' },
        { pathLv: '/ko-ed-latvija', pathEn: '/what-latvians-eat', priority: '0.7', changefreq: 'weekly' },
        { path: '/about-project', priority: '0.6', changefreq: 'monthly' },
        { path: '/scan', priority: '0.7', changefreq: 'monthly' },
        { pathLv: '/raksti/saldejums', pathEn: undefined, priority: '0.7', changefreq: 'monthly' }
      ];
      
      // Get all categories, excluding hidden ones
      const excludedCategoryIds = [5, 40];
      const categoriesResult = await rimiDb.execute(sql`
        SELECT category_id, name_lv, level FROM normalized_categories 
        WHERE category_id NOT IN (${sql.join(excludedCategoryIds.map(id => sql`${id}`), sql`, `)})
        ORDER BY category_id
      `);
      const categories = Array.isArray(categoriesResult) ? categoriesResult : 
        (categoriesResult && typeof categoriesResult === 'object' && 'rows' in categoriesResult) ? 
          (categoriesResult as any).rows : [];
      
      // Get all product IDs from Rimi that have Nutri-Score, excluding hidden categories
      const rimiProductsResult = await rimiDb.execute(sql`
        SELECT DISTINCT ON (p.product_id) p.product_id, p.name, p.name_norm, p.created_at
        FROM products p
        JOIN nutritionfacts nf ON p.product_id = nf.product_id
        WHERE nf.nutri_score_grade IS NOT NULL
        AND p.category_id NOT IN (${sql.join(excludedCategoryIds.map(id => sql`${id}`), sql`, `)})
        ORDER BY p.product_id
      `);
      const rimiProducts = Array.isArray(rimiProductsResult) ? rimiProductsResult : 
        (rimiProductsResult && typeof rimiProductsResult === 'object' && 'rows' in rimiProductsResult) ? 
          (rimiProductsResult as any).rows : [];
      
      // Get all product IDs from Maxima that have Nutri-Score (if database is available)
      let maximaProducts: any[] = [];
      if (maximaDb) {
        const maximaProductsResult = await maximaDb.execute(sql`
          SELECT DISTINCT ON (p.product_id) p.product_id, p.name, p.name_norm, p.created_at
          FROM products p
          JOIN nutritionfacts nf ON p.product_id = nf.product_id
          WHERE nf.nutri_score_grade IS NOT NULL
          ORDER BY p.product_id
        `);
        maximaProducts = Array.isArray(maximaProductsResult) ? maximaProductsResult : 
          (maximaProductsResult && typeof maximaProductsResult === 'object' && 'rows' in maximaProductsResult) ? 
            (maximaProductsResult as any).rows : [];
      }
      
      // Build a set of Rimi name_norms for fast duplicate lookup
      const rimiNormSet = new Set<string>(
        rimiProducts
          .map((p: any) => p.name_norm as string | null)
          .filter((n): n is string => !!n)
      );

      // Exclude Maxima products whose name_norm matches a Rimi product — those would be
      // duplicate-content pages (same physical product sold in both stores). Maxima-only
      // products (no Rimi equivalent) remain in the sitemap.
      const deduplicatedMaxima = maximaProducts.filter((p: any) => {
        const norm = p.name_norm as string | null;
        if (norm) return !rimiNormSet.has(norm);
        // Fallback: compare lowercased names when name_norm is absent
        const nameLower = (p.name as string || '').toLowerCase().trim();
        return !rimiProducts.some((r: any) => (r.name as string || '').toLowerCase().trim() === nameLower);
      });

      // Combine Rimi + deduplicated Maxima for sitemap
      const allProducts = [...rimiProducts, ...deduplicatedMaxima];
      
      // Build XML
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ';
      xml += 'xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';
      
      // Add static pages — only /lv/ as primary <loc>, /en/ and x-default as alternates only
      for (const page of staticPages) {
        const getPathForLang = (lang: string) => {
          if (page.path !== undefined) {
            return page.path === '/' ? '' : page.path;
          }
          return lang === 'lv' ? page.pathLv : page.pathEn;
        };

        const lvPath = getPathForLang('lv');
        const enPath = getPathForLang('en');
        xml += '  <url>\n';
        xml += `    <loc>${baseUrl}/lv${lvPath}</loc>\n`;
        xml += `    <lastmod>${currentDate}</lastmod>\n`;
        xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
        xml += `    <priority>${page.priority}</priority>\n`;
        xml += `    <xhtml:link rel="alternate" hreflang="lv" href="${baseUrl}/lv${lvPath}" />\n`;
        xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${baseUrl}/lv${lvPath}" />\n`;
        xml += '  </url>\n';
      }

      // Add category pages — only /lv/ as primary <loc>
      for (const category of categories) {
        const categoryId = (category as any).category_id;
        const catNameLv = (category as any).name_lv || '';
        const catLevel = (category as any).level;
        const catPriority = catLevel === 1 ? '0.8' : '0.6';
        const catSlug = categorySlug(catNameLv, categoryId);
        xml += '  <url>\n';
        xml += `    <loc>${baseUrl}/lv/category/${catSlug}</loc>\n`;
        xml += `    <lastmod>${currentDate}</lastmod>\n`;
        xml += '    <changefreq>weekly</changefreq>\n';
        xml += `    <priority>${catPriority}</priority>\n`;
        xml += `    <xhtml:link rel="alternate" hreflang="lv" href="${baseUrl}/lv/category/${catSlug}" />\n`;
        xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${baseUrl}/lv/category/${catSlug}" />\n`;
        xml += '  </url>\n';
      }

      // Format a DB timestamp value as a YYYY-MM-DD string for lastmod.
      // Falls back to currentDate if the value is absent or unparseable.
      const toDateStr = (val: unknown): string => {
        if (!val) return currentDate;
        try {
          const d = new Date(val as string);
          if (isNaN(d.getTime())) return currentDate;
          return d.toISOString().split('T')[0];
        } catch {
          return currentDate;
        }
      };

      // Add product pages — only /lv/ as primary <loc> (both Rimi and Maxima).
      // lastmod uses created_at so Google gets an accurate signal: newer products
      // have a recent date, established products show their original creation date.
      // The scraper touches updated_at daily (price/availability checks) so that
      // column would always equal today and mislead Google's crawl prioritisation.
      for (const product of allProducts) {
        const productId = (product as any).product_id;
        const productName = (product as any).name || '';
        const pSlug = productSlug(productName, productId);
        const productLastmod = toDateStr((product as any).created_at);
        xml += '  <url>\n';
        xml += `    <loc>${baseUrl}/lv/product/${pSlug}</loc>\n`;
        xml += `    <lastmod>${productLastmod}</lastmod>\n`;
        xml += '    <changefreq>weekly</changefreq>\n';
        xml += '    <priority>0.5</priority>\n';
        xml += `    <xhtml:link rel="alternate" hreflang="lv" href="${baseUrl}/lv/product/${pSlug}" />\n`;
        xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${baseUrl}/lv/product/${pSlug}" />\n`;
        xml += '  </url>\n';
      }
      
      xml += '</urlset>';
      
      res.header('Content-Type', 'application/xml');
      res.send(xml);
    } catch (error) {
      console.error("Error generating sitemap:", error);
      res.status(500).send('Error generating sitemap');
    }
  });

  // ── OG meta injection for product pages ──────────────────────────────────
  // Link-preview bots (Telegram, WhatsApp, Slack, iMessage, Twitter/X) never
  // execute JavaScript, so React Helmet's client-side OG tags are invisible to
  // them. These routes intercept product/category URLs, look up the record,
  // inject <meta> tags into index.html, and serve the modified HTML.
  //
  // The artifact.toml routes /lv/product/, /en/product/, /lv/category/, and
  // /en/category/ prefixes to this Express server so these handlers fire.
  // Static assets (/assets/*.js, *.css) are not routed here — they keep going
  // to the static file server.

  // Resolve the built frontend index.html.
  // CWD differs between environments:
  //   production  — node runs from workspace root → "artifacts/abcde-lv/..."
  //   development — pnpm runs from artifacts/api-server/ → "../../artifacts/abcde-lv/..."
  // We try all four candidates in priority order.
  const cwd = process.cwd();
  const INDEX_CANDIDATES = [
    join(cwd, "artifacts/abcde-lv/dist/public/index.html"),       // prod build (prod CWD)
    join(cwd, "../../artifacts/abcde-lv/dist/public/index.html"),  // prod build (dev CWD)
    join(cwd, "artifacts/abcde-lv/index.html"),                    // source HTML (prod CWD)
    join(cwd, "../../artifacts/abcde-lv/index.html"),              // source HTML (dev CWD)
  ];
  let indexHtmlCache: string | null = null;

  // Make Vite-bundled CSS non-blocking: browser defers load so it can't block FCP.
  // The critical inline styles in index.html already paint above-the-fold content,
  // so this is safe. Only targets /assets/*.css (content-hashed Vite bundles).
  function makeCssNonBlocking(html: string): string {
    return html.replace(
      /(<link rel="stylesheet"([^>]*href="\/assets\/[^"]*\.css"[^>]*)>)/g,
      (match, _full, attrs) => {
        if (attrs.includes("media=")) return match;
        const deferred = match.replace(
          'rel="stylesheet"',
          `rel="stylesheet" media="print" onload="this.media='all'"`
        );
        return `${deferred}<noscript>${match}</noscript>`;
      }
    );
  }

  async function getIndexHtml(): Promise<string | null> {
    if (indexHtmlCache) return indexHtmlCache;
    for (const candidate of INDEX_CANDIDATES) {
      try {
        const raw = await readFile(candidate, "utf-8");
        indexHtmlCache = makeCssNonBlocking(raw);
        return indexHtmlCache;
      } catch { /* try next */ }
    }
    return null;
  }

  function escapeAttr(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function buildProductOgTags(opts: {
    title: string;
    description: string;
    canonical: string;
    imageUrl?: string;
  }): string {
    const { title, description, canonical, imageUrl } = opts;
    const lines = [
      `  <link rel="canonical" href="${escapeAttr(canonical)}" />`,
      `  <link rel="alternate" hrefLang="lv" href="${escapeAttr(canonical)}" />`,
      `  <link rel="alternate" hrefLang="x-default" href="${escapeAttr(canonical)}" />`,
      `  <meta property="og:type" content="product" />`,
      `  <meta property="og:site_name" content="ABCDE.lv" />`,
      `  <meta property="og:title" content="${escapeAttr(title)}" />`,
      `  <meta property="og:description" content="${escapeAttr(description)}" />`,
      `  <meta property="og:url" content="${escapeAttr(canonical)}" />`,
      imageUrl ? `  <meta property="og:image" content="${escapeAttr(imageUrl)}" />` : null,
      `  <meta name="twitter:card" content="${imageUrl ? "summary_large_image" : "summary"}" />`,
      `  <meta name="twitter:title" content="${escapeAttr(title)}" />`,
      `  <meta name="twitter:description" content="${escapeAttr(description)}" />`,
      imageUrl ? `  <meta name="twitter:image" content="${escapeAttr(imageUrl)}" />` : null,
    ];
    return lines.filter(Boolean).join("\n");
  }

  // In development, Express reads the raw index.html (without Vite's transformIndexHtml),
  // so the @vitejs/plugin-react preamble is missing. Inject it manually so that
  // React Refresh can find window.__vite_plugin_react_preamble_installed__ and
  // React mounts correctly on product/category pages served by Express.
  const DEV_VITE_PREAMBLE =
    process.env.NODE_ENV !== "production"
      ? `  <script type="module">
    import RefreshRuntime from "/@react-refresh"
    RefreshRuntime.injectIntoGlobalHook(window)
    window.$RefreshReg$ = () => {}
    window.$RefreshSig$ = () => (type) => type
    window.__vite_plugin_react_preamble_installed__ = true
  </script>\n`
      : "";

  function injectIntoHtml(baseHtml: string, pageTitle: string, metaTags: string): string {
    return baseHtml
      .replace(/<title>[^<]*<\/title>/, `<title>${escapeAttr(pageTitle)}</title>`)
      .replace("</head>", `${DEV_VITE_PREAMBLE}${metaTags}\n</head>`);
  }

  // Product page handler (shared by /lv/product/:slug and /en/product/:slug)
  // Express 5 (path-to-regexp v8) no longer supports inline regex in named params
  // like /:lang(lv|en), so we register two explicit routes sharing one function.
  async function serveProductPage(req: Request, res: Response): Promise<void> {
    const baseHtml = await getIndexHtml();
    if (!baseHtml) { res.status(404).send("Not found"); return; }

    const slug = String(req.params.slug);
    const productId = extractIdFromSlug(slug);

    if (!productId) {
      res.set("Content-Type", "text/html; charset=utf-8");
      res.send(baseHtml);
      return;
    }

    try {
      // Rimi and Maxima share numeric ID spaces, so the same ID can refer to two
      // different products. Fetch from both stores in parallel, then pick the one
      // whose canonical slug matches the URL slug (fall back to the first found).
      const [rimiResult, maximaResult] = await Promise.allSettled([
        storage.getProductById(productId),          // tries Rimi first, then Maxima
        storage.getProductById(productId, "maxima"), // forces Maxima lookup
      ]);
      const candidates = [rimiResult, maximaResult]
        .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof storage.getProductById>>> =>
          r.status === "fulfilled" && r.value != null)
        .map(r => r.value!);

      const product = candidates.find(p => p.slug === slug) ?? candidates[0] ?? null;

      if (!product) {
        res.set("Content-Type", "text/html; charset=utf-8");
        res.send(baseHtml);
        return;
      }

      const name  = product.name;
      const grade = product.nutrition?.nutriScoreGrade ?? null;
      const store = product.store === "maxima" ? "Maxima" : "Rimi";
      const qty   = product.quantityValue && product.quantityUnit
        ? `${parseFloat(String(product.quantityValue))} ${product.quantityUnit}`
        : null;
      const photo = (product.photos?.find((p: any) => p.isPrimary) ?? product.photos?.[0])?.photoUrl;

      const descParts: string[] = [];
      if (grade) descParts.push(`Nutri-Score ${grade}`);
      descParts.push(store);
      if (qty)   descParts.push(qty);
      const description = descParts.join(" · ");

      const pSlug     = productSlug(name, product.productId);
      const canonical  = `https://abcde.lv/lv/product/${pSlug}`;
      const pageTitle  = `${name} | ABCDE.lv`;

      const metaTags = buildProductOgTags({ title: name, description, canonical, imageUrl: photo });
      const html     = injectIntoHtml(baseHtml, pageTitle, metaTags);

      res.set("Content-Type", "text/html; charset=utf-8");
      res.set("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
      res.send(html);
    } catch {
      res.set("Content-Type", "text/html; charset=utf-8");
      res.send(baseHtml);
    }
  }

  app.get("/lv/product/:slug", serveProductPage);
  app.get("/en/product/:slug", (req: Request, res: Response) => {
    res.redirect(301, `/lv/product/${req.params.slug}`);
  });

  // Category page handler (shared by /lv/category/:slug and /en/category/:slug)
  async function serveCategoryPage(req: Request, res: Response): Promise<void> {
    const baseHtml = await getIndexHtml();
    if (!baseHtml) { res.status(404).send("Not found"); return; }

    const lang       = req.path.startsWith("/en/") ? "en" : "lv";
    const slug       = String(req.params.slug);
    const categoryId = extractIdFromSlug(slug);

    if (!categoryId) {
      res.set("Content-Type", "text/html; charset=utf-8");
      res.send(baseHtml);
      return;
    }

    try {
      const category = await storage.getCategoryById(categoryId);

      if (!category) {
        res.set("Content-Type", "text/html; charset=utf-8");
        res.send(baseHtml);
        return;
      }

      const categoryName = lang === "en" ? category.nameEn : category.nameLv;
      const pageTitle    = `${categoryName} | ABCDE.lv`;
      const description  = lang === "en"
        ? `Browse ${categoryName} products with Nutri-Score ratings on ABCDE.lv`
        : `Pārlūkojiet ${categoryName} produktus ar Nutri-Score vērtējumiem — ABCDE.lv`;
      const catSlug   = categorySlug(category.nameLv, category.categoryId);
      const canonical = `https://abcde.lv/lv/category/${catSlug}`;

      const metaTags = [
        `  <link rel="canonical" href="${escapeAttr(canonical)}" />`,
        `  <link rel="alternate" hrefLang="lv" href="${escapeAttr(canonical)}" />`,
        `  <link rel="alternate" hrefLang="x-default" href="${escapeAttr(canonical)}" />`,
        `  <meta property="og:type" content="website" />`,
        `  <meta property="og:site_name" content="ABCDE.lv" />`,
        `  <meta property="og:title" content="${escapeAttr(categoryName)}" />`,
        `  <meta property="og:description" content="${escapeAttr(description)}" />`,
        `  <meta property="og:url" content="${escapeAttr(canonical)}" />`,
        `  <meta name="twitter:card" content="summary" />`,
        `  <meta name="twitter:title" content="${escapeAttr(categoryName)}" />`,
        `  <meta name="twitter:description" content="${escapeAttr(description)}" />`,
      ].join("\n");

      const html = injectIntoHtml(baseHtml, pageTitle, metaTags);

      res.set("Content-Type", "text/html; charset=utf-8");
      res.set("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
      res.send(html);
    } catch {
      res.set("Content-Type", "text/html; charset=utf-8");
      res.send(baseHtml);
    }
  }

  app.get("/lv/category/:slug", serveCategoryPage);
  app.get("/en/category/:slug", (req: Request, res: Response) => {
    res.redirect(301, `/lv/category/${req.params.slug}`);
  });

  // Article: /en/raksti/saldejums redirects to the LV canonical
  app.get("/en/raksti/saldejums", (_req: Request, res: Response): void => {
    res.redirect(301, "https://abcde.lv/lv/raksti/saldejums");
  });

  // EN static info pages — inject noindex so Google ignores them.
  // injectSeoTags() already adds <meta name="robots" content="noindex, follow" />
  // whenever lang === 'en', so we just need Express to handle these paths.
  const EN_STATIC_PATHS = [
    "/en/about-nutriscore",
    "/en/about-project",
    "/en/scan",
    "/en/product-search",
    "/en/ko-ed-latvija",
    "/en/what-latvians-eat",
    "/en/404",
  ];

  async function serveEnStaticPage(req: Request, res: Response): Promise<void> {
    const baseHtml = await getIndexHtml();
    if (!baseHtml) { res.status(404).send("Not found"); return; }

    let html = baseHtml;
    if (DEV_VITE_PREAMBLE) {
      html = html.replace("</head>", `${DEV_VITE_PREAMBLE}</head>`);
    }
    html = injectSeoTags(html, req.path);

    res.set("Content-Type", "text/html; charset=utf-8");
    res.set("Cache-Control", "public, max-age=300, stale-while-revalidate=900");
    res.send(html);
  }

  for (const enPath of EN_STATIC_PATHS) {
    app.get(enPath, serveEnStaticPage);
  }
  app.get("/en/{*path}", serveEnStaticPage);

  // LV static info pages — inject page-specific title, description, and canonical.
  // These paths are also caught by the SPA catch-all below, but that handler
  // serves bare index.html with no SEO tags. Register them explicitly here so
  // injectSeoTags() can inject the correct title/description/canonical before
  // the page is served to crawlers.
  const LV_STATIC_PATHS = [
    "/lv/ko-ed-latvija",
    "/lv/about-nutriscore",
    "/lv/about-project",
    "/lv/scan",
    "/lv/product-search",
  ];

  async function serveLvStaticPage(req: Request, res: Response): Promise<void> {
    const baseHtml = await getIndexHtml();
    if (!baseHtml) { res.status(404).send("Not found"); return; }

    const html = injectSeoTags(baseHtml, req.path);

    res.set("Content-Type", "text/html; charset=utf-8");
    res.set("Cache-Control", "public, max-age=300, stale-while-revalidate=900");
    res.send(html);
  }

  for (const lvPath of LV_STATIC_PATHS) {
    app.get(lvPath, serveLvStaticPage);
  }

  // Article page: /lv/raksti/saldejums — ice cream analysis
  // Serves index.html with injected title + meta description for search crawlers.
  app.get("/lv/raksti/saldejums", async (_req: Request, res: Response): Promise<void> => {
    const baseHtml = await getIndexHtml();
    if (!baseHtml) { res.status(404).send("Not found"); return; }

    const title = "Veselīgākais saldējums Latvijā? Nutri-Score analīze | ABCDE.lv";
    const description = "Saldējumu Nutri-Score sadalījums no Rimi un Maxima, cukura un tauku salīdzinājums, TOP 10 ar mazāko cukuru un piedevām. Uzzini, kuru saldējumu pirkt.";
    const canonical = "https://abcde.lv/lv/raksti/saldejums";

    const metaTags = [
      `  <link rel="canonical" href="${escapeAttr(canonical)}" />`,
      `  <meta name="description" content="${escapeAttr(description)}" />`,
      `  <meta property="og:type" content="article" />`,
      `  <meta property="og:site_name" content="ABCDE.lv" />`,
      `  <meta property="og:title" content="${escapeAttr(title)}" />`,
      `  <meta property="og:description" content="${escapeAttr(description)}" />`,
      `  <meta property="og:url" content="${escapeAttr(canonical)}" />`,
      `  <meta name="twitter:card" content="summary" />`,
      `  <meta name="twitter:title" content="${escapeAttr(title)}" />`,
      `  <meta name="twitter:description" content="${escapeAttr(description)}" />`,
    ].join("\n");

    const html = injectIntoHtml(baseHtml, title, metaTags);
    res.set("Content-Type", "text/html; charset=utf-8");
    res.set("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
    res.send(html);
  });

  // --------------------------------------------------------------------------
  // Server-side pre-render helpers — replicate frontend photoUrl.ts logic so
  // we can build Cloudinary URLs without running React on the server.
  // --------------------------------------------------------------------------

  function ssrCloudinaryUrl(url: string, width: number): string {
    return url
      .replace(/dpr_auto,/g, "")
      .replace(/,dpr_auto/g, "")
      .replace(/\bq_auto:low\b/g, "q_auto")
      .replace(/\bw_auto\b/g, `w_${width}`)
      .replace(/\bw_\d+\b/g, `w_${width}`);
  }

  function ssrSrcSet(url: string, widths: number[]): string {
    const base = url
      .replace(/dpr_auto,/g, "")
      .replace(/,dpr_auto/g, "")
      .replace(/\bq_auto:low\b/g, "q_auto");
    return widths
      .map((w) => `${base.replace(/\bw_auto\b/g, `w_${w}`).replace(/\bw_\d+\b/g, `w_${w}`)} ${w}w`)
      .join(", ");
  }

  // Builds a minimal product-grid shell that is injected into <div id="root">
  // before React loads. Uses inline styles so it renders immediately without
  // waiting for the CSS bundle. React's createRoot() replaces this content when
  // it mounts (~3s on mobile), but FCP + LCP are already measured by then.
  // Layout mirrors the React app exactly using a <style> block with media queries
  // (Tailwind md=768px, lg=1024px) so the transition is seamless on all viewports.
  function buildPrerenderedShell(
    products: Array<{
      productId: number;
      name: string;
      slug?: string | null;
      store?: string | null;
      photos?: Array<{ photoUrl?: string | null; isPrimary?: boolean | null }> | null;
    }>,
    lang: string,
  ): string {
    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    const isEn = lang === "en";
    const tr = {
      aboutNutriScore: isEn ? "About Nutri-Score" : "Par Nutri-Score",
      whatLatviansEat: isEn ? "What do Latvians eat?" : "Ko ēd Latvijā?",
      aboutProject: isEn ? "About the project" : "Par projektu",
      searchPlaceholder: isEn ? "Search products..." : "Meklēt produktus...",
      allProducts: isEn ? "All products" : "Visi produkti",
      categories: isEn ? "Categories" : "Kategorijas",
      allCategories: isEn ? "All categories" : "Visas kategorijas",
      langToggle: isEn ? "LV" : "English",
      langHref: isEn ? "/lv" : "/en",
      eatHref: isEn ? "/en/what-latvians-eat" : "/lv/ko-ed-latvija",
    };

    // SVG search icon (inline, no external dependency)
    const searchSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;

    // Responsive styles that match Tailwind breakpoints exactly.
    // React clears #root entirely when it mounts, so these styles disappear with the shell.
    const responsiveStyles = `<style>
/* SSR pre-render shell — removed when React mounts */
.ssr-desktop-search{display:none}
.ssr-mobile-search{display:block}
.ssr-sidebar{display:none}
.ssr-row{display:flex;flex-direction:column}
#ssr-grid{grid-template-columns:repeat(2,1fr)}
@media(min-width:768px){
  .ssr-desktop-search{display:block}
  .ssr-mobile-search{display:none}
  .ssr-sidebar{display:block}
  .ssr-row{flex-direction:row}
  #ssr-grid{grid-template-columns:repeat(3,1fr);gap:24px}
}
@media(min-width:1024px){
  #ssr-grid{grid-template-columns:repeat(4,1fr)}
}
</style>`;

    // Gray skeleton bar helper for sidebar category placeholders
    const skBar = (w: string) =>
      `<div style="height:40px;background:#e5e7eb;border-radius:6px;width:${w};margin-bottom:8px"></div>`;

    const sidebar = `<aside class="ssr-sidebar" style="width:256px;flex-shrink:0;padding-right:24px">
  <h2 style="font-weight:500;font-size:18px;color:#111827;margin:0 0 12px">${tr.categories}</h2>
  <div style="font-size:14px;color:#6b7280;margin-bottom:16px">
    <a href="/${esc(lang)}" style="text-decoration:none;color:#6b7280">${tr.allCategories}</a>
  </div>
  <div>
    ${skBar("100%")}${skBar("90%")}${skBar("95%")}${skBar("85%")}${skBar("100%")}
  </div>
</aside>`;

    // Product cards — only 4 above-fold (2-col × 2-row on mobile)
    const cards = products.slice(0, 4).map((p, i) => {
      const raw = (p.photos?.find((ph) => ph.isPrimary) ?? p.photos?.[0])?.photoUrl ?? "";
      const isCloudinary = raw.includes("cloudinary.com");
      const src = isCloudinary ? ssrCloudinaryUrl(raw, 300) : raw;
      const srcset = isCloudinary ? ssrSrcSet(raw, [150, 300, 450]) : "";
      const slug = p.slug || String(p.productId);
      const storeBg = p.store === "rimi" ? "#D33731" : "#24488B";
      const storeLabel = p.store === "rimi" ? "Rimi" : "Maxima";
      const isFirst = i === 0;

      return `<div style="background:#fff;border-radius:8px;box-shadow:0 1px 2px rgba(0,0,0,.06);border:1px solid #e5e7eb;overflow:hidden">
  <a href="/${esc(lang)}/product/${esc(slug)}" style="display:block;text-decoration:none;color:inherit">
    <div style="position:relative;aspect-ratio:3/2;overflow:hidden">
      <img src="${esc(src)}"${srcset ? ` srcset="${esc(srcset)}"` : ""} sizes="(min-width:1024px) 25vw,(min-width:768px) 33vw,50vw" alt="${esc(p.name)}" width="300" height="200" loading="${isFirst ? "eager" : "lazy"}" fetchpriority="${isFirst ? "high" : "auto"}" decoding="${isFirst ? "sync" : "async"}" style="width:100%;height:100%;object-fit:cover" />
      <div style="position:absolute;top:8px;right:8px;background:${storeBg};color:#fff;font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px">${storeLabel}</div>
    </div>
    <div style="padding:12px">
      <div style="font-weight:500;color:#111827;font-size:14px;line-height:1.4">${esc(p.name)}</div>
    </div>
  </a>
</div>`;
    }).join("\n");

    return `${responsiveStyles}
<header style="background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.08);position:sticky;top:0;z-index:50">
  <div style="background:#f9fafb;border-bottom:1px solid #e5e7eb">
    <div style="max-width:1280px;margin:0 auto;padding:6px 16px;display:flex;justify-content:center;gap:24px">
      <a href="/${esc(lang)}/about-nutriscore" style="font-size:14px;color:#374151;text-decoration:none;font-weight:500">${tr.aboutNutriScore}</a>
      <a href="${esc(tr.eatHref)}" style="font-size:14px;color:#374151;text-decoration:none;font-weight:500">${tr.whatLatviansEat}</a>
      <a href="/${esc(lang)}/about-project" style="font-size:14px;color:#374151;text-decoration:none;font-weight:500">${tr.aboutProject}</a>
    </div>
  </div>
  <div style="max-width:1280px;margin:0 auto;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;gap:16px">
    <a href="/${esc(lang)}" style="display:flex;align-items:center;flex-shrink:0;text-decoration:none">
      <img src="/nutri-score-logo.png" alt="NUTRI-SCORE" width="150" height="78" loading="eager" style="height:5.2rem;width:auto" />
    </a>
    <div class="ssr-desktop-search" style="flex-grow:1;max-width:512px">
      <div style="position:relative">
        <input type="text" placeholder="${esc(tr.searchPlaceholder)}" style="width:100%;padding:8px 40px 8px 16px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;color:#374151;background:#fff;box-sizing:border-box" disabled />
        <span style="position:absolute;right:10px;top:50%;transform:translateY(-50%);display:flex">${searchSvg}</span>
      </div>
    </div>
    <a href="${esc(tr.langHref)}" style="font-size:14px;color:#374151;text-decoration:none;flex-shrink:0">${tr.langToggle}</a>
  </div>
  <div class="ssr-mobile-search" style="padding:0 16px 12px">
    <div style="position:relative">
      <input type="text" placeholder="${esc(tr.searchPlaceholder)}" style="width:100%;padding:8px 40px 8px 16px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;color:#374151;background:#fff;box-sizing:border-box" disabled />
      <span style="position:absolute;right:10px;top:50%;transform:translateY(-50%);display:flex">${searchSvg}</span>
    </div>
  </div>
</header>
<div style="background:#f3f4f6;min-height:100vh">
  <div style="max-width:1280px;margin:0 auto;padding:16px 16px 24px">
    <div class="ssr-row" style="align-items:flex-start">
      ${sidebar}
      <main style="flex:1;min-width:0">
        <h1 style="font-size:24px;font-weight:700;color:#111827;margin:0 0 8px">${tr.allProducts}</h1>
        <div id="ssr-grid" style="display:grid;gap:16px;margin-top:16px">
          ${cards}
        </div>
      </main>
    </div>
  </div>
</div>`;
  }

  // Homepage SSR — serves /lv and /en with:
  //   1. __ABCDE_INITIAL_DATA__ embedded so React skips its first API round-trip
  //   2. <link rel="preload"> for the LCP image so download starts immediately
  //   3. Pre-rendered product shell in #root so FCP/LCP fire before JS loads
  async function serveHomepage(req: Request, res: Response): Promise<void> {
    let baseHtml = await getIndexHtml();
    if (!baseHtml) { res.status(404).send("Not found"); return; }

    // In dev, inject the Vite React Refresh preamble the same way injectIntoHtml
    // does for product/category pages — without it, React won't mount in dev mode.
    if (DEV_VITE_PREAMBLE) {
      baseHtml = baseHtml.replace("</head>", `${DEV_VITE_PREAMBLE}</head>`);
    }

    try {
      const initialData = await storage.getProducts({
        page: 1,
        pageSize: 12,
        sortBy: "nutriScore",
        sortOrder: "asc",
        store: "rimi",
      });

      const photos: Array<{ photoUrl?: string; isPrimary?: boolean | null }> =
        initialData.products[0]?.photos ?? [];
      const firstPhoto = photos.find((p) => p.isPrimary) ?? photos[0];
      const lcpImageUrl: string | null = firstPhoto?.photoUrl ?? null;

      const lang = req.path.startsWith("/en") ? "en" : "lv";

      let html = injectSeoTags(
        baseHtml,
        req.path,
        undefined,
        lcpImageUrl,
        initialData,
      );

      // Inject pre-rendered product shell so the browser has visible content
      // immediately — FCP and LCP are measured before React boots.
      // React's createRoot() replaces this when it mounts (no extra API call,
      // uses __ABCDE_INITIAL_DATA__ already in the DOM).
      const prerenderedShell = buildPrerenderedShell(initialData.products, lang);
      html = html.replace('<div id="root"></div>', `<div id="root">${prerenderedShell}</div>`);

      res.set("Content-Type", "text/html; charset=utf-8");
      res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
      res.send(html);
    } catch {
      res.set("Content-Type", "text/html; charset=utf-8");
      res.set("Cache-Control", "no-store");
      res.send(baseHtml);
    }
  }

  app.get("/lv", serveHomepage);
  app.get("/lv/", serveHomepage);
  app.get("/en", serveHomepage);
  app.get("/en/", serveHomepage);

  // SPA catch-all: any /lv/* path not matched above gets the base index.html.
  // The proxy routes /lv* to this Express server, so without this catch-all
  // pages like /lv/ko-ed-latvija, /lv/about-nutriscore, /lv/scan, etc. return 404.
  // Wouter handles the route client-side after React boots.
  app.get("/lv/{*path}", async (_req: Request, res: Response): Promise<void> => {
    const baseHtml = await getIndexHtml();
    if (!baseHtml) { res.status(404).send("Not found"); return; }
    let html = baseHtml;
    if (DEV_VITE_PREAMBLE) {
      html = html.replace("</head>", `${DEV_VITE_PREAMBLE}</head>`);
    }
    res.set("Content-Type", "text/html; charset=utf-8");
    res.set("Cache-Control", "public, max-age=300, stale-while-revalidate=900");
    res.send(html);
  });

  const httpServer = createServer(app);
  return httpServer;
}
