import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { rimiDb, maximaDb } from "./db";
import { normalizeLvText } from "./utils/textNormalization";
import { categorySlug, productSlug, extractIdFromSlug } from "./utils/slugify";
import { handleImageProxy } from "./imageProxy";
import type { Store } from "@shared/schema";

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
        { path: '/scan', priority: '0.7', changefreq: 'monthly' }
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
        SELECT DISTINCT ON (p.product_id) p.product_id, p.name, p.name_norm
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
          SELECT DISTINCT ON (p.product_id) p.product_id, p.name, p.name_norm
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
        xml += `    <xhtml:link rel="alternate" hreflang="en" href="${baseUrl}/en${enPath}" />\n`;
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
        xml += `    <xhtml:link rel="alternate" hreflang="en" href="${baseUrl}/en/category/${catSlug}" />\n`;
        xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${baseUrl}/lv/category/${catSlug}" />\n`;
        xml += '  </url>\n';
      }

      // Add product pages — only /lv/ as primary <loc> (both Rimi and Maxima)
      for (const product of allProducts) {
        const productId = (product as any).product_id;
        const productName = (product as any).name || '';
        const pSlug = productSlug(productName, productId);
        xml += '  <url>\n';
        xml += `    <loc>${baseUrl}/lv/product/${pSlug}</loc>\n`;
        xml += `    <lastmod>${currentDate}</lastmod>\n`;
        xml += '    <changefreq>weekly</changefreq>\n';
        xml += '    <priority>0.5</priority>\n';
        xml += `    <xhtml:link rel="alternate" hreflang="lv" href="${baseUrl}/lv/product/${pSlug}" />\n`;
        xml += `    <xhtml:link rel="alternate" hreflang="en" href="${baseUrl}/en/product/${pSlug}" />\n`;
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

  const httpServer = createServer(app);
  return httpServer;
}
