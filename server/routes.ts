import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { rimiDb } from "./db";
import { normalizeLvText } from "./utils/textNormalization";
import { ObjectStorageService } from "./objectStorage";

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
  store: z.enum(['rimi', 'maxima']).optional()
});

export async function registerRoutes(app: Express): Promise<Server> {
  // API routes - all prefixed with /api

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
        return res.json(categories);
      }
      
      const categories = await storage.getCategories(level);
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });
  
  app.get("/api/categories/:id", async (req: Request, res: Response) => {
    try {
      const categoryId = parseInt(req.params.id, 10);
      
      if (isNaN(categoryId)) {
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
      const categoryId = parseInt(req.params.id, 10);
      
      if (isNaN(categoryId)) {
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
        store
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
        store
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
      res.json(result);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });
  
  app.get("/api/products/:id", async (req: Request, res: Response) => {
    try {
      const productId = parseInt(req.params.id, 10);
      const store = req.query.store as 'rimi' | 'maxima' | undefined;
      
      if (isNaN(productId)) {
        return res.status(400).json({ message: "Invalid product ID" });
      }
      
      const product = await storage.getProductById(productId, store);
      
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
    let photoUrl: string | null = null;
    
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
      
      // Save photo to object storage before processing (only if configured)
      if (process.env.PRIVATE_OBJECT_DIR) {
        const objectStorageService = new ObjectStorageService();
        try {
          photoUrl = await objectStorageService.saveImageFromBase64(image);
          console.log(`Photo saved to storage: ${photoUrl}`);
        } catch (storageError) {
          console.error("Failed to save photo to storage:", storageError);
          // Continue with OCR even if storage fails
        }
      } else {
        console.log("Object storage not configured, skipping photo save");
      }
      
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
          photoUrl: photoUrl, // Can be null if storage not configured
          ocrText: fullText,
          productId: matchedProduct?.productId || null,
          matchConfidence: matchedProduct ? "85.00" : null, // Default confidence
          success: !!matchedProduct,
          language: req.headers['accept-language']?.split(',')[0]?.substring(0, 2) || 'unknown'
        });
        console.log(`Scan metadata saved to database. Product: ${matchedProduct ? matchedProduct.name : 'none'}, Photo: ${photoUrl ? 'saved' : 'not saved'}, Token: ${createdScan.photoAccessToken}`);
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

      if (!scan.photoUrl) {
        return res.status(404).json({
          success: false,
          message: "No photo associated with this scan"
        });
      }

      // Parse gs:// path and stream the photo
      const objectStorageService = new ObjectStorageService();
      const file = await objectStorageService.getFileFromStoragePath(scan.photoUrl);
      
      if (!file) {
        return res.status(404).json({
          success: false,
          message: "Photo file not found in storage"
        });
      }

      // Stream the photo directly to the client
      await objectStorageService.downloadObject(file, res);
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
      const staticPages = [
        { path: '/', priority: '1.0', changefreq: 'daily' },
        { path: '/about-nutriscore', priority: '0.8', changefreq: 'monthly' },
        { path: '/scan', priority: '0.7', changefreq: 'monthly' }
      ];
      
      // Get all categories
      const categoriesResult = await rimiDb.execute(sql`
        SELECT category_id FROM normalized_categories ORDER BY category_id
      `);
      const categories = Array.isArray(categoriesResult) ? categoriesResult : 
        (categoriesResult && typeof categoriesResult === 'object' && 'rows' in categoriesResult) ? 
          (categoriesResult as any).rows : [];
      
      // Get all product IDs from Rimi that have Nutri-Score
      const rimiProductsResult = await rimiDb.execute(sql`
        SELECT DISTINCT p.product_id 
        FROM products p
        JOIN nutritionfacts nf ON p.product_id = nf.product_id
        WHERE nf.nutri_score_grade IS NOT NULL
        ORDER BY p.product_id
      `);
      const rimiProducts = Array.isArray(rimiProductsResult) ? rimiProductsResult : 
        (rimiProductsResult && typeof rimiProductsResult === 'object' && 'rows' in rimiProductsResult) ? 
          (rimiProductsResult as any).rows : [];
      
      // Build XML
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ';
      xml += 'xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';
      
      // Add static pages with hreflang alternates
      for (const page of staticPages) {
        for (const lang of languages) {
          xml += '  <url>\n';
          xml += `    <loc>${baseUrl}/${lang}${page.path === '/' ? '' : page.path}</loc>\n`;
          xml += `    <lastmod>${currentDate}</lastmod>\n`;
          xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
          xml += `    <priority>${page.priority}</priority>\n`;
          // Add hreflang alternates
          for (const altLang of languages) {
            xml += `    <xhtml:link rel="alternate" hreflang="${altLang}" href="${baseUrl}/${altLang}${page.path === '/' ? '' : page.path}" />\n`;
          }
          xml += '  </url>\n';
        }
      }
      
      // Add category pages with hreflang alternates
      for (const category of categories) {
        const categoryId = (category as any).category_id;
        for (const lang of languages) {
          xml += '  <url>\n';
          xml += `    <loc>${baseUrl}/${lang}/category/${categoryId}</loc>\n`;
          xml += `    <lastmod>${currentDate}</lastmod>\n`;
          xml += '    <changefreq>weekly</changefreq>\n';
          xml += '    <priority>0.6</priority>\n';
          for (const altLang of languages) {
            xml += `    <xhtml:link rel="alternate" hreflang="${altLang}" href="${baseUrl}/${altLang}/category/${categoryId}" />\n`;
          }
          xml += '  </url>\n';
        }
      }
      
      // Add product pages with hreflang alternates
      for (const product of rimiProducts) {
        const productId = (product as any).product_id;
        for (const lang of languages) {
          xml += '  <url>\n';
          xml += `    <loc>${baseUrl}/${lang}/product/${productId}</loc>\n`;
          xml += `    <lastmod>${currentDate}</lastmod>\n`;
          xml += '    <changefreq>weekly</changefreq>\n';
          xml += '    <priority>0.5</priority>\n';
          for (const altLang of languages) {
            xml += `    <xhtml:link rel="alternate" hreflang="${altLang}" href="${baseUrl}/${altLang}/product/${productId}" />\n`;
          }
          xml += '  </url>\n';
        }
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
